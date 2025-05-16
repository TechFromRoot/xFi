import { Inject, Injectable, Logger } from '@nestjs/common';
// import { twitterLogger } from './utils/logger.util';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Memory } from 'src/database/schemas/memory.schema';
import { TwitterClientBase } from './base.provider';
import { twitterConfig } from './config/twitter.config';
import { SearchMode, Tweet } from 'agent-twitter-client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Content, IMemory } from './interfaces/client.interface';
const MAX_TWEET_LENGTH = 280;

interface TweetData {
  text: string;
  media?: string; // URL to image (e.g., token logo)
}
interface TokenData {
  mint: string;
  tokenMeta: { name: string; symbol: string; uri?: string };
  token: { supply: number; decimals: number };
  creator: string;
  price?: number;
  totalHolders?: number;
  totalMarketLiquidity?: number;
  rugged?: boolean;
  score?: number;
  score_normalised?: number;
  risks?: { name: string; description: string; level: string }[];
  topHolders?: {
    pct: number;
    owner: string;
    amount: number;
    insider: boolean;
  }[];
  insiderNetworks?: {
    tokenAmount: number;
    size: number;
    id?: string;
    wallets?: string[];
  }[];
  graphInsidersDetected?: number;
  verification?: {
    mint: string;
    payer: string;
    name: string;
    symbol: string;
    description: string;
    jup_verified: boolean;
    jup_strict: boolean;
    links: string[];
  };
  freezeAuthority?: string | null;
  mintAuthority?: string | null;
  fileMeta?: { image?: string };
}

interface VoteData {
  up: number;
  down: number;
  userVoted: boolean;
}

@Injectable()
export class TwitterClientInteractions {
  private readonly logger = new Logger(TwitterClientInteractions.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly twitterClientBase: TwitterClientBase,
    @InjectModel(Memory.name) private readonly memoryModel: Model<Memory>,
  ) {}

  async start() {
    const handleTwitterInteractionsLoop = () => {
      this.handleTwitterInteractions();
      setTimeout(
        handleTwitterInteractionsLoop,
        Number(twitterConfig.TWITTER_POLL_INTERVAL || 30) * 1000, // Default to 2 minutes
      );
    };
    handleTwitterInteractionsLoop();
  }

  async handleTwitterInteractions() {
    this.logger.log('Checking Twitter interactions');

    const twitterUsername = twitterConfig.TWITTER_USERNAME;
    try {
      // check direct dm
      // const dm =
      //   await this.twitterClientBase.twitterClient.getDirectMessageConversations(
      //     this.twitterClientBase.profile.id,
      //   );

      // console.log('dm   :', dm.conversations);
      // await this.twitterClientBase.twitterClient.sendDirectMessage(
      //   dm.conversations[0].conversationId,
      //   'Yo man',
      // );

      // {
      //   id: '1922802382683168780',
      //   text: 'Yello',
      //   senderId: '1871417351066816512',
      //   recipientId: '1863906534863880192',
      //   createdAt: '1747266786000',
      //   mediaUrls: undefined,
      //   senderScreenName: 'solMIND_ai',
      //   recipientScreenName: 'TestBots28'
      // }
      // Check for mentions
      const tweetCandidates = (
        await this.twitterClientBase.fetchSearchTweets(
          `@${twitterUsername}`,
          3,
          SearchMode.Latest,
        )
      ).tweets;

      // de-duplicate tweetCandidates with a set
      const uniqueTweetCandidates = [...new Set(tweetCandidates)];

      // Sort tweet candidates by ID in ascending order
      uniqueTweetCandidates
        .sort((a, b) => a.id.localeCompare(b.id))
        .filter((tweet) => tweet.userId !== twitterConfig.TWITTER_USERNAME);
      console.log('tweets \n :', uniqueTweetCandidates);
      // for each tweet candidate, handle the tweet
      for (const tweet of uniqueTweetCandidates) {
        if (
          !this.twitterClientBase.lastCheckedTweetId ||
          BigInt(tweet.id) > this.twitterClientBase.lastCheckedTweetId
        ) {
          // Generate the tweetId UUID the same way it's done in handleTweet
          const tweetId = this.getTweetId(tweet.id);
          // Check if we've already processed this tweet
          const existingResponse = await this.memoryModel
            .findOne({
              id: tweetId,
            })
            .exec();

          if (existingResponse) {
            this.logger.log(`Already responded to tweet ${tweet.id}, skipping`);
            continue;
          }
          this.logger.log('New Tweet found', tweet.permanentUrl);

          const roomId = this.getRoomId(tweet.conversationId);

          const thread = await this.buildConversationThread(
            tweet,
            this.twitterClientBase,
          );
          // this.logger.log(tweet);
          this.logger.log(`this is the user tweet  :, ${tweet.text}`);

          const message = {
            content: { text: tweet.text },
            roomId,
          };

          await this.handleTweet({
            tweet,
            message,
            thread,
          });

          // Update the last checked tweet ID after processing each tweet
          this.twitterClientBase.lastCheckedTweetId = BigInt(tweet.id);
        }
      }

      // Save the latest checked tweet ID to the file
      await this.twitterClientBase.cacheLatestCheckedTweetId();

      this.logger.log('Finished checking Twitter interactions');
    } catch (error) {
      this.logger.error('Error handling Twitter interactions:', error);
    }
  }

