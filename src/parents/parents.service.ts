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

  async getStudentAttendance(
    studentId: string,
    parentUserId: string,
    tenantId: string,
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
    // Find attendance records for these enrollments
    return this.attendanceRepo.find({
      where: { enrollment_id: In(enrollmentIds), tenant_id: tenantId },
    });
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
