import { Module } from '@nestjs/common';
import { XfiDexService } from './xfi-dex.service';

@Module({
  providers: [XfiDexService]
})
export class XfiDexModule {}
