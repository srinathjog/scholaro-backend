import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';
import { Enrollment } from './enrollment.entity';
import { Fee } from '../fees/fee.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Enrollment, Fee])],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
})
export class EnrollmentsModule {}
