
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

@Module({
  imports: [TypeOrmModule.forFeature([
    Student, ParentStudent, User, UserRole, Role, Enrollment,
  ])],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