  private async handleTweet({
    tweet,
    message,
    thread,
  }: {
    tweet: Tweet;
    message: IMemory;
    thread: Tweet[];
  }) {
    if (tweet.userId === twitterConfig.TWITTER_USERNAME) {
      // console.log("skipping tweet from bot itself", tweet.id);
      // Skip processing if the tweet is from the bot itself
      return;
    }

    if (!message.content.text) {
      this.logger.log(`Skipping Tweet with no text, ${tweet.id}`);
      return { text: '', action: 'IGNORE' };
    }

    this.logger.log(`Processing Tweet: , ${tweet.id}`);
    //   const formatTweet = (tweet: Tweet) => {
    //     return `  ID: ${tweet.id}
    // From: ${tweet.name} (@${tweet.username})
    // Text: ${tweet.text}`;
    //   };
    // const currentPost = formatTweet(tweet);

    this.logger.debug(`Thread: , ${thread}`);
    const formattedConversation = thread
      .map(
        (tweet) => `@${tweet.username} (${new Date(
          tweet.timestamp * 1000,
        ).toLocaleString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          month: 'short',
          day: 'numeric',
        })}):
        ${tweet.text}`,
      )
      .join('\n\n');

    this.logger.debug(`formattedConversation: , ${formattedConversation}`);

    // check if the tweet exists, save if it doesn't
    const tweetId = this.getTweetId(tweet.id);
    const tweetExists = await this.memoryModel
      .find({
        id: tweetId,
      })
      .exec();

    if (!tweetExists) {
      this.logger.log('tweet does not exist, saving');
      const roomId = this.getRoomId(tweet.conversationId);

      const message = {
        id: tweetId,
        content: {
          text: tweet.text,
          url: tweet.permanentUrl,
          inReplyTo: tweet.inReplyToStatusId
            ? this.getTweetId(tweet.inReplyToStatusId)
            : undefined,
        },
        roomId,
        createdAt: tweet.timestamp * 1000,
      };
      this.twitterClientBase.saveRequestMessage(message);
    }

    const regex =
      /^@(TestBots28|CheckM8_Bot).*?\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/;
    const match = tweet.text.match(regex);

    if (!match) {
      return;
    }

    const response1 = await this.getTokenReport$Vote(match[2]);
    if (!response1.tokenDetail && !response1.tokenVotes) {
      return;
    }

    const generatedTweet = await this.getTokenDisplayTweet(
      response1.tokenDetail,
      response1.tokenVotes,
    );

    const response: Content = {
      text: generatedTweet.text,
      url: tweet.permanentUrl,
      inReplyTo: tweet.inReplyToStatusId
        ? this.getTweetId(tweet.inReplyToStatusId)
        : undefined,
    };

    const stringId = this.getTweetId(tweet.id);

    response.inReplyTo = stringId;
    response.action = 'REPLY';

    if (response.text) {
      try {
        const callback: any = async (response: Content) => {
          const memories = await this.sendTweet(
            this.twitterClientBase,
            response,
            message.roomId,
            twitterConfig.TWITTER_USERNAME,
            tweet.id,
          );
          return memories;
        };

        const responseMessages = await callback(response);

        for (const responseMessage of responseMessages) {
          if (
            responseMessage === responseMessages[responseMessages.length - 1]
          ) {
            responseMessage.content.action = response.action;
          } else {
            responseMessage.content.action = 'CONTINUE';
          }
          await new this.memoryModel({
            ...responseMessage,
            embedding: this.getZeroEmbedding(),
          }).save();
        }

        const responseInfo = `Selected Post: ${tweet.id} - ${tweet.username}: ${tweet.text}\nAgent's Output:\n${response.text}`;

        await this.cacheManager.set(
          `twitter/tweet_generation_${tweet.id}.txt`,
          responseInfo,
        );
        await this.wait();
      } catch (error) {
        console.log(error);
        this.logger.error(`Error sending response tweet: ${error}`);
      }
    }
  }

