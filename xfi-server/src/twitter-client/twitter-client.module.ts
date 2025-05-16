import { Module } from '@nestjs/common';
import { TwitterClientService } from './twitter-client.service';
import { TwitterClientController } from './twitter-client.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Memory, MemorySchema } from 'src/database/schemas/memory.schema';
import { TwitterClientBase } from './base.provider';
import { TwitterClientInteractions } from './interactions.provider';
import { WalletModule } from 'src/wallet/wallet.module';
import { User, UserSchema } from 'src/database/schemas/user.schema';
import { ParseCommandService } from './parse-command';
import { XfiDexModule } from 'src/xfi-dex/xfi-dex.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Memory.name, schema: MemorySchema }]),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    WalletModule,
    XfiDexModule,
  ],
  providers: [
    TwitterClientService,
    TwitterClientBase,
    TwitterClientInteractions,
    ParseCommandService,
  ],
  controllers: [TwitterClientController],
})
export class TwitterClientModule {}
