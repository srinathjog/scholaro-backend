import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Student } from './student.entity';
import { CreateStudentDto } from './dto/create-student.dto';
import { ParentStudent } from '../parents/parent-student.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.entity';
import { Role } from '../users/role.entity';
import { Enrollment } from '../enrollments/enrollment.entity';
import { Tenant } from '../super-admin/tenant.entity';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
    @InjectRepository(ParentStudent)
    private readonly parentStudentRepo: Repository<ParentStudent>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly mailService: MailService,
    private readonly dataSource: DataSource,
  ) {}

  async createStudent(
    createStudentDto: CreateStudentDto,
    tenantId: string,
  ): Promise<Student> {
    const { class_id, academic_year_id, section_id, ...studentFields } = createStudentDto;

    if (class_id && academic_year_id) {
      // Capture narrowed values so TypeScript doesn't lose the type inside the async callback
      const resolvedClassId = class_id;
      const resolvedYearId = academic_year_id;
      const resolvedSectionId = section_id ?? null;

      return this.dataSource.transaction(async (manager) => {
        const student = manager.create(Student, {
          ...studentFields,
          tenant_id: tenantId,
        });
        const saved = await manager.save(Student, student);

        const enrollment = manager.create(Enrollment, {
          student_id: saved.id,
          class_id: resolvedClassId,
          academic_year_id: resolvedYearId,
          section_id: resolvedSectionId,
          roll_number: '',
          status: 'active',
          tenant_id: tenantId,
        });
        await manager.save(Enrollment, enrollment);

        return saved;
      });
    }

    const student = this.studentRepository.create({
      ...studentFields,
      tenant_id: tenantId,
    });
    return this.studentRepository.save(student);
  }

  async getAllStudents(tenantId: string) {
    const students = await this.studentRepository.find({
      where: { tenant_id: tenantId },
      order: { first_name: 'ASC' },
    });

    if (students.length === 0) return [];

    // Batch-fetch active enrollments with class + section names
    const studentIds = students.map((s) => s.id);
    const rows: Array<{
      student_id: string;
      class_name: string;
      section_name: string | null;
    }> = await this.dataSource.query(
      `SELECT e.student_id,
              c.name AS class_name,
              s.name AS section_name
       FROM enrollments e
       INNER JOIN classes c ON c.id = e.class_id
       LEFT JOIN sections s ON s.id = e.section_id
       WHERE e.tenant_id = $1
         AND e.status = 'active'
         AND e.student_id = ANY($2)`,
      [tenantId, studentIds],
    );

    const enrollMap = new Map<
      string,
      { class_name: string; section_name: string | null }
    >();
    for (const row of rows) {
      // Take the first active enrollment per student
      if (!enrollMap.has(row.student_id)) {
        enrollMap.set(row.student_id, {
          class_name: row.class_name,
          section_name: row.section_name,
        });
      }
    }

    return students.map((s) => {
      const enrollment = enrollMap.get(s.id!);
      return {
        ...s,
        current_class: enrollment?.class_name || null,
        current_section: enrollment?.section_name || null,
      };
    });
  }

  async getStudentById(id: string, tenantId: string): Promise<Student | null> {
    return this.studentRepository.findOne({
      where: { id, tenant_id: tenantId },
    });
  }

  async getStudentDetail(id: string, tenantId: string) {
    const student = await this.studentRepository.findOne({
      where: { id, tenant_id: tenantId },
    });
    if (!student) throw new BadRequestException('Student not found');

    // Get linked parents
    const links = await this.parentStudentRepo.find({
      where: { student_id: id, tenant_id: tenantId },
    });

    const parents: Array<{
      parent_user_id: string;
      relationship: string;
      name: string;
      email: string;
    }> = [];

    for (const link of links) {
      const user = await this.userRepo.findOne({
        where: { id: link.parent_user_id },
      });
      if (user) {
        parents.push({
          parent_user_id: user.id,
          relationship: link.relationship,
          name: user.name,
          email: user.email,
        });
      }
    }

    // Get enrollments
    const enrollments = await this.enrollmentRepo.find({
      where: { student_id: id, tenant_id: tenantId, status: 'active' },
    });

    // Fetch class names for enrollments
    let classMap: Record<string, string> = {};
    const classIds = [...new Set(enrollments.map((e) => e.class_id))];
    if (classIds.length) {
      const classes = await this.dataSource.query(
        `SELECT id, name FROM classes WHERE tenant_id = $1 AND id = ANY($2)`,
        [tenantId, classIds],
      );
      classMap = Object.fromEntries(classes.map((c: any) => [c.id, c.name]));
    }

    return {
      ...student,
      parents,
      enrollments: enrollments.map((e) => ({
        id: e.id,
        class_id: e.class_id,
        section_id: e.section_id,
        className: classMap[e.class_id] || null,
        status: e.status,
        custom_fee_amount: e.custom_fee_amount ?? null,
      })),
    };
  }

  async searchParentsByEmail(email: string, tenantId: string) {
    if (!email || email.length < 2) return [];
    const users = await this.dataSource.query(
      `SELECT u.id, u.name, u.email
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id AND ur.tenant_id = $1
       JOIN roles r ON r.id = ur.role_id AND r.name = 'PARENT'
       WHERE u.tenant_id = $1 AND u.email ILIKE $2
       LIMIT 10`,
      [tenantId, `%${email}%`],
    );
    return users;
  }

  async linkParentToStudent(
    studentId: string,
    parentUserId: string,
    relationship: string,
    tenantId: string,
  ) {
    // Validate student belongs to tenant
    const student = await this.studentRepository.findOne({
      where: { id: studentId, tenant_id: tenantId },
    });
    if (!student) throw new BadRequestException('Student not found');

    // Check parent user exists
    const parentUser = await this.userRepo.findOne({
      where: { id: parentUserId, tenant_id: tenantId },
    });
    if (!parentUser) throw new BadRequestException('Parent user not found');

    // Prevent duplicate
    const existing = await this.parentStudentRepo.findOne({
      where: {
        parent_user_id: parentUserId,
        student_id: studentId,
        tenant_id: tenantId,
      },
    });
    if (existing)
      throw new ConflictException('Parent already linked to this student');

    const link = this.parentStudentRepo.create({
      tenant_id: tenantId,
      parent_user_id: parentUserId,
      student_id: studentId,
      relationship,
    });
    return this.parentStudentRepo.save(link);
  }

  async createAndLinkParent(
    studentId: string,
    dto: { name: string; email: string; phone?: string; relationship: string },
    tenantId: string,
  ) {
    // Validate student
    const student = await this.studentRepository.findOne({
      where: { id: studentId, tenant_id: tenantId },
    });
    if (!student) throw new BadRequestException('Student not found');

    // Check for existing user with this email
    let user = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase(), tenant_id: tenantId },
    });

    if (!user) {
      // Create user with default password
      const passwordHash = await bcrypt.hash('Welcome@Scholaro2026', 10);
      user = this.userRepo.create({
        name: dto.name,
        email: dto.email.toLowerCase(),
        password_hash: passwordHash,
        tenant_id: tenantId,
      });
      user = await this.userRepo.save(user);

      // Assign PARENT role
      const role = await this.roleRepo.findOne({ where: { name: 'PARENT' } });
      if (role) {
        const userRole = this.userRoleRepo.create({
          user_id: user.id,
          role_id: role.id,
          tenant_id: tenantId,
        });
        await this.userRoleRepo.save(userRole);
      }

      // Send parent welcome email (fire-and-forget)
      const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
      const schoolName = tenant?.name || 'Your School';
      this.mailService.sendWelcomeEmail(
        dto.email,
        student.first_name || dto.name,
        schoolName,
        'Welcome@Scholaro2026',
        tenant?.tenant_code,
      );
    }

    // Link to student
    const existing = await this.parentStudentRepo.findOne({
      where: {
        parent_user_id: user.id,
        student_id: studentId,
        tenant_id: tenantId,
      },
    });
    if (existing)
      throw new ConflictException('Parent already linked to this student');

    const link = this.parentStudentRepo.create({
      tenant_id: tenantId,
      parent_user_id: user.id,
      student_id: studentId,
      relationship: dto.relationship,
    });
    await this.parentStudentRepo.save(link);

    return {
      parent_user_id: user.id,
      name: user.name,
      email: user.email,
      relationship: dto.relationship,
    };
  }

  async getStudentsByClass(
    classId: string,
    sectionId: string | undefined,
    tenantId: string,
  ): Promise<{ id: string; first_name: string; last_name: string }[]> {
    // Single JOIN query: students enrolled in the class, filtered by tenant
    const params: string[] = [tenantId, classId];
    let sectionFilter = '';
    if (sectionId) {
      sectionFilter = 'AND e.section_id = $3';
      params.push(sectionId);
    }

    const rows: { id: string; first_name: string; last_name: string }[] =
      await this.dataSource.query(
        `SELECT s.id, s.first_name, s.last_name
         FROM students s
         INNER JOIN enrollments e ON e.student_id = s.id
         WHERE e.tenant_id = $1
           AND e.class_id = $2
           ${sectionFilter}
           AND e.status = 'active'
           AND s.tenant_id = $1
           AND s.status != 'inactive'
         ORDER BY s.first_name ASC`,
        params,
      );

    return rows;
  }

  async setStudentStatus(
    id: string,
    status: 'active' | 'inactive',
    tenantId: string,
  ): Promise<Student> {
    const student = await this.studentRepository.findOne({
      where: { id, tenant_id: tenantId },
    });
    if (!student) throw new BadRequestException('Student not found');
    student.status = status;
    return this.studentRepository.save(student);
  }

  /**
   * Returns bio-data rows for all active students in a class,
   * including academic year, section, and their first-ever joining class.
   */
  async exportClassBioData(classId: string, tenantId: string) {
    const rows: Array<{
      name: string;
      date_of_birth: string;
      gender: string;
      status: string;
      admission_date: string;
      class_name: string;
      section_name: string | null;
      academic_year: string;
      joining_class: string | null;
    }> = await this.dataSource.query(
      `SELECT
         s.first_name || ' ' || s.last_name  AS name,
         s.date_of_birth,
         s.gender,
         s.status,
         s.admission_date,
         c.name                              AS class_name,
         sec.name                            AS section_name,
         ay.year                             AS academic_year,
         jc.name                             AS joining_class
       FROM enrollments e
       INNER JOIN students      s   ON s.id    = e.student_id
       INNER JOIN classes       c   ON c.id    = e.class_id
       LEFT  JOIN sections      sec ON sec.id  = e.section_id
       INNER JOIN academic_years ay ON ay.id   = e.academic_year_id
       LEFT  JOIN (
         SELECT DISTINCT ON (fe.student_id)
           fe.student_id,
           jcl.name
         FROM   enrollments fe
         INNER  JOIN classes jcl ON jcl.id = fe.class_id
         WHERE  fe.tenant_id = $1
         ORDER  BY fe.student_id, fe.created_at ASC
       ) jc ON jc.student_id = s.id
       WHERE e.tenant_id = $1
         AND e.class_id  = $2
         AND e.status    = 'active'
         AND s.tenant_id = $1
       ORDER BY s.first_name ASC`,
      [tenantId, classId],
    );
    return rows;
  }
}
