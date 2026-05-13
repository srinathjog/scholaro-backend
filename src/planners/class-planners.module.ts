import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassPlannersController } from './class-planners.controller';
import { ClassPlannersService } from './class-planners.service';
import { ClassPlanner } from './class-planner.entity';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([ClassPlanner]), StorageModule],
  controllers: [ClassPlannersController],
  providers: [ClassPlannersService],
})
export class ClassPlannersModule {}
