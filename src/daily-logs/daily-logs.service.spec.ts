import { Test, TestingModule } from '@nestjs/testing';
import { DailyLogsService } from './daily-logs.service';

describe('DailyLogsService', () => {
  let service: DailyLogsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DailyLogsService],
    }).compile();

    service = module.get<DailyLogsService>(DailyLogsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
