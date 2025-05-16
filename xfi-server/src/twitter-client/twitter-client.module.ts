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
import { UserController } from './user.controller';
import { UserService } from './user.service';
import {
  Transaction,
  TransactionSchema,
} from 'src/database/schemas/transactions.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Memory.name, schema: MemorySchema }]),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
    ]),
    WalletModule,
    XfiDexModule,
  ],
  providers: [
    TwitterClientService,
    TwitterClientBase,
    TwitterClientInteractions,
    ParseCommandService,
    UserService,
  ],
  controllers: [TwitterClientController, UserController],
})
export class TwitterClientModule {}
