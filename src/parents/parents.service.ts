import {
  Injectable,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ParentStudent } from './parent-student.entity';
import { LinkParentStudentDto } from './dto/link-parent-student.dto';
import { Student } from '../students/student.entity';
import { Enrollment } from '../enrollments/enrollment.entity';
import { Attendance } from '../attendance/attendance.entity';
import { Fee } from '../fees/fee.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.entity';
import { Role } from '../users/role.entity';
import { Tenant } from '../super-admin/tenant.entity';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class ParentsService {
  constructor(
    @InjectRepository(ParentStudent)
    private readonly parentStudentRepo: Repository<ParentStudent>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(Fee)
    private readonly feeRepo: Repository<Fee>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly mailService: MailService,
  ) {}

  async linkParentToStudent(dto: LinkParentStudentDto, tenantId: string) {
    // Prevent duplicate
    const exists = await this.parentStudentRepo.findOne({
      where: {
        parent_user_id: dto.parent_user_id,
        student_id: dto.student_id,
        tenant_id: tenantId,
      },
    });
    if (exists)
      throw new ConflictException('Parent already linked to this student');
    const link = this.parentStudentRepo.create({
      ...dto,
      tenant_id: tenantId,
    });
    return this.parentStudentRepo.save(link);
  }

  async getMyStudents(parentUserId: string, tenantId: string) {
    // Get all students linked to this parent in this tenant
    const links = await this.parentStudentRepo.find({
      where: { parent_user_id: parentUserId, tenant_id: tenantId },
    });
    const studentIds = links.map((l) => l.student_id);
    if (!studentIds.length) return [];
    return this.studentRepo.findByIds(studentIds);
  }

  async getMyChildren(parentUserId: string, tenantId: string) {
    // Single query: parent_students → students → enrollments → classes
    const rows = await this.parentStudentRepo.manager.query(
      `SELECT
         s.id            AS student_id,
         s.first_name,
         s.last_name,
         e.id            AS enrollment_id,
         e.class_id,
         e.section_id,
         e.roll_number,
         c.name          AS class_name
       FROM parent_students ps
       JOIN students s ON s.id = ps.student_id
       LEFT JOIN enrollments e ON e.student_id = s.id
         AND e.tenant_id = $2 AND e.status = 'active'
       LEFT JOIN classes c ON c.id = e.class_id AND c.tenant_id = $2
       WHERE ps.parent_user_id = $1 AND ps.tenant_id = $2`,
      [parentUserId, tenantId],
    );

    // Group rows by student
    const studentMap = new Map<string, any>();
    for (const row of rows) {
      if (!studentMap.has(row.student_id)) {
        studentMap.set(row.student_id, {
          id: row.student_id,
          first_name: row.first_name,
          last_name: row.last_name,
          enrollments: [],
        });
      }
      if (row.enrollment_id) {
        studentMap.get(row.student_id).enrollments.push({
          id: row.enrollment_id,
          class_id: row.class_id,
          section_id: row.section_id,
          roll_number: row.roll_number,
          className: row.class_name || null,
        });
      }
    }
    return [...studentMap.values()];
  }

  async getStudentAttendance(
    studentId: string,
    parentUserId: string,
    tenantId: string,
    date?: string,
  ) {
    // Validate parent-student relationship
    const link = await this.parentStudentRepo.findOne({
      where: {
        parent_user_id: parentUserId,
        student_id: studentId,
        tenant_id: tenantId,
      },
    });
    if (!link)
      throw new ForbiddenException('You do not have access to this student');
    // Find enrollments for this student
    const enrollments = await this.enrollmentRepo.find({
      where: { student_id: studentId, tenant_id: tenantId },
    });
    if (!enrollments.length) return [];
    const enrollmentIds = enrollments.map((e) => e.id);
    // Find attendance records for these enrollments, optionally filtered by date
    const where: any = { enrollment_id: In(enrollmentIds), tenant_id: tenantId };
    if (date) where.date = date;
    return this.attendanceRepo.find({ where });
  }

  async getStudentFees(
    studentId: string,
    parentUserId: string,
    tenantId: string,
  ) {
    const link = await this.parentStudentRepo.findOne({
      where: {
        parent_user_id: parentUserId,
        student_id: studentId,
        tenant_id: tenantId,
      },
    });
    if (!link)
      throw new ForbiddenException('You do not have access to this student');
    const enrollments = await this.enrollmentRepo.find({
      where: { student_id: studentId, tenant_id: tenantId },
    });
    if (!enrollments.length)
      return { fees: [], summary: { total_due: 0, total_paid: 0, current_balance: 0 } };
    const enrollmentIds = enrollments.map((e) => e.id);
    const fees = await this.feeRepo.find({
      where: enrollmentIds.map((eid) => ({ enrollment_id: eid, tenant_id: tenantId })),
      relations: ['feeStructure'],
      order: { due_date: 'DESC' },
    });

    let total_due = 0;
    let total_paid = 0;
    for (const fee of fees) {
      total_due += Number(fee.final_amount);
      total_paid += Number(fee.paid_amount);
    }

    return {
      fees,
      summary: {
        total_due,
        total_paid,
        current_balance: total_due - total_paid,
      },
    };
  }

  async createParent(
    dto: { name: string; email: string; password: string },
    tenantId: string,
  ) {
    // Check for duplicate email in tenant
    const existing = await this.userRepo.findOne({
      where: { email: dto.email, tenant_id: tenantId },
    });
    if (existing)
      throw new ConflictException('Email already registered for this tenant');
    // Hash password
    const password_hash = await bcrypt.hash(dto.password, 10);
    // Save user
    const user = this.userRepo.create({
      name: dto.name,
      email: dto.email,
      password_hash,
      tenant_id: tenantId,
    });
    const savedUser = await this.userRepo.save(user);
    // Assign PARENT role
    const role = await this.roleRepo.findOne({ where: { name: 'PARENT' } });
    if (!role) throw new ConflictException('PARENT role not found');
    const userRole = this.userRoleRepo.create({
      user_id: savedUser.id,
      role_id: role.id,
      tenant_id: tenantId,
    });
    await this.userRoleRepo.save(userRole);
    // Send parent welcome email (fire-and-forget)
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const schoolName = tenant?.name || 'Your School';
    this.mailService.sendWelcomeEmail(dto.email, dto.name, schoolName, dto.password, tenant?.tenant_code);
    // Optionally: create parent profile here
    return savedUser;
  }

  /** Admin: list all parents with their linked children for a tenant. */
  async listAllParents(tenantId: string, search?: string) {
    // Find all users with PARENT role in this tenant
    const parentRole = await this.roleRepo.findOne({ where: { name: 'PARENT' } });
    if (!parentRole) return [];

    const qb = this.userRoleRepo.createQueryBuilder('ur')
      .where('ur.role_id = :roleId', { roleId: parentRole.id })
      .andWhere('ur.tenant_id = :tenantId', { tenantId });
    const userRoles = await qb.getMany();
    if (!userRoles.length) return [];

    const parentUserIds = userRoles.map(ur => ur.user_id);

    // Fetch parent users
    const parents = await this.userRepo.find({
      where: parentUserIds.map(id => ({ id, tenant_id: tenantId })),
    });

    // Fetch all parent-student links for these parents
    const links = await this.parentStudentRepo.find({
      where: parentUserIds.map(id => ({ parent_user_id: id, tenant_id: tenantId })),
    });

    // Fetch all linked students
    const studentIds = [...new Set(links.map(l => l.student_id))];
    let studentMap: Record<string, Student> = {};
    if (studentIds.length) {
      const students = await this.studentRepo.findByIds(studentIds);
      studentMap = Object.fromEntries(students.map(s => [s.id, s]));
    }

    // Build response
    let result = parents.map(p => {
      const childLinks = links.filter(l => l.parent_user_id === p.id);
      const children = childLinks.map(l => {
        const s = studentMap[l.student_id];
        return s ? {
          id: s.id,
          name: `${s.first_name} ${s.last_name}`,
          relationship: l.relationship,
        } : null;
      }).filter(Boolean);
      return {
        id: p.id,
        name: p.name,
        email: p.email,
        status: p.status,
        created_at: p.created_at,
        children,
      };
    });

    // Client-side search filter (name, email, or child's name)
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.children.some((c: any) => c.name.toLowerCase().includes(q)),
      );
    }

    return result;
  }

  /** Admin: reset a parent's password to the default Welcome@Scholaro2026. */
  async resetParentPassword(parentUserId: string, tenantId: string) {
    const user = await this.userRepo.findOne({
      where: { id: parentUserId, tenant_id: tenantId },
    });
    if (!user) throw new NotFoundException('Parent not found');

    // Verify this user actually has the PARENT role
    const parentRole = await this.roleRepo.findOne({ where: { name: 'PARENT' } });
    if (!parentRole) throw new NotFoundException('PARENT role not found');
    const hasRole = await this.userRoleRepo.findOne({
      where: { user_id: parentUserId, role_id: parentRole.id, tenant_id: tenantId },
    });
    if (!hasRole) throw new ForbiddenException('This user is not a parent');

    user.password_hash = await bcrypt.hash('Welcome@Scholaro2026', 10);
    await this.userRepo.save(user);
    return { message: 'Password reset to default successfully' };
  }
}
