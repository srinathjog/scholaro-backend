
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BulkImportController } from './bulk-import.controller';
import { BulkImportService } from './bulk-import.service';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.entity';
import { Role } from '../users/role.entity';

import { Teacher } from '../teachers/teacher.entity';
import { Student } from '../students/student.entity';
import { Class } from '../classes/class.entity';
import { Section } from '../sections/section.entity';
import { Enrollment } from '../enrollments/enrollment.entity';
import { AcademicYear } from '../academic-years/academic-year.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User, UserRole, Role, Teacher,
      Student, Class, Section, Enrollment, AcademicYear
    ]),
  ],
  controllers: [BulkImportController],
  providers: [BulkImportService],
})
export class BulkImportModule {}
