import { Test, TestingModule } from '@nestjs/testing';
import { DailyLogsController } from './daily-logs.controller';

describe('DailyLogsController', () => {
  let controller: DailyLogsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DailyLogsController],
    }).compile();

    controller = module.get<DailyLogsController>(DailyLogsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
