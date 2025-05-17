import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transaction } from 'src/database/schemas/transactions.schema';
import { User } from 'src/database/schemas/user.schema';
import { WalletService } from 'src/wallet/wallet.service';
import { XfiDefiSolService } from 'src/xfi-defi/xfi-defi-sol.service';

type Action = 'buy' | 'sell' | 'send' | 'tip';
// type Chain = 'solana' | 'ethereum' | 'base' | 'arbitrum';
type TokenType = 'native' | 'stable' | 'token';
type ReceiverType = 'wallet' | 'ens' | 'username';

interface Token {
  value: string;
  type: TokenType;
}

interface Receiver {
  address: string;
  type: ReceiverType;
  value?: string;
}
interface UserKey {
  evmPK: string;
  svmPK: string;
  userId: string;
}

interface ParsedCommand {
  action: Action;
  chain: string;
  amount: string;
  token: Token;
  receiver?: Receiver;
}

// --- Helper Data ---
const NATIVE_TOKENS = ['sol', 'eth'];
const STABLE_TOKENS = ['usdc', 'usdt'];

// const CHAINS = ['solana', 'ethereum', 'base', 'arbitrum'];

@Injectable()
export class ParseCommandService {
  private readonly logger = new Logger(ParseCommandService.name);
  constructor(
    private readonly walletService: WalletService,
    private readonly dexService: XfiDefiSolService,
    @InjectModel(User.name)
    readonly userModel: Model<User>,
  ) {}

  // --- Helper Functions ---
  //   detectChain(word: string): Chain | undefined {
  //     const lower = word.toLowerCase();
  //     if (lower === 'sol') return 'solana';
  //     if (CHAINS.includes(lower)) return lower as Chain;
  //   }

