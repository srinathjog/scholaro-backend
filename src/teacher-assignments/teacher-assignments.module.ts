import { Module } from '@nestjs/common';
import { TeacherAssignmentsController } from './teacher-assignments.controller';
import { TeacherAssignmentsService } from './teacher-assignments.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherAssignment } from './teacher-assignment.entity';
import { Class } from '../classes/class.entity';
import { Section } from '../sections/section.entity';
import { AcademicYear } from '../academic-years/academic-year.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TeacherAssignment,
      Class,
      Section,
      AcademicYear,
    ]),
  ],
  controllers: [TeacherAssignmentsController],
  providers: [TeacherAssignmentsService],
  exports: [TeacherAssignmentsService],
})
export class TeacherAssignmentsModule {}
