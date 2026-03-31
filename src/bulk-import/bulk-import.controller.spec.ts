import { Test, TestingModule } from '@nestjs/testing';
import { BulkImportController } from './bulk-import.controller';

describe('BulkImportController', () => {
  let controller: BulkImportController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BulkImportController],
    }).compile();

    controller = module.get<BulkImportController>(BulkImportController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
