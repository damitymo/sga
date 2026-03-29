import { Test, TestingModule } from '@nestjs/testing';
import { PofController } from './pof.controller';

describe('PofController', () => {
  let controller: PofController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PofController],
    }).compile();

    controller = module.get<PofController>(PofController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
