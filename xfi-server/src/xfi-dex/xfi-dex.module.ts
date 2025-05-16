import { Module } from '@nestjs/common';
import { XfiDexService } from './xfi-dex.service';
import { WalletModule } from 'src/wallet/wallet.module';
import { HttpModule } from '@nestjs/axios';
import {
  Transaction,
  TransactionSchema,
} from 'src/database/schemas/transactions.schema';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    WalletModule,
    HttpModule,
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
    ]),
  ],
  exports: [XfiDexService],
  providers: [XfiDexService],
})
export class XfiDexModule {}