  buildConversationThread = async (
    tweet: Tweet,
    client: TwitterClientBase,
    maxReplies: number = 10,
  ): Promise<Tweet[]> => {
    const thread: Tweet[] = [];
    const visited: Set<string> = new Set();

    const processThread = async (currentTweet: Tweet, depth: number = 0) => {
      this.logger.debug('Processing tweet:', {
        id: currentTweet.id,
        inReplyToStatusId: currentTweet.inReplyToStatusId,
        depth: depth,
      });

      if (!currentTweet) {
        this.logger.debug('No current tweet found for thread building');
        return;
      }

      // Stop if we've reached our reply limit
      if (depth >= maxReplies) {
        this.logger.debug('Reached maximum reply depth', depth);
        return;
      }

      // Handle memory storage
      const memory = await this.memoryModel
        .find({
          id: client.getTweetId(currentTweet.id),
        })
        .exec();

      if (!memory) {
        const memory = new this.memoryModel({
          id: client.getTweetId(currentTweet.id),
          content: currentTweet.text,
          createdAt: currentTweet.timestamp * 1000,
          roomId: client.getRoomId(currentTweet.conversationId),
        });
        await memory.save();
        this.logger.debug('Saved memory for tweet:', currentTweet.id);
      }

      if (visited.has(currentTweet.id)) {
        this.logger.debug('Already visited tweet:', currentTweet.id);
        return;
      }

      visited.add(currentTweet.id);
      thread.unshift(currentTweet);

      this.logger.debug('Current thread state:', {
        length: thread.length,
        currentDepth: depth,
        tweetId: currentTweet.id,
      });

      // If there's a parent tweet, fetch and process it
      if (currentTweet.inReplyToStatusId) {
        this.logger.debug(
          'Fetching parent tweet:',
          currentTweet.inReplyToStatusId,
        );
        try {
          const parentTweet = await client.twitterClient.getTweet(
            currentTweet.inReplyToStatusId,
          );

          if (parentTweet) {
            this.logger.debug('Found parent tweet:', {
              id: parentTweet.id,
              text: parentTweet.text?.slice(0, 50),
            });
            await processThread(parentTweet, depth + 1);
          } else {
            this.logger.debug(
              'No parent tweet found for:',
              currentTweet.inReplyToStatusId,
            );
          }
        } catch (error) {
          this.logger.error('Error fetching parent tweet:', {
            tweetId: currentTweet.inReplyToStatusId,
            error,
          });
        }
      } else {
        this.logger.debug('Reached end of reply chain at:', currentTweet.id);
      }
    };

    await processThread(tweet, 0);

    this.logger.debug('Final thread built:', {
      totalTweets: thread.length,
      tweetIds: thread.map((t) => ({
        id: t.id,
        text: t.text?.slice(0, 50),
      })),
    });

    return thread;
  };

  private getTweetId(tweetId: string): string {
    return `${tweetId}`;
  }

  private getRoomId(conversationId: string): string {
    return `${conversationId}`;
  }

  private getZeroEmbedding(): number[] {
    return new Array(1536).fill(0); // or whatever your embedding size is
  }

