import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from 'src/database/schemas/user.schema';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { Transaction } from 'src/database/schemas/transactions.schema';
import { WalletService } from 'src/wallet/wallet.service';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly walletService: WalletService,
    @InjectModel(Transaction.name)
    readonly transactionModel: Model<Transaction>,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    try {
      const newEvmWallet = await this.walletService.createEvmWallet();
      const newSolanaWallet = await this.walletService.createSVMWallet();

      const [encryptedEvmWalletDetails, encryptedSvmWalletDetails] =
        await Promise.all([
          this.walletService.encryptEvmWallet(
            process.env.DEFAULT_WALLET_PIN!,
            newEvmWallet.privateKey,
          ),
          this.walletService.encryptSVMWallet(
            process.env.DEFAULT_WALLET_PIN!,
            newSolanaWallet.privateKey,
          ),
        ]);
      const user = new this.userModel({
        userId: createUserDto.userId,
        userName: createUserDto.userName,
        evmWalletDetails: encryptedEvmWalletDetails.json,
        evmWalletAddress: newEvmWallet.address,
        svmWalletDetails: encryptedSvmWalletDetails.json,
        svmWalletAddress: newSolanaWallet.address,
        chains: createUserDto.chains,
      });
      return user.save();
    } catch (error) {
      console.log(error);
    }
  }

  async updateUser(
    userId: string,
    updateUserDto: UpdateUserDto,
  ): Promise<User> {
    const user = await this.userModel.findOneAndUpdate(
      { userId },
      updateUserDto,
      { new: true },
    );
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getUserById(userId: string): Promise<User> {
    const user = await this.userModel
      .findOne({ userId })
      .select('-evmWalletDetails -svmWalletDetails')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async checkIfUserExists(userId: string): Promise<User> {
    return await this.userModel
      .findOne({ userId })
      .select('-evmWalletDetails -svmWalletDetails')
      .exec();
  }

  async getTransactionHistory(userId: string): Promise<Transaction[]> {
    const transactions = await this.transactionModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .exec();

    if (!transactions || transactions.length === 0) {
      throw new NotFoundException('No transactions found for this user');
    }

    return transactions;
  }
}
