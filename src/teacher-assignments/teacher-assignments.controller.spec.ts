import { Test, TestingModule } from '@nestjs/testing';
import { TeacherAssignmentsController } from './teacher-assignments.controller';

describe('TeacherAssignmentsController', () => {
  let controller: TeacherAssignmentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeacherAssignmentsController],
    }).compile();

    controller = module.get<TeacherAssignmentsController>(TeacherAssignmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
