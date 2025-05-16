import { Test, TestingModule } from '@nestjs/testing';
import { XfiDexService } from './xfi-dex.service';

describe('XfiDexService', () => {
  let service: XfiDexService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [XfiDexService],
    }).compile();

    service = module.get<XfiDexService>(XfiDexService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
