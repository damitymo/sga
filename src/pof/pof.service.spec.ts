import { Test, TestingModule } from '@nestjs/testing';
import { PofService } from './pof.service';

describe('PofService', () => {
  let service: PofService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PofService],
    }).compile();

    service = module.get<PofService>(PofService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
