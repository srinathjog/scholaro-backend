import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, ILike } from 'typeorm';
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
    const student = this.studentRepository.create({
      ...createStudentDto,
      tenant_id: tenantId,
    });
    return this.studentRepository.save(student);
  }

  async getAllStudents(tenantId: string): Promise<Student[]> {
    return this.studentRepository.find({ where: { tenant_id: tenantId } });
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
    const classIds = [...new Set(enrollments.map(e => e.class_id))];
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
      enrollments: enrollments.map(e => ({
        id: e.id,
        class_id: e.class_id,
        section_id: e.section_id,
        className: classMap[e.class_id] || null,
        status: e.status,
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
      where: { parent_user_id: parentUserId, student_id: studentId, tenant_id: tenantId },
    });
    if (existing) throw new ConflictException('Parent already linked to this student');

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
      this.mailService.sendWelcomeEmail(dto.email, student.first_name || dto.name, schoolName, 'Welcome@Scholaro2026', tenant?.tenant_code);
    }

    // Link to student
    const existing = await this.parentStudentRepo.findOne({
      where: { parent_user_id: user.id, student_id: studentId, tenant_id: tenantId },
    });
    if (existing) throw new ConflictException('Parent already linked to this student');

    const link = this.parentStudentRepo.create({
      tenant_id: tenantId,
      parent_user_id: user.id,
      student_id: studentId,
      relationship: dto.relationship,
    });
    await this.parentStudentRepo.save(link);

    return { parent_user_id: user.id, name: user.name, email: user.email, relationship: dto.relationship };
  }
}
