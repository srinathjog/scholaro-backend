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

    /** Parse date string in DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, or MM/DD/YYYY formats */
    const parseDate = (raw: string): Date => {
      // Already YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(raw + 'T00:00:00');
      // DD/MM/YYYY or DD-MM-YYYY
      const dmyMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmyMatch) {
        const [, d, m, y] = dmyMatch;
        return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00`);
      }
      // Fallback
      const d = new Date(raw);
      if (isNaN(d.getTime())) throw new Error(`Invalid date format: "${raw}". Use DD/MM/YYYY or YYYY-MM-DD.`);
      return d;
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
      if (!section_name) missing.push('section_name');
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

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const createdClasses = new Set<string>();
    const createdSections = new Set<string>();
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

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i].data;
        const rowNumber = rows[i].rowNumber;
        const studentLabel = `${row.first_name} ${row.last_name}`;

        // Per-row savepoint — if this row fails, roll back only this row's changes
        const savepointName = `row_${i}`;
        await queryRunner.query(`SAVEPOINT ${savepointName}`);

        try {

          // Step 1: Find or create class
          const classKey = row.class_name;
          let klass = classCache.get(classKey);
          if (!klass) {
            klass = await queryRunner.manager.findOne(Class, {
              where: { tenant_id: tenantId, name: row.class_name },
            }) ?? undefined;
            if (!klass) {
              klass = this.classRepo.create({
                tenant_id: tenantId,
                name: row.class_name,
              });
              klass = await queryRunner.manager.save(klass);
              createdClasses.add(row.class_name);
            }
            classCache.set(classKey, klass);
          }

          // Step 1b: Find or create section
          const sectionKey = `${klass.id}:${row.section_name}`;
          let section = sectionCache.get(sectionKey);
          if (!section) {
            section = await queryRunner.manager.findOne(Section, {
              where: {
                tenant_id: tenantId,
                class_id: klass.id,
                name: row.section_name,
              },
            }) ?? undefined;
            if (!section) {
              section = this.sectionRepo.create({
                tenant_id: tenantId,
                class_id: klass.id,
                name: row.section_name,
              });
              section = await queryRunner.manager.save(section);
              createdSections.add(`${row.class_name}-${row.section_name}`);
            }
            sectionCache.set(sectionKey, section);
          }

          // Step 1c: Create student
          const student = this.studentRepo.create({
            tenant_id: tenantId,
            first_name: row.first_name,
            last_name: row.last_name,
            date_of_birth: parseDate(row.dob),
            gender: row.gender,
            admission_date: new Date(),
            status: 'active',
          });
          const savedStudent = await queryRunner.manager.save(student);

          // Step 2: Create enrollment (uses auto-detected active academic year)
          const enrollment = this.enrollmentRepo.create({
            tenant_id: tenantId,
            student_id: savedStudent.id,
            class_id: klass.id,
            section_id: section.id,
            academic_year_id: activeAcademicYear.id,
            roll_number: '',
            status: 'active',
          });
          await queryRunner.manager.save(enrollment);

          // Step 3: Handle Father
          if (row.father_email && parentRole) {
            const result = await this.findOrCreateParent(
              queryRunner, tenantId, row.father_email,
              row.father_name || `${row.last_name} (Father)`,
              row.father_phone, defaultPasswordHash, parentRole.id, parentUserCache,
            );
            if (result.created) {
              parentsCreated++;
              welcomeEmails.push({ email: row.father_email, studentName: studentLabel, tempPassword: 'Welcome@Scholaro2026' });
            }
            await this.linkParentIfNew(
              queryRunner, tenantId, result.user.id, savedStudent.id!, 'father',
            );
            parentsLinked++;
          }

          // Step 4: Handle Mother (same logic as father)
          if (row.mother_email && parentRole) {
            const result = await this.findOrCreateParent(
              queryRunner, tenantId, row.mother_email,
              row.mother_name || `${row.last_name} (Mother)`,
              row.mother_phone, defaultPasswordHash, parentRole.id, parentUserCache,
            );
            if (result.created) {
              parentsCreated++;
              welcomeEmails.push({ email: row.mother_email, studentName: studentLabel, tempPassword: 'Welcome@Scholaro2026' });
            }
            await this.linkParentIfNew(
              queryRunner, tenantId, result.user.id, savedStudent.id!, 'mother',
            );
            parentsLinked++;
          }

          // Row succeeded — release savepoint
          await queryRunner.query(`RELEASE SAVEPOINT ${savepointName}`);
          imported++;
        } catch (rowErr: any) {
          // Row failed — roll back only this row's changes, continue with next
          await queryRunner.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          skipped++;
          errors.push({
            row: rowNumber,
            student: studentLabel,
            error: rowErr.message || 'Unknown error',
          });
        }
      }

      await queryRunner.commitTransaction();

      // Send welcome emails after successful commit (rate-limited, fire-and-forget)
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      (async () => {
        for (const we of welcomeEmails) {
          this.mailService.sendWelcomeEmail(we.email, we.studentName, schoolName, we.tempPassword, schoolCode);
          await delay(600); // ~1.6 emails/sec to stay under Resend's 2/sec limit
        }
      })();

      const failureCount = skipped;
      const parts = [`Imported ${imported} students`];
      if (parentsCreated) parts.push(`created ${parentsCreated} parent accounts`);
      if (parentsLinked) parts.push(`linked ${parentsLinked} parent-student relationships`);
      if (failureCount) parts.push(`${failureCount} rows failed`);

      return {
        success: true,
        successCount: imported,
        failureCount,
        newClasses: createdClasses.size,
        newSections: createdSections.size,
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

      // Send welcome emails after successful commit (fire-and-forget)
      for (const we of welcomeEmails) {
        this.mailService.sendStaffWelcomeEmail(
          we.email, we.name, 'Teacher', schoolName, schoolCode, 'Welcome@Scholaro2026',
        );
      }

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
