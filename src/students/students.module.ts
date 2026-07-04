
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { Student } from './student.entity';
import { ParentStudent } from '../parents/parent-student.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.entity';
import { Role } from '../users/role.entity';
import { Enrollment } from '../enrollments/enrollment.entity';
import { Tenant } from '../super-admin/tenant.entity';
import { Class } from '../classes/class.entity';
import { Section } from '../sections/section.entity';
import { Lead } from '../leads/lead.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    Student, ParentStudent, User, UserRole, Role, Enrollment, Tenant, Class, Section, Lead,
  ])],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
