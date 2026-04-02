import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParentsController } from './parents.controller';
import { ParentsService } from './parents.service';
import { ParentStudent } from './parent-student.entity';
import { Student } from '../students/student.entity';
import { Enrollment } from '../enrollments/enrollment.entity';
import { Attendance } from '../attendance/attendance.entity';
import { Fee } from '../fees/fee.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.entity';
import { Role } from '../users/role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ParentStudent,
      Student,
      Enrollment,
      Attendance,
      Fee,
      User,
      UserRole,
      Role,
    ]),
  ],
  controllers: [ParentsController],
  providers: [ParentsService],
})
export class ParentsModule {}
