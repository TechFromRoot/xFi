import { Injectable } from '@nestjs/common';
import { API_URLS } from '@raydium-io/raydium-sdk-v2';
import { firstValueFrom } from 'rxjs';
import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
import { WalletService } from 'src/wallet/wallet.service';
import { HttpService } from '@nestjs/axios';
import { Transaction } from 'src/database/schemas/transactions.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { console } from 'inspector';

const USDC_ADDRESS_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

@Injectable()
export class XfiDefiBaseService {
  constructor(
    private readonly httpService: HttpService,
    private readonly walletService: WalletService,
    @InjectModel(Transaction.name)
    readonly transactionModel: Model<Transaction>,
  ) {}

  async sendEth(
    privateKey: string,
    amount: string,
    reciever: string,
    data: Partial<Transaction>,
  ) {
    try {
      const userAddress =
        await this.walletService.getEvmAddressFromPrivateKey(privateKey);

      const balance = await this.walletService.getNativeEthBalance(
        String(userAddress),
        process.env.BASE_RPC_URL,
      );

      if (balance < Number(amount)) {
        return 'Insufficient balance.';
      }

      const response = await this.walletService.transferSOL(
        privateKey,
        reciever,
        parseFloat(amount),
        process.env.SOLANA_RPC,
      );

      if (response.signature) {
        try {
          await new this.transactionModel({
            ...data,
            txHash: response.signature,
          }).save();
        } catch (err) {
          console.error('Failed to save transaction:', err.message);
        }
        return `https://solscan.io/tx/${response.signature}`;
      }
      return;
    } catch (error) {
      console.log(error);
      return `error sending token`;
    }
  }

  async sendSplToken(
    privateKey: string,
    token: string,
    amount: string,
    reciever: string,
    data: Partial<Transaction>,
  ) {
    try {
      const tokenMint =
        token.toLowerCase() === 'usdc' ? USDC_ADDRESS_SOL : USDT_ADDRESS_SOL;

      const userAccount = Keypair.fromSecretKey(bs58.decode(privateKey));
      const userAddress = userAccount.publicKey;

      const { balance } = await this.walletService.getSPLTokenBalance(
        String(userAddress),
        tokenMint,
        process.env.SOLANA_RPC,
        6,
      );

      if (balance < Number(amount)) {
        return 'Insufficient balance.';
      }

      const response = await this.walletService.transferSPLToken(
        privateKey,
        reciever,
        parseFloat(amount),
        tokenMint,
        process.env.SOLANA_RPC,
        6,
      );

      if (response.signature) {
        try {
          await new this.transactionModel({
            ...data,
            txHash: response.signature,
          }).save();
        } catch (err) {
          console.error('Failed to save transaction:', err.message);
        }
        return `https://solscan.io/tx/${response.signature}`;
      }
      return;
    } catch (error) {
      console.log(error);
      return `error sending token`;
    }
  }
}
