import {
  Injectable,
  ForbiddenException,
  ConflictException,
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
    const links = await this.parentStudentRepo.find({
      where: { parent_user_id: parentUserId, tenant_id: tenantId },
    });
    const studentIds = links.map((l) => l.student_id);
    if (!studentIds.length) return [];

    // Get students with their active enrollments + class name
    const students = await this.studentRepo.findByIds(studentIds);
    const enrollments = await this.enrollmentRepo.find({
      where: studentIds.map((sid) => ({
        student_id: sid,
        tenant_id: tenantId,
        status: 'active',
      })),
      relations: ['student'],
    });

    // Also fetch class names
    const classIds = [...new Set(enrollments.map((e) => e.class_id))];
    let classMap: Record<string, string> = {};
    if (classIds.length) {
      const classes = await this.enrollmentRepo.manager
        .getRepository('classes')
        .find({ where: classIds.map((id) => ({ id, tenant_id: tenantId })) });
      classMap = Object.fromEntries(classes.map((c: any) => [c.id, c.name]));
    }

    return students.map((s) => {
      const studentEnrollments = enrollments
        .filter((e) => e.student_id === s.id)
        .map((e) => ({
          id: e.id,
          class_id: e.class_id,
          section_id: e.section_id,
          roll_number: e.roll_number,
          className: classMap[e.class_id] || null,
        }));
      return {
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        enrollments: studentEnrollments,
      };
    });
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
    // Optionally: create parent profile here
    return savedUser;
  }
}
