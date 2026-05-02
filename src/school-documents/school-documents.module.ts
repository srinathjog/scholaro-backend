import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolDocumentsController } from './school-documents.controller';
import { SchoolDocumentsService } from './school-documents.service';
import { SchoolDocument } from './school-document.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SchoolDocument])],
  controllers: [SchoolDocumentsController],
  providers: [SchoolDocumentsService],
})
export class SchoolDocumentsModule {}
