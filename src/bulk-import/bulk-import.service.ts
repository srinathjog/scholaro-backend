import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.entity';
import { Role } from '../users/role.entity';
import { Teacher } from '../teachers/teacher.entity';
import { Student } from '../students/student.entity';
import { Class } from '../classes/class.entity';
import { Section } from '../sections/section.entity';
import { Enrollment } from '../enrollments/enrollment.entity';
import { AcademicYear } from '../academic-years/academic-year.entity';
import { ParentStudent } from '../parents/parent-student.entity';
import { Tenant } from '../super-admin/tenant.entity';
import { MailService } from '../mail/mail.service';
import { FeeStructure, Fee } from '../fees/fee.entity';
import * as bcrypt from 'bcryptjs';
import * as ExcelJS from 'exceljs';

@Injectable()
export class BulkImportService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(Teacher)
    private readonly teacherRepo: Repository<Teacher>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Class) private readonly classRepo: Repository<Class>,
    @InjectRepository(Section)
    private readonly sectionRepo: Repository<Section>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(AcademicYear)
    private readonly academicYearRepo: Repository<AcademicYear>,
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
  ) {}

  private toNodeBuffer(fileBuffer: Buffer | ArrayBuffer | Uint8Array): Buffer {
    if (Buffer.isBuffer(fileBuffer)) return fileBuffer;
    if (fileBuffer instanceof Uint8Array) return Buffer.from(fileBuffer);
    if (fileBuffer instanceof ArrayBuffer) return Buffer.from(new Uint8Array(fileBuffer));
    throw new BadRequestException('Invalid file buffer type');
  }

  /**
   * Complete Family Onboarding — import students from Excel/CSV.
   * Columns: first_name, last_name, dob, gender, class_name, section_name,
   *          father_name, father_email, father_phone, mother_name, mother_email
   *
   * For each row (inside a transaction):
   *   1. Create Student
   *   2. Create Enrollment (auto-detects the active academic year)
   *   3. Handle Father — find-or-create PARENT user, link via parent_students
   *   4. Handle Mother — same as father
   */
  async importStudents(
    fileBuffer: Buffer | ArrayBuffer | Uint8Array,
    tenantId: string,
  ) {
    const workbook = new ExcelJS.Workbook();
    const nodeBuffer = this.toNodeBuffer(fileBuffer);

    // Try XLSX first, fall back to CSV
    try {
      await workbook.xlsx.load(nodeBuffer as any);
    } catch {
      try {
        const csvContent = nodeBuffer.toString('utf-8');
        const stream = new (require('stream').Readable)();
        stream.push(csvContent);
        stream.push(null);
        await workbook.csv.read(stream);
      } catch {
        throw new BadRequestException('Unable to parse file. Please upload a valid .xlsx or .csv file.');
      }
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new BadRequestException('No worksheet found');

    type StudentRow = {
      first_name: string;
      last_name: string;
      dob: string;
      gender: string;
      class_name: string;
      section_name: string;
      father_name: string;
      father_email: string;
      father_phone: string;
      mother_name: string;
      mother_email: string;
      mother_phone: string;
    };

    const cellToString = (val: any): string => {
      if (val === null || val === undefined) return '';
      if (val instanceof Date) {
        return val.toISOString().split('T')[0];
      }
      if (typeof val === 'object' && val.text) return String(val.text);
      if (typeof val === 'object' && val.result !== undefined) return String(val.result);
      return String(val).trim();
    };

    /** Convert a string to Title Case: "AARAV SHARMA" or "aarav sharma" → "Aarav Sharma" */
    const toTitleCase = (str: string): string =>
      str.trim().replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

    /** Parse date string in DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, or MM/DD/YYYY formats */
    const parseDate = (raw: string): Date => {
      // Already YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(raw + 'T00:00:00Z');
      // DD/MM/YYYY or DD-MM-YYYY
      const dmyMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmyMatch) {
        const [, d, m, y] = dmyMatch;
        return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00Z`);
      }
      // Fallback: parse and normalise to UTC midnight
      const parsed = new Date(raw);
      if (isNaN(parsed.getTime())) throw new Error(`Invalid date format: "${raw}". Use DD/MM/YYYY or YYYY-MM-DD.`);
      // Strip time component — keep only the YYYY-MM-DD portion in UTC
      return new Date(parsed.toISOString().split('T')[0] + 'T00:00:00Z');
    };

    const rows: Array<{ data: StudentRow; rowNumber: number }> = [];
    const preErrors: Array<{ row: number; student: string; error: string }> = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      const first_name = cellToString(values[0]);
      const last_name = cellToString(values[1]);
      const dob = cellToString(values[2]);
      const gender = cellToString(values[3]);
      const class_name = cellToString(values[4]);
      const section_name = cellToString(values[5]);
      // Parent columns (columns 7-12)
      const father_name = cellToString(values[6]);
      const father_email = cellToString(values[7]);
      const father_phone = cellToString(values[8]);
      const mother_name = cellToString(values[9]);
      const mother_email = cellToString(values[10]);
      const mother_phone = cellToString(values[11]);

      const label = `${first_name || '?'} ${last_name || '?'}`;

      // Mandatory student fields
      const missing: string[] = [];
      if (!first_name) missing.push('first_name');
      if (!last_name) missing.push('last_name');
      if (!dob) missing.push('dob');
      if (!class_name) missing.push('class_name');
      // section_name is now optional
      if (missing.length) {
        preErrors.push({ row: rowNumber, student: label, error: `Missing mandatory fields: ${missing.join(', ')}.` });
        return;
      }

      // Parent identity: at least one parent must have BOTH email AND phone
      const fatherComplete = !!(father_email && father_phone);
      const motherComplete = !!(mother_email && mother_phone);
      if (!fatherComplete && !motherComplete) {
        preErrors.push({ row: rowNumber, student: label, error: 'At least one parent email and phone number is required for Scholaro app access.' });
        return;
      }

      rows.push({
        data: {
          first_name, last_name, dob, gender, class_name, section_name,
          father_name, father_email, father_phone, mother_name, mother_email, mother_phone,
        },
        rowNumber,
      });
    });

    if (!rows.length && !preErrors.length) {
      throw new BadRequestException('No valid student rows found in the file.');
    }

    // If ALL rows failed pre-validation, return early
    if (!rows.length) {
      return {
        success: true,
        successCount: 0,
        failureCount: preErrors.length,
        newClasses: 0,
        newSections: 0,
        parentsCreated: 0,
        parentsLinked: 0,
        errors: preErrors,
        message: `All ${preErrors.length} rows failed validation`,
      };
    }

    // ── Deduplicate rows within the file itself ──────────────────────────────
    // If the same student appears twice in the Excel, skip subsequent duplicates.
    const seenInFile = new Set<string>();
    const deduplicatedRows: typeof rows = [];
    for (const r of rows) {
      const normalize = (s: string) => s.trim().toLowerCase();
      const key = `${normalize(r.data.first_name)}:${normalize(r.data.last_name)}:${r.data.dob.trim()}`;
      if (seenInFile.has(key)) {
        preErrors.push({
          row: r.rowNumber,
          student: `${r.data.first_name} ${r.data.last_name}`,
          error: 'Duplicate row in file — same student already appears earlier in this upload.',
        });
      } else {
        seenInFile.add(key);
        deduplicatedRows.push(r);
      }
    }
    rows.splice(0, rows.length, ...deduplicatedRows);
    // ────────────────────────────────────────────────────────────────────────

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const createdClasses = new Set<string>();
    const createdSections = new Set<string>();
    const usedClasses = new Set<string>();
    const usedSections = new Set<string>();
    const classCache = new Map<string, Class>();
    const sectionCache = new Map<string, Section>();
    const parentUserCache = new Map<string, User>(); // email -> User
    let imported = 0;
    let skipped = preErrors.length;
    let parentsCreated = 0;
    let parentsLinked = 0;
    const errors: Array<{ row: number; student: string; error: string }> = [...preErrors];

    try {
      // Look up school name for welcome emails
      const tenant = await queryRunner.manager.findOne(Tenant, {
        where: { id: tenantId },
      });
      const schoolName = tenant?.name || 'Your School';
      const schoolCode = tenant?.tenant_code || '';

      // Collect welcome emails to send after commit (outside transaction)
      const welcomeEmails: Array<{ email: string; studentName: string; tempPassword: string }> = [];

      // Pre-fetch PARENT role
      const parentRole = await queryRunner.manager.findOne(Role, {
        where: { name: 'PARENT' },
      });

      // Pre-hash the default parent password once
      const defaultPasswordHash = await bcrypt.hash('Welcome@Scholaro2026', 10);

      // Auto-detect the active academic year for this tenant
      const activeAcademicYear = await queryRunner.manager.findOne(AcademicYear, {
        where: { tenant_id: tenantId, is_active: true },
      });
      if (!activeAcademicYear) {
        throw new BadRequestException(
          'No active academic year found for this tenant. Please create one before importing students.',
        );
      }

      let studentsUpdatedCount = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i].data;
        const rowNumber = rows[i].rowNumber;
        const studentLabel = `${row.first_name} ${row.last_name}`;

        // Per-row savepoint — if this row fails, roll back only this row's changes
        const savepointName = `row_${i}`;
        await queryRunner.query(`SAVEPOINT ${savepointName}`);

        try {
          // Step 1: Normalize class and section names (ignore case and spaces)
          const normalize = (name: string) => name.trim().toLowerCase().replace(/\s/g, '');
          const toTitleCase = (str: string) => str.trim().replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
          const sanitizedClassName = toTitleCase(row.class_name);
          const normalizedClassName = normalize(row.class_name);
          const sanitizedSectionName = row.section_name ? row.section_name.trim() : '';
          const normalizedSectionName = row.section_name ? normalize(row.section_name) : '';

          // Step 1a: Find or create class by normalized name
          let klass = classCache.get(normalizedClassName);
          if (!klass) {
            // Try to find by normalized name
            const allClasses = await queryRunner.manager.find(Class, { where: { tenant_id: tenantId } });
            klass = allClasses.find(c => normalize(c.name) === normalizedClassName);
            if (!klass) {
              klass = queryRunner.manager.create(Class, {
                tenant_id: tenantId,
                name: sanitizedClassName,
              });
              klass = await queryRunner.manager.save(Class, klass);
              createdClasses.add(sanitizedClassName);
            }
            classCache.set(normalizedClassName, klass);
          }
          usedClasses.add(sanitizedClassName);

          // Step 1b: Find or create section by normalized name (if provided)
          let section: Section | undefined = undefined;
          if (sanitizedSectionName) {
            const sectionKey = `${klass.id}:${normalizedSectionName}`;
            section = sectionCache.get(sectionKey);
            if (!section) {
              const allSections = await queryRunner.manager.find(Section, { where: { tenant_id: tenantId, class_id: klass.id } });
              section = allSections.find(
                (s) => normalize(s.name) === normalizedSectionName,
              );
              if (!section) {
                section = queryRunner.manager.create(Section, {
                  tenant_id: tenantId,
                  class_id: klass.id,
                  name: sanitizedSectionName,
                });
                section = await queryRunner.manager.save(Section, section);
                createdSections.add(
                  `${sanitizedClassName}-${sanitizedSectionName}`,
                );
              }
              sectionCache.set(sectionKey, section);
            }
            usedSections.add(`${sanitizedClassName}-${sanitizedSectionName}`);
          }

          // Step 1c: Upsert student by identity
          const displayFirstName = toTitleCase(row.first_name);
          const displayLastName = toTitleCase(row.last_name);
          const matchDob = parseDate(row.dob);

          // Use ILIKE for case-insensitive name match so re-uploads never create duplicates
          // regardless of what casing was used on the first import.
          let savedStudent = await queryRunner.manager
            .createQueryBuilder(Student, 's')
            .where('s.tenant_id = :tenantId', { tenantId })
            .andWhere('LOWER(s.first_name) = LOWER(:firstName)', { firstName: displayFirstName })
            .andWhere('LOWER(s.last_name) = LOWER(:lastName)', { lastName: displayLastName })
            .andWhere('s.date_of_birth = :dob', { dob: matchDob.toISOString().split('T')[0] })
            .getOne();
          if (savedStudent) {
            // Update student fields if changed
            savedStudent.gender = row.gender;
            savedStudent.first_name = displayFirstName;
            savedStudent.last_name = displayLastName;
            await queryRunner.manager.save(Student, savedStudent);
            studentsUpdatedCount++;
          } else {
            // Create new student
            const student = this.studentRepo.create({
              tenant_id: tenantId,
              first_name: displayFirstName,
              last_name: displayLastName,
              date_of_birth: matchDob,
              gender: row.gender,
              admission_date: new Date(),
              status: 'active',
            });
            savedStudent = await queryRunner.manager.save(student);
            imported++;
          }

          // Step 2: Upsert enrollment for this academic year
          let enrollment = await queryRunner.manager.findOne(Enrollment, {
            where: {
              tenant_id: tenantId,
              student_id: savedStudent.id,
              academic_year_id: activeAcademicYear.id,
            },
          });
          if (enrollment) {
            // Update class/section if changed
            enrollment.class_id = klass.id;
            enrollment.section_id = section?.id ?? null;
            enrollment.status = 'active';
            await queryRunner.manager.save(Enrollment, enrollment);
          } else {
            enrollment = this.enrollmentRepo.create({
              tenant_id: tenantId,
              student_id: savedStudent.id,
              class_id: klass.id,
              section_id: section?.id ?? null,
              academic_year_id: activeAcademicYear.id,
              roll_number: '',
              status: 'active',
            });
            enrollment = await queryRunner.manager.save(Enrollment, enrollment);
          }

          // Step 2b: Fee protection logic (skip fee creation if PAID exists for this enrollment/month)
          // Step 2b: Fee creation with 'PAID' protection
          // For demo: assume a single monthly fee structure per class, due on the 1st of each month
          const now = new Date();
          const yyyy = now.getFullYear();
          const mm = String(now.getMonth() + 1).padStart(2, '0');
          const monthStart = `${yyyy}-${mm}-01`;
          // const monthEnd = new Date(yyyy, now.getMonth() + 1, 0); // last day of month
          // Find fee structure for this class/section/academic year (simplified: first match)
          const feeStructure = await queryRunner.manager.findOne(FeeStructure, {
            where: {
              tenant_id: tenantId,
              class_id: klass.id,
              academic_year_id: activeAcademicYear.id,
            },
            order: { due_date: 'ASC' },
          });
          if (feeStructure) {
            // Check for existing fee for this enrollment and month
            const existingFee = await queryRunner.manager.findOne(Fee, {
              where: {
                tenant_id: tenantId,
                enrollment_id: enrollment.id,
                fee_structure_id: feeStructure.id,
                due_date: monthStart,
              },
            });
            if (existingFee) {
              if (existingFee.status === 'paid') {
                // Do not create new fee
              } else if (existingFee.status === 'pending') {
                // Update amount if changed (simulate: use feeStructure.amount)
                const newAmount = Number(feeStructure.amount);
                if (Number(existingFee.total_amount) !== newAmount) {
                  existingFee.total_amount = newAmount;
                  existingFee.final_amount = newAmount;
                  await queryRunner.manager.save(Fee, existingFee);
                }
              }
            } else {
              // No fee exists: create new pending fee
              const newFee = queryRunner.manager.create(Fee, {
                tenant_id: tenantId,
                enrollment_id: enrollment.id,
                fee_structure_id: feeStructure.id,
                description: feeStructure.name,
                total_amount: Number(feeStructure.amount),
                discount_amount: 0,
                final_amount: Number(feeStructure.amount),
                paid_amount: 0,
                due_date: monthStart,
                status: 'pending',
              });
              await queryRunner.manager.save(Fee, newFee);
            }
          }

          // Step 3: Handle Father
          if (row.father_email && parentRole) {
            const result = await this.findOrCreateParent(
              queryRunner,
              tenantId,
              row.father_email,
              row.father_name || `${row.last_name} (Father)`,
              row.father_phone,
              defaultPasswordHash,
              parentRole.id,
              parentUserCache,
            );
            if (result.created) {
              parentsCreated++;
              welcomeEmails.push({
                email: row.father_email,
                studentName: studentLabel,
                tempPassword: 'Welcome@Scholaro2026',
              });
            }
            await this.linkParentIfNew(
              queryRunner,
              tenantId,
              result.user.id,
              savedStudent.id!,
              'father',
            );
            parentsLinked++;
          }

          // Step 4: Handle Mother (same logic as father)
          if (row.mother_email && parentRole) {
            const result = await this.findOrCreateParent(
              queryRunner,
              tenantId,
              row.mother_email,
              row.mother_name || `${row.last_name} (Mother)`,
              row.mother_phone,
              defaultPasswordHash,
              parentRole.id,
              parentUserCache,
            );
            if (result.created) {
              parentsCreated++;
              welcomeEmails.push({
                email: row.mother_email,
                studentName: studentLabel,
                tempPassword: 'Welcome@Scholaro2026',
              });
            }
            await this.linkParentIfNew(
              queryRunner,
              tenantId,
              result.user.id,
              savedStudent.id!,
              'mother',
            );
            parentsLinked++;
          }

          // Row succeeded — release savepoint
          await queryRunner.query(`RELEASE SAVEPOINT ${savepointName}`);
        } catch (rowErr: any) {
          // Row failed — roll back only this row's changes, continue with next
          await queryRunner.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          skipped++;
          errors.push({
            row: rowNumber,
            student: studentLabel,
            error: (rowErr as Error)?.message || 'Unknown error',
          });
        }
      }

      await queryRunner.commitTransaction();

      // Send welcome emails after successful commit (rate-limited, fire-and-forget)
      const delay = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));
      void (async () => {
        for (const we of welcomeEmails) {
          await this.mailService.sendWelcomeEmail(
            we.email,
            we.studentName,
            schoolName,
            we.tempPassword,
            schoolCode,
          );
          await delay(600); // ~1.6 emails/sec to stay under Resend's 2/sec limit
        }
      })();

      const failureCount = skipped;
      const parts = [`Imported ${imported} students`];
      if (studentsUpdatedCount)
        parts.push(`updated ${studentsUpdatedCount} students`);
      if (createdClasses.size)
        parts.push(`created ${createdClasses.size} new classes`);
      if (createdSections.size)
        parts.push(`created ${createdSections.size} new sections`);
      if (parentsCreated)
        parts.push(`created ${parentsCreated} parent accounts`);
      if (parentsLinked)
        parts.push(`linked ${parentsLinked} parent-student relationships`);
      if (failureCount)
        parts.push(`${failureCount} rows failed`);

      console.log(`[BulkImport] COMPLETE — ${parts.join(', ')}. Classes used: [${[...usedClasses].join(', ')}], Sections used: [${[...usedSections].join(', ')}]`);

      return {
        success: true,
        successCount: imported,
        studentsUpdatedCount,
        failureCount,
        newClasses: createdClasses.size,
        newSections: createdSections.size,
        totalClassesUsed: usedClasses.size,
        totalSectionsUsed: usedSections.size,
        parentsCreated,
        parentsLinked,
        errors,
        message: parts.join(', '),
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async importTeachers(
    fileBuffer: Buffer | ArrayBuffer | Uint8Array,
    tenantId: string,
  ) {
    const workbook = new ExcelJS.Workbook();
    const nodeBuffer = this.toNodeBuffer(fileBuffer);

    // Try XLSX first, fall back to CSV
    try {
      await workbook.xlsx.load(nodeBuffer as any);
    } catch {
      try {
        const csvContent = nodeBuffer.toString('utf-8');
        const stream = new (require('stream').Readable)();
        stream.push(csvContent);
        stream.push(null);
        await workbook.csv.read(stream);
      } catch {
        throw new BadRequestException('Unable to parse file. Please upload a valid .xlsx or .csv file.');
      }
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new BadRequestException('No worksheet found');

    const cellToString = (val: any): string => {
      if (val === null || val === undefined) return '';
      if (val instanceof Date) return val.toISOString().split('T')[0];
      if (typeof val === 'object' && val.text) return String(val.text);
      if (typeof val === 'object' && val.result !== undefined) return String(val.result);
      return String(val).trim();
    };

    type TeacherRow = {
      name: string;
      email: string;
      phone?: string;
      qualification?: string;
      experience?: string;
    };
    const rows: TeacherRow[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      const name = cellToString(values[0]);
      const email = cellToString(values[1]);
      const phone = cellToString(values[2]);
      const qualification = cellToString(values[3]);
      const experience = cellToString(values[4]);
      if (name && email) {
        rows.push({
          name,
          email,
          phone: phone || undefined,
          qualification: qualification || undefined,
          experience: experience || undefined,
        });
      }
    });
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Look up school name & code for welcome emails
      const tenant = await queryRunner.manager.findOne(Tenant, {
        where: { id: tenantId },
      });
      const schoolName = tenant?.name || 'Your School';
      const schoolCode = tenant?.tenant_code || '';

      const welcomeEmails: Array<{ email: string; name: string }> = [];

      const teacherRole = await this.roleRepo.findOne({
        where: { name: 'TEACHER' },
      });
      if (!teacherRole) throw new BadRequestException('TEACHER role not found');
      for (const row of rows) {
        // Check duplicate email
        const existing = await this.userRepo.findOne({
          where: { email: row.email, tenant_id: tenantId },
        });
        if (existing) {
          throw new ConflictException(`Duplicate email: ${row.email}`);
        }
        // Create user
        const password_hash = await bcrypt.hash('Welcome@Scholaro2026', 10);
        const user = this.userRepo.create({
          name: row.name,
          email: row.email,
          password_hash,
          tenant_id: tenantId,
        });
        const savedUser = await queryRunner.manager.save(user);
        // Assign TEACHER role
        const userRole = this.userRoleRepo.create({
          user_id: savedUser.id,
          role_id: teacherRole.id,
          tenant_id: tenantId,
        });
        await queryRunner.manager.save(userRole);
        // Create teacher profile
        const teacher = this.teacherRepo.create({
          user_id: savedUser.id,
          tenant_id: tenantId,
          qualification: row.qualification || null,
          experience_years: row.experience ? parseInt(row.experience, 10) || null : null,
        });
        await queryRunner.manager.save(teacher);
        welcomeEmails.push({ email: row.email, name: row.name });
      }
      await queryRunner.commitTransaction();

      // Send welcome emails after successful commit (rate-limited, fire-and-forget)
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      void (async () => {
        for (const we of welcomeEmails) {
          await this.mailService.sendStaffWelcomeEmail(
            we.email, we.name, 'Teacher', schoolName, schoolCode, 'Welcome@Scholaro2026',
          );
          await delay(600); // ~1.6/s — stay under Resend free-tier 2/s limit
        }
      })();

      return { success: true, count: rows.length };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** Find an existing user by email, or create a new PARENT user + role assignment. */
  private async findOrCreateParent(
    queryRunner: import('typeorm').QueryRunner,
    tenantId: string,
    email: string,
    name: string,
    phone: string,
    passwordHash: string,
    parentRoleId: number,
    cache: Map<string, User>,
  ): Promise<{ user: User; created: boolean }> {
    const cacheKey = email.toLowerCase();
    const cached = cache.get(cacheKey);
    if (cached) return { user: cached, created: false };

    // Global email check — email must be unique across ALL tenants
    let user = await queryRunner.manager.findOne(User, {
      where: { email: cacheKey },
    });
    if (user) {
      cache.set(cacheKey, user);
      return { user, created: false };
    }

    // Create new parent user
    user = this.userRepo.create({
      name,
      email: cacheKey,
      password_hash: passwordHash,
      phone_number: phone || null,
      is_first_login: true,
      tenant_id: tenantId,
    });
    user = await queryRunner.manager.save(user);

    // Assign PARENT role
    const userRole = this.userRoleRepo.create({
      user_id: user.id,
      role_id: parentRoleId,
      tenant_id: tenantId,
    });
    await queryRunner.manager.save(userRole);

    cache.set(cacheKey, user);
    return { user, created: true };
  }

  /** Link a parent to a student if the relationship doesn't already exist. */
  private async linkParentIfNew(
    queryRunner: import('typeorm').QueryRunner,
    tenantId: string,
    parentUserId: string,
    studentId: string,
    relationship: string,
  ): Promise<void> {
    const existing = await queryRunner.manager.findOne(ParentStudent, {
      where: { parent_user_id: parentUserId, student_id: studentId, tenant_id: tenantId },
    });
    if (existing) return;

    const link = queryRunner.manager.create(ParentStudent, {
      tenant_id: tenantId,
      parent_user_id: parentUserId,
      student_id: studentId,
      relationship,
    });
    await queryRunner.manager.save(link);
  }
}
