import { Test, TestingModule } from '@nestjs/testing';
import { RevistaController } from './revista.controller';

describe('RevistaController', () => {
  let controller: RevistaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RevistaController],
    }).compile();

    controller = module.get<RevistaController>(RevistaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
