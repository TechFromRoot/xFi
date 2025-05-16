import { Test, TestingModule } from '@nestjs/testing';
import { XfiAgentService } from './xfi-agent.service';

describe('XfiAgentService', () => {
  let service: XfiAgentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [XfiAgentService],
    }).compile();

    service = module.get<XfiAgentService>(XfiAgentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
