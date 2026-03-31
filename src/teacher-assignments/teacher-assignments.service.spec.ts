import { Test, TestingModule } from '@nestjs/testing';
import { TeacherAssignmentsService } from './teacher-assignments.service';

describe('TeacherAssignmentsService', () => {
  let service: TeacherAssignmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TeacherAssignmentsService],
    }).compile();

    service = module.get<TeacherAssignmentsService>(TeacherAssignmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