  wait = (minTime: number = 1000, maxTime: number = 3000) => {
    const waitTime =
      Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
    return new Promise((resolve) => setTimeout(resolve, waitTime));
  };

  getTokenReport$Vote = async (mint: string) => {
    try {
      const [reportResponse, votesResponse] = await Promise.all([
        fetch(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`),
        fetch(`https://api.rugcheck.xyz/v1/tokens/${mint}/votes`),
      ]);

      const reportResult = await reportResponse.json();
      const votesResult = await votesResponse.json();

      const tokenDetail: TokenData =
        reportResult && !reportResult.error ? reportResult : null;
      const tokenVotes: VoteData = votesResult || null;

      if (!tokenDetail && !tokenVotes) {
        console.error(
          `No data retrieved for mint ${mint}: both report and votes failed.`,
        );
        return null;
      }

      return { tokenDetail, tokenVotes };
    } catch (error) {
      console.error(`Error fetching token data for mint ${mint}:`, error);
      return null;
    }
  };

  getTokenDisplayTweet = async (
    token: TokenData,
    tokenVote: VoteData,
  ): Promise<TweetData> => {
    const lines: string[] = [];

    // Token Header
    lines.push(`${token.tokenMeta.name} (${token.tokenMeta.symbol}) 📊`);

    // Key Metrics
    const metrics: string[] = [];
    if (token.price) {
      metrics.push(`💰 Price: $${this.formatPrice(token.price)}`);
    }
    if (token.price && token.token.supply) {
      const marketCap =
        token.price * (token.token.supply / 10 ** token.token.decimals);
      metrics.push(`📈 MCap: $${this.formatNumber(marketCap)}`);
    }
    if (token.totalHolders) {
      metrics.push(`👥 Holders: ${this.formatNumber(token.totalHolders)}`);
    }

    // Risk Score
    const normalizedScore =
      token.score_normalised !== undefined
        ? token.score_normalised
        : token.score
          ? Math.min(Math.round((token.score / 118101) * 100), 100)
          : undefined;
    if (normalizedScore !== undefined) {
      const riskEmoji = normalizedScore >= 50 ? '🔴' : '🟢';
      metrics.push(`🚨 Risk: ${normalizedScore}/100 ${riskEmoji}`);
    }

    if (typeof token.rugged === 'boolean') {
      metrics.push(`🔻 Rugged: ${token.rugged ? 'Yes' : 'No'}`);
    }

    // Insider Analysis
    if (token.insiderNetworks?.length) {
      const { insiderPct, totalWallet } = token.insiderNetworks.reduce(
        (acc, insider) => {
          if (insider['type'] === 'transfer') {
            // Assuming 'type' might be present; adjust if not
            acc.totalWallet += insider.size;
            acc.insiderPct += (insider.tokenAmount / token.token.supply) * 100;
          }
          return acc;
        },
        { insiderPct: 0, totalWallet: 0 },
      );
      const insiderText = `${insiderPct.toFixed(2)}% of supply sent to ${totalWallet} wallets`;
      metrics.push(`🕵️‍♀️ Insider Analysis: ${insiderText}`);
    }

    // Community Sentiment
    if (tokenVote) {
      metrics.push(
        `👥 Community Sentiment : 🚀 Up: ${tokenVote.up} | 💩 Down: ${tokenVote.down}`,
      );
    }

    // Add metrics to lines (limit to 9 for brevity)
    if (metrics.length > 0) {
      lines.push(...metrics.slice(0, 12));
    }

    // Call-to-Action
    lines.push(`🔎 Details: ${process.env.BOT_URL}?start=x-${token.mint}`);

    // Build text
    const text = lines.join('\n').substring(0, 280); // Ensure < 280 chars

    // Prepare output
    const tweet: TweetData = { text };

    // Add media if available
    if (token.fileMeta?.image) {
      tweet.media = token.fileMeta.image;
    }

    return tweet;
  };

  shortenAddress = (address: string): string => {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  formatNumber = (num: number): string => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  formatPrice = (price: number): string => {
    if (price === 0) return '0';
    if (price < 0.00000001) return `${price.toFixed(8)}(~< 0.00000001)`;
    return price.toFixed(8);
  };

  async sendTweet(
    client: TwitterClientBase,
    content: Content,
    roomId: string,
    twitterUsername: string,
    inReplyTo: string,
  ): Promise<IMemory[]> {
    const tweetChunks = this.splitTweetContent(content.text);
    const sentTweets: Tweet[] = [];
    let previousTweetId = inReplyTo;

    for (const chunk of tweetChunks) {
      const result = await client.requestQueue.add(
        async () =>
          await client.twitterClient.sendTweet(chunk.trim(), previousTweetId),
      );
      const body = await result.json();

      // if we have a response
      if (body?.data?.create_tweet?.tweet_results?.result) {
        // Parse the response
        const tweetResult = body.data.create_tweet.tweet_results.result;
        const finalTweet: Tweet = {
          id: tweetResult.rest_id,
          text: tweetResult.legacy.full_text,
          conversationId: tweetResult.legacy.conversation_id_str,
          timestamp: new Date(tweetResult.legacy.created_at).getTime() / 1000,
          userId: tweetResult.legacy.user_id_str,
          inReplyToStatusId: tweetResult.legacy.in_reply_to_status_id_str,
          permanentUrl: `https://twitter.com/${twitterUsername}/status/${tweetResult.rest_id}`,
          hashtags: [],
          mentions: [],
          photos: [],
          thread: [],
          urls: [],
          videos: [],
        };
        sentTweets.push(finalTweet);
        previousTweetId = finalTweet.id;
      } else {
        console.error('Error sending chunk', chunk, 'repsonse:', body);
      }

      // Wait a bit between tweets to avoid rate limiting issues
      await this.wait(1000, 2000);
    }

    const memories: IMemory[] = sentTweets.map((tweet) => ({
      id: this.getTweetId(tweet.id),
      content: {
        text: tweet.text,
        source: 'twitter',
        url: tweet.permanentUrl,
        inReplyTo: tweet.inReplyToStatusId
          ? this.getTweetId(tweet.inReplyToStatusId)
          : undefined,
      },
      roomId,
      embedding: this.getZeroEmbedding(),
      createdAt: tweet.timestamp * 1000,
    }));

    return memories;
  }

  splitTweetContent(content: string): string[] {
    const maxLength = MAX_TWEET_LENGTH;
    const paragraphs = content.split('\n\n').map((p) => p.trim());
    const tweets: string[] = [];
    let currentTweet = '';

    for (const paragraph of paragraphs) {
      if (!paragraph) continue;

      if ((currentTweet + '\n\n' + paragraph).trim().length <= maxLength) {
        if (currentTweet) {
          currentTweet += '\n\n' + paragraph;
        } else {
          currentTweet = paragraph;
        }
      } else {
        if (currentTweet) {
          tweets.push(currentTweet.trim());
        }
        if (paragraph.length <= maxLength) {
          currentTweet = paragraph;
        } else {
          // Split long paragraph into smaller chunks
          const chunks = this.splitParagraph(paragraph, maxLength);
          tweets.push(...chunks.slice(0, -1));
          currentTweet = chunks[chunks.length - 1];
        }
      }
    }

    if (currentTweet) {
      tweets.push(currentTweet.trim());
    }

    return tweets;
  }

  splitParagraph(paragraph: string, maxLength: number): string[] {
    // eslint-disable-next-line
    const sentences = paragraph.match(/[^\.!\?]+[\.!\?]+|[^\.!\?]+$/g) || [
      paragraph,
    ];
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + ' ' + sentence).trim().length <= maxLength) {
        if (currentChunk) {
          currentChunk += ' ' + sentence;
        } else {
          currentChunk = sentence;
        }
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        if (sentence.length <= maxLength) {
          currentChunk = sentence;
        } else {
          // Split long sentence into smaller pieces
          const words = sentence.split(' ');
          currentChunk = '';
          for (const word of words) {
            if ((currentChunk + ' ' + word).trim().length <= maxLength) {
              if (currentChunk) {
                currentChunk += ' ' + word;
              } else {
                currentChunk = word;
              }
            } else {
              if (currentChunk) {
                chunks.push(currentChunk.trim());
              }
              currentChunk = word;
            }
          }
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}
