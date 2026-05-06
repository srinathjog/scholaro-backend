import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { Class } from './class.entity';
import { Enrollment } from '../enrollments/enrollment.entity';
import { Section } from '../sections/section.entity';
import { TeacherAssignment } from '../teacher-assignments/teacher-assignment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Class, Enrollment, Section, TeacherAssignment])],
  controllers: [ClassesController],
  providers: [ClassesService],
})
export class ClassesModule {}
