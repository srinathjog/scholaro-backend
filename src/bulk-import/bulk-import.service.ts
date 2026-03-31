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
  ) {}

  /**
   * Import students from Excel file.
   * Columns: first_name, last_name, dob, gender, class_name, section_name, academic_year
   * For each row: create class/section if not exist, create student, create enrollment.
   * Returns: { success: true, imported: N, newClasses: X, newSections: Y }
   */
  async importStudents(
    fileBuffer: Buffer | ArrayBuffer | Uint8Array,
    tenantId: string,
  ) {
    const workbook = new ExcelJS.Workbook();
    let nodeBuffer;
    if (Buffer.isBuffer(fileBuffer)) {
      nodeBuffer = Buffer.from(new Uint8Array(fileBuffer));
    } else if (fileBuffer instanceof Uint8Array) {
      nodeBuffer = Buffer.from(fileBuffer);
    } else if (fileBuffer instanceof ArrayBuffer) {
      nodeBuffer = Buffer.from(new Uint8Array(fileBuffer));
    } else {
      throw new BadRequestException('Invalid file buffer type');
    }
    await workbook.xlsx.load(nodeBuffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new BadRequestException('No worksheet found');

    type StudentRow = {
      first_name: string;
      last_name: string;
      dob: string;
      gender: string;
      class_name: string;
      section_name: string;
      academic_year: string;
    };
    const rows: StudentRow[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      const [
        first_name,
        last_name,
        dob,
        gender,
        class_name,
        section_name,
        academic_year,
      ] = values;
      if (
        typeof first_name === 'string' &&
        typeof last_name === 'string' &&
        typeof dob === 'string' &&
        typeof gender === 'string' &&
        typeof class_name === 'string' &&
        typeof section_name === 'string' &&
        typeof academic_year === 'string'
      ) {
        rows.push({
          first_name,
          last_name,
          dob,
          gender,
          class_name,
          section_name,
          academic_year,
        });
      }
    });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    const createdClasses = new Set<string>();
    const createdSections = new Set<string>();
    let imported = 0;
    try {
      for (const row of rows) {
        // 1. Find or create class
        let klass = await this.classRepo.findOne({
          where: { tenant_id: tenantId, name: row.class_name },
        });
        if (!klass) {
          klass = this.classRepo.create({
            tenant_id: tenantId,
            name: row.class_name,
          });
          klass = await queryRunner.manager.save(klass);
          createdClasses.add(row.class_name);
        }

        // 2. Find or create section
        let section = await this.sectionRepo.findOne({
          where: {
            tenant_id: tenantId,
            class_id: klass.id,
            name: row.section_name,
          },
        });
        if (!section) {
          section = this.sectionRepo.create({
            tenant_id: tenantId,
            class_id: klass.id,
            name: row.section_name,
          });
          section = await queryRunner.manager.save(section);
          createdSections.add(`${row.class_name}-${row.section_name}`);
        }

        // 3. Find academic year
        const academicYear = await this.academicYearRepo.findOne({
          where: { tenant_id: tenantId, year: row.academic_year },
        });
        if (!academicYear) {
          throw new BadRequestException(
            `Academic year not found: ${row.academic_year}`,
          );
        }

        // 4. Create student
        const student = this.studentRepo.create({
          tenant_id: tenantId,
          first_name: row.first_name,
          last_name: row.last_name,
          date_of_birth: new Date(row.dob),
          gender: row.gender,
          admission_date: new Date(),
          status: 'active',
        });
        const savedStudent = await queryRunner.manager.save(student);

        // 5. Create enrollment
        const enrollment = this.enrollmentRepo.create({
          tenant_id: tenantId,
          student_id: savedStudent.id,
          class_id: klass.id,
          section_id: section.id,
          academic_year_id: academicYear.id,
          roll_number: '', // Can be generated or left blank
          status: 'active',
        });
        await queryRunner.manager.save(enrollment);
        imported++;
      }
      await queryRunner.commitTransaction();
      return {
        success: true,
        imported,
        newClasses: createdClasses.size,
        newSections: createdSections.size,
        message: `Successfully imported ${imported} students and created ${createdClasses.size} new classes`,
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
    // Always convert input to a Node.js Buffer for exceljs compatibility
    let nodeBuffer;
    if (Buffer.isBuffer(fileBuffer)) {
      nodeBuffer = Buffer.from(new Uint8Array(fileBuffer));
    } else if (fileBuffer instanceof Uint8Array) {
      nodeBuffer = Buffer.from(fileBuffer);
    } else if (fileBuffer instanceof ArrayBuffer) {
      nodeBuffer = Buffer.from(new Uint8Array(fileBuffer));
    } else {
      throw new BadRequestException('Invalid file buffer type');
    }
    await workbook.xlsx.load(nodeBuffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new BadRequestException('No worksheet found');
    type TeacherRow = {
      name: string;
      email: string;
      phone?: string;
      qualification?: string;
      experience?: string;
    };
    const rows: TeacherRow[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      // row.values is [empty, ...columns], so slice(1)
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      const [name, email, phone, qualification, experience] = values;
      // Only push if name and email are strings
      if (typeof name === 'string' && typeof email === 'string') {
        rows.push({
          name,
          email,
          phone:
            typeof phone === 'string' || typeof phone === 'number'
              ? String(phone)
              : undefined,
          qualification:
            typeof qualification === 'string' ? qualification : undefined,
          experience:
            typeof experience === 'string' || typeof experience === 'number'
              ? String(experience)
              : undefined,
        });
      }
    });
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
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
        const password_hash = await bcrypt.hash('Welcome@123', 10);
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
          user: savedUser,
          tenantId,
          firstName: row.name,
          email: row.email,
          phone: row.phone,
          // Add qualification, experience if needed
        });
        await queryRunner.manager.save(teacher);
      }
      await queryRunner.commitTransaction();
      return { success: true, count: rows.length };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
