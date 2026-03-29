import { Test, TestingModule } from '@nestjs/testing';
import { RevistaService } from './revista.service';

describe('RevistaService', () => {
  let service: RevistaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RevistaService],
    }).compile();

    service = module.get<RevistaService>(RevistaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