  detectChain(chainOrToken: string): string {
    const normalized = chainOrToken.toLowerCase();

    if (normalized.includes('sol')) return 'solana';
    if (normalized.includes('base')) return 'base';
    if (normalized.includes('mode')) return 'mode';
    if (normalized.includes('mantle')) return 'mantle';
    if (/^0x[a-fA-F0-9]{40}$/.test(chainOrToken)) return 'ethereum'; // EVM
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(chainOrToken)) return 'solana'; // Solana pubkey format
    return 'ethereum'; // Default fallback
  }

  detectTokenType(value: string): TokenType {
    const lower = value.toLowerCase();
    if (NATIVE_TOKENS.includes(lower)) return 'native';
    if (STABLE_TOKENS.includes(lower)) return 'stable';
    return 'token';
  }

  detectReceiverType(value: string): ReceiverType {
    if (value.endsWith('.eth') || value.endsWith('.base.eth')) return 'ens';
    if (value.startsWith('@')) return 'username';
    return 'wallet';
  }

  parseTweetCommand(tweet: string): ParsedCommand | null {
    const normalized = tweet.replace(/\s+/g, ' ').trim();

    // === SEND / TIP ===
    const sendRegex =
      /(send|tip)\s+([\d.]+)\s+(\w+)\s+to\s+([a-zA-Z0-9.@]+)(?:\s+on\s+(\w+))?/i;
    const sendMatch = normalized.match(sendRegex);
    if (sendMatch) {
      const [, actionRaw, amount, tokenValue, receiverValue, chainMaybe] =
        sendMatch;
      const action = actionRaw.toLowerCase() as Action;

      return {
        action,
        amount,
        token: {
          value: tokenValue,
          type: this.detectTokenType(tokenValue),
        },
        receiver: {
          address: receiverValue,
          value: receiverValue,
          type: this.detectReceiverType(receiverValue),
        },
        chain: this.detectChain(chainMaybe ?? tokenValue),
      };
    }

    // === BUY / SELL: [amount][token] of [targetToken] ===
    const buySellOfRegex =
      /(buy|sell)\s+([\d.]+)\s*([a-zA-Z]+)\s+(?:worth\s+of|of)\s+([a-zA-Z0-9]+)(?:\s+on\s+(\w+))?/i;
    const buySellOfMatch = normalized.match(buySellOfRegex);
    if (buySellOfMatch) {
      const [, actionRaw, amount, payToken, targetToken, chainMaybe] =
        buySellOfMatch;
      return {
        action: actionRaw.toLowerCase() as Action,
        amount,
        token: {
          value: targetToken,
          type: this.detectTokenType(targetToken),
        },
        chain: this.detectChain(chainMaybe ?? payToken),
      };
    }

    // === BUY / SELL: [token] for [amount][payToken] ===
    const buySellForRegex =
      /(buy|sell)\s+([a-zA-Z0-9]+)\s+for\s+([\d.]+)\s*([a-zA-Z]+)(?:\s+on\s+(\w+))?/i;
    const buySellForMatch = normalized.match(buySellForRegex);
    if (buySellForMatch) {
      const [, actionRaw, targetToken, amount, payToken, chainMaybe] =
        buySellForMatch;
      return {
        action: actionRaw.toLowerCase() as Action,
        amount,
        token: {
          value: targetToken,
          type: this.detectTokenType(targetToken),
        },
        chain: this.detectChain(chainMaybe ?? payToken),
      };
    }

    // === SELL all / half / percent ===
    const sellPercentageRegex =
      /sell\s+(all|half|\d{1,3}%)\s+(?:of\s+)?([a-zA-Z0-9]+)(?:\s+on\s+(\w+))?/i;
    const sellPercentMatch = normalized.match(sellPercentageRegex);
    if (sellPercentMatch) {
      const [, portion, tokenValue, chainMaybe] = sellPercentMatch;
      let amount = '100';
      if (portion.toLowerCase() === 'half') amount = '50';
      else if (portion.endsWith('%')) amount = portion.replace('%', '');

      return {
        action: 'sell',
        amount,
        token: {
          value: tokenValue,
          type: this.detectTokenType(tokenValue),
        },
        chain: this.detectChain(chainMaybe ?? tokenValue),
      };
    }

    return null;
  }

  // --- Placeholder Action Handlers ---

  async resolveENS(name: string): Promise<Receiver> {
    // TODO: resolve ENS or username to address
    console.log(name);
    return { address: '0xResolvedAddress', type: 'ens', value: name };
  }

  async handleNativeSend(
    chain: string,
    to: string,
    amount: string,
    userKey: UserKey,
    originalCommand: string,
  ) {
    console.log(`Sending ${amount} native on ${chain} to ${to}`);
    try {
      if (chain == 'solana') {
        const data: Partial<Transaction> = {
          userId: userKey.userId,
          transactionType: 'send',
          chain: 'solana',
          amount: amount,
          token: { address: 'solana', tokenType: 'native' },
          receiver: { value: to, receiverType: 'wallet' },
          meta: {
            platform: 'twitter',
            originalCommand: originalCommand,
          },
        };
        const response = await this.dexService.sendSol(
          userKey.svmPK,
          amount,
          to,
          data,
        );
        return response;
      }
    } catch (error) {
      console.log(error);
    }
  }

  async handleStableSend(
    chain: string,
    token: string,
    to: string,
    amount: string,
    userKey: UserKey,
    originalCommand: string,
  ) {
    console.log(`Sending ${amount} stable ${token} on ${chain} to ${to}`);

    try {
      if (chain == 'solana') {
        const data: Partial<Transaction> = {
          userId: userKey.userId,
          transactionType: 'send',
          chain: 'solana',
          amount: amount,
          token: { address: token, tokenType: 'stable' },
          receiver: { value: to, receiverType: 'wallet' },
          meta: {
            platform: 'twitter',
            originalCommand: originalCommand,
          },
        };
        const response = await this.dexService.sendSplToken(
          userKey.svmPK,
          token,
          amount,
          to,
          data,
        );
        return response;
      }
    } catch (error) {
      console.log(error);
    }
  }

  //   async handleTokenSend(
  //     chain: string,
  //     token: string,
  //     to: string,
  //     amount: string,
  //     originalCommand: string,
  //   ) {
  //     console.log(`Sending ${amount} of token ${token} on ${chain} to ${to}`);
  //   }

  async handleBuy(
    chain: string,
    token: string,
    nativeAmount: string,
    userPk: UserKey,
    originalCommand: string,
  ) {
    try {
      if (chain == 'solana') {
        const response = await this.dexService.botBuyToken(
          userPk.svmPK,
          token,
          nativeAmount,
          userPk.userId,
          originalCommand,
        );
        return response;
      }
    } catch (error) {
      console.log(error);
    }
  }

  async handleSell(
    chain: string,
    token: string,
    amount: string,
    userPk: UserKey,
    originalCommand: string,
  ) {
    console.log(`Selling ${amount}% of ${token} on ${chain}`);
    try {
      if (chain == 'solana') {
        const response = await this.dexService.botSellToken(
          userPk.svmPK,
          token,
          amount,
          userPk.userId,
          originalCommand,
        );
        return response;
      }
    } catch (error) {
      console.log(error);
    }
  }

  // --- 🎯 BUNDLED ENTRY FUNCTION ---
  async handleTweetCommand(tweet: string, userId: string) {
    try {
      const user = await this.userModel.findOne({ userId });
      if (!user || !user.active) {
        const appUrl = process.env.APP_URL || 'https://x.com/xFi_bot';
        return `Please go to ${appUrl} and create/activate your account to use this bot`;
      }
      const [decryptedSVMWallet, decryptedEvmWallet] = await Promise.all([
        this.walletService.decryptSVMWallet(
          process.env.DEFAULT_WALLET_PIN!,
          user!.svmWalletDetails,
        ),
        this.walletService.decryptEvmWallet(
          process.env.DEFAULT_WALLET_PIN!,
          user!.evmWalletDetails,
        ),
      ]);

      const userKeys: UserKey = {
        evmPK: decryptedEvmWallet.privateKey,
        svmPK: decryptedSVMWallet.privateKey,
        userId,
      };

      const parsed = this.parseTweetCommand(tweet);
      if (!parsed) {
        console.error('Invalid tweet format.');
        const promptDocsUrl = process.env.PROMPT_DOC || 'https://x.com/xFi_bot';
        return `please use the proper format, you can check this page for the prompt format ${promptDocsUrl}`;
      }

      const { action, chain, amount, token, receiver } = parsed;
      let to: Receiver;

      if (receiver) {
        if (receiver.type === 'ens' || receiver.type === 'username') {
          //TODO:
          to = await this.resolveENS(receiver.value);
        } else {
          to = {
            address: receiver.value,
            type: 'wallet',
            value: receiver.value,
          };
        }
      }

      switch (action) {
        case 'send':
        case 'tip':
          if (!to) return console.error('Receiver address missing.');
          if (token.type === 'native')
            return this.handleNativeSend(
              chain,
              to.address,
              amount,
              userKeys,
              tweet,
            );
          if (token.type === 'stable') {
            return this.handleStableSend(
              chain,
              token.value,
              to.address,
              amount,
              userKeys,
              tweet,
            );
          }

        //   return this.handleTokenSend(
        //     chain,
        //     token.value,
        //     to.address,
        //     amount,
        //     tweet,
        //   );

        case 'buy':
          return this.handleBuy(chain, token.value, amount, userKeys, tweet);

        case 'sell':
          return this.handleSell(chain, token.value, amount, userKeys, tweet);
      }
    } catch (error) {
      console.log(error);
    }
  }
}
