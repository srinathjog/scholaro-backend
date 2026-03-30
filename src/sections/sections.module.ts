import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SectionsController } from './sections.controller';
import { SectionsService } from './sections.service';
import { Section } from './section.entity';
import { Class } from '../classes/class.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Section, Class])],
  controllers: [SectionsController],
  providers: [SectionsService],
})
export class SectionsModule {}
