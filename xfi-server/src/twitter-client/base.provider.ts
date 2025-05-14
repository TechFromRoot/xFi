import { Inject, Injectable, Logger } from '@nestjs/common';
// import { twitterLogger } from './utils/logger.util';
import { RequestQueue } from './utils/requestQueue.util';
import {
  QueryTweetsResponse,
  Scraper,
  SearchMode,
  Tweet,
} from 'agent-twitter-client';
import { twitterConfig } from './config/twitter.config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Memory } from 'src/database/schemas/memory.schema';
import { IMemory } from './interfaces/client.interface';

type TwitterProfile = {
  id: string;
  username: string;
  screenName: string;
  bio: string;
};

@Injectable()
export class TwitterClientBase {
  private readonly logger = new Logger(TwitterClientBase.name);
  readonly twitterClient: Scraper;
  readonly requestQueue: RequestQueue;
  profile: TwitterProfile;
  lastCheckedTweetId: bigint | null = null;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectModel(Memory.name) private readonly memoryModel: Model<Memory>,
  ) {
    this.twitterClient = new Scraper();
    this.requestQueue = new RequestQueue();
  }

  async init() {
    //test
    const username = twitterConfig.TWITTER_USERNAME;

    if (!username) {
      throw new Error('Twitter username not configured');
    }
    // Check for Twitter cookies
    if (twitterConfig.TWITTER_COOKIES) {
      const cookiesArray = JSON.parse(twitterConfig.TWITTER_COOKIES);

      await this.setCookiesFromArray(cookiesArray);
    } else {
      const cachedCookies = await this.getCachedCookies(username);
      if (cachedCookies) {
        await this.setCookiesFromArray(cachedCookies);
      }
    }

    this.logger.log('Waiting for Twitter login');
    while (true) {
      await this.twitterClient.login(
        username,
        twitterConfig.TWITTER_PASSWORD,
        twitterConfig.TWITTER_EMAIL,
        twitterConfig.TWITTER_2FA_SECRET || undefined,
      );

      if (await this.twitterClient.isLoggedIn()) {
        const cookies = await this.twitterClient.getCookies();
        await this.cacheCookies(username, cookies);
        break;
      }

      this.logger.error('Failed to login to Twitter trying again...');

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Initialize Twitter profile
    this.profile = await this.fetchProfile(username);

    if (this.profile) {
      this.logger.log('Twitter user ID:', this.profile.id);
      this.logger.log(
        'Twitter loaded:',
        JSON.stringify(this.profile, null, 10),
      );
    } else {
      throw new Error('Failed to load profile');
    }

    await this.loadLatestCheckedTweetId();
    await this.populateTimeline();
  }

  async setCookiesFromArray(cookiesArray: any[]) {
    const cookieStrings = cookiesArray.map(
      (cookie) =>
        `${cookie.key}=${cookie.value}; Domain=${cookie.domain}; Path=${cookie.path}; ${
          cookie.secure ? 'Secure' : ''
        }; ${cookie.httpOnly ? 'HttpOnly' : ''}; SameSite=${
          cookie.sameSite || 'Lax'
        }`,
    );
    await this.twitterClient.setCookies(cookieStrings);
  }
  async fetchProfile(username: string): Promise<TwitterProfile> {
    const cached = await this.getCachedProfile(username);

    if (cached) return cached;

    try {
      const profile = await this.requestQueue.add(async () => {
        const profile = await this.twitterClient.getProfile(username);
        console.log({ profile });
        return {
          id: profile.userId,
          username,
          screenName: profile.name,
          bio: profile.biography || '',
        } satisfies TwitterProfile;
      });

      //   this.cacheProfile(profile);

      return profile;
    } catch (error) {
      console.error('Error fetching Twitter profile:', error);

      return undefined;
    }
  }

  async cacheTweet(tweet: Tweet): Promise<void> {
    if (!tweet) {
      console.warn('Tweet is undefined, skipping cache');
      return;
    }

    this.cacheManager.set(`twitter/tweets/${tweet.id}`, tweet);
  }

  async getCachedTweet(tweetId: string): Promise<Tweet | undefined> {
    const cached = await this.cacheManager.get<Tweet>(
      `twitter/tweets/${tweetId}`,
    );

    return cached;
  }

  async getTweet(tweetId: string): Promise<Tweet> {
    const cachedTweet = await this.getCachedTweet(tweetId);

    if (cachedTweet) {
      return cachedTweet;
    }

    const tweet = await this.requestQueue.add(() =>
      this.twitterClient.getTweet(tweetId),
    );

    await this.cacheTweet(tweet);
    return tweet;
  }

  async loadLatestCheckedTweetId(): Promise<void> {
    const latestCheckedTweetId = await this.cacheManager.get<string>(
      `twitter/${this.profile.username}/latest_checked_tweet_id`,
    );

    if (latestCheckedTweetId) {
      this.lastCheckedTweetId = BigInt(latestCheckedTweetId);
    }
  }

  async cacheLatestCheckedTweetId() {
    if (this.lastCheckedTweetId) {
      await this.cacheManager.set(
        `twitter/${this.profile.username}/latest_checked_tweet_id`,
        this.lastCheckedTweetId.toString(),
      );
    }
  }

  async getCachedTimeline(): Promise<Tweet[] | undefined> {
    return await this.cacheManager.get<Tweet[]>(
      `twitter/${this.profile.username}/timeline`,
    );
  }

  async cacheTimeline(timeline: Tweet[]) {
    await this.cacheManager.set(
      `twitter/${this.profile.username}/timeline`,
      timeline,
      10 * 1000,
    );
  }

  async cacheMentions(mentions: Tweet[]) {
    await this.cacheManager.set(
      `twitter/${this.profile.username}/mentions`,
      mentions,
      10 * 1000,
    );
  }

  async getCachedCookies(username: string) {
    return await this.cacheManager.get<any[]>(`twitter/${username}/cookies`);
  }

  async cacheCookies(username: string, cookies: any[]) {
    await this.cacheManager.set(`twitter/${username}/cookies`, cookies);
  }

  async getCachedProfile(username: string) {
    return await this.cacheManager.get<TwitterProfile>(
      `twitter/${username}/profile`,
    );
  }

  async cacheProfile(profile: TwitterProfile) {
    await this.cacheManager.set(`twitter/${profile.username}/profile`, profile);
  }

  async fetchHomeTimeline(count: number): Promise<Tweet[]> {
    this.logger.debug('fetching home timeline');
    const homeTimeline = await this.twitterClient.getUserTweets(
      this.profile.id,
      count,
    );

    // console.dir(homeTimeline, { depth: Infinity });

    return homeTimeline.tweets;
    // .filter((t) => t.__typename !== "TweetWithVisibilityResults")
    // .map((tweet) => {
    //     // console.log("tweet is", tweet);
    //     const obj = {
    //         id: tweet.id,
    //         name:
    //             tweet.name ??
    //             tweet. ?.user_results?.result?.legacy.name,
    //         username:
    //             tweet.username ??
    //             tweet.core?.user_results?.result?.legacy.screen_name,
    //         text: tweet.text ?? tweet.legacy?.full_text,
    //         inReplyToStatusId:
    //             tweet.inReplyToStatusId ??
    //             tweet.legacy?.in_reply_to_status_id_str,
    //         createdAt: tweet.createdAt ?? tweet.legacy?.created_at,
    //         userId: tweet.userId ?? tweet.legacy?.user_id_str,
    //         conversationId:
    //             tweet.conversationId ??
    //             tweet.legacy?.conversation_id_str,
    //         hashtags: tweet.hashtags ?? tweet.legacy?.entities.hashtags,
    //         mentions:
    //             tweet.mentions ?? tweet.legacy?.entities.user_mentions,
    //         photos:
    //             tweet.photos ??
    //             tweet.legacy?.entities.media?.filter(
    //                 (media) => media.type === "photo"
    //             ) ??
    //             [],
    //         thread: [],
    //         urls: tweet.urls ?? tweet.legacy?.entities.urls,
    //         videos:
    //             tweet.videos ??
    //             tweet.legacy?.entities.media?.filter(
    //                 (media) => media.type === "video"
    //             ) ??
    //             [],
    //     };
    //     // console.log("obj is", obj);
    //     return obj;
    // });
  }

  async fetchSearchTweets(
    query: string,
    maxTweets: number,
    searchMode: SearchMode,
    cursor?: string,
  ): Promise<QueryTweetsResponse> {
    try {
      // Sometimes this fails because we are rate limited. in this case, we just need to return an empty array
      // if we dont get a response in 5 seconds, something is wrong
      const timeoutPromise = new Promise((resolve) =>
        setTimeout(() => resolve({ tweets: [] }), 10000),
      );

      try {
        const result = await this.requestQueue.add(
          async () =>
            await Promise.race([
              this.twitterClient.fetchSearchTweets(
                query,
                maxTweets,
                searchMode,
                cursor,
              ),
              timeoutPromise,
            ]),
        );
        return (result ?? { tweets: [] }) as QueryTweetsResponse;
      } catch (error) {
        this.logger.error('Error fetching search tweets:', error);
        return { tweets: [] };
      }
    } catch (error) {
      this.logger.error('Error fetching search tweets:', error);
      return { tweets: [] };
    }
  }

  private async populateTimeline(): Promise<void> {
    this.logger.debug('Populating timeline...');

    const cachedTweets = await this.getCachedTimeline();

    let tweetsToProcess: Tweet[] = [];

    if (cachedTweets && cachedTweets.length) {
      const existingMemories = await this.memoryModel
        .find({
          roomId: {
            $in: cachedTweets.map((tweet) =>
              this.getRoomId(tweet.conversationId),
            ),
          },
        })
        .exec();

      const existingMemoryIds = new Set(
        existingMemories.map((memory) => memory.id),
      );

      tweetsToProcess = cachedTweets.filter(
        (tweet) => !existingMemoryIds.has(this.getTweetId(tweet.id)),
      );

      if (tweetsToProcess.length === 0) {
        this.logger.log('No new tweets to store from cache.');
        return;
      }
    } else {
      // If no cache, fetch from Twitter
      const timelineTweets = await this.fetchHomeTimeline(50);

      // Get the most recent 20 mentions and interactions
      const mentionsAndInteractions = await this.fetchSearchTweets(
        `@${twitterConfig.TWITTER_USERNAME}`,
        20,
        SearchMode.Latest,
      );

      // Combine the timeline tweets and mentions/interactions
      const allTweets = [...timelineTweets, ...mentionsAndInteractions.tweets];

      const existingMemories = await this.memoryModel
        .find({
          roomId: {
            $in: allTweets.map((tweet) => this.getRoomId(tweet.conversationId)),
          },
        })
        .exec();

      const existingMemoryIds = new Set(
        existingMemories.map((memory) => memory.id),
      );

      tweetsToProcess = allTweets.filter(
        (tweet) => !existingMemoryIds.has(this.getTweetId(tweet.id)),
      );

      // Cache the fetched tweets
      await this.cacheTimeline(timelineTweets);
      await this.cacheMentions(mentionsAndInteractions.tweets);
    }

    this.logger.debug(
      `Saving ${tweetsToProcess.length} new tweets as memories...`,
    );

    for (const tweet of tweetsToProcess) {
      const memory = new this.memoryModel({
        id: this.getTweetId(tweet.id),
        roomId: this.getRoomId(tweet.conversationId),
        content: tweet.text,
        embedding: this.getZeroEmbedding(),
        createdAt: new Date(tweet.timestamp * 1000),
      });

      await memory.save();
      await this.cacheTweet(tweet);
    }

    this.logger.log(`Finished saving ${tweetsToProcess.length} tweets.`);
  }

  private getTweetId(tweetId: string): string {
    return `${tweetId}`;
  }

  private getRoomId(conversationId: string): string {
    return `${conversationId}`;
  }

  private getZeroEmbedding(): number[] {
    return new Array(1536).fill(0); // or whatever your embedding size is
  }

  async saveRequestMessage(message: IMemory) {
    if (message.content.text) {
      const recentMessage = await this.memoryModel
        .find({ roomId: message.roomId })
        .sort({ createdAt: -1 }) // Most recent first
        .exec();

      if (
        recentMessage.length > 0 &&
        recentMessage[0].content === message.content.text
      ) {
        this.logger.debug('Message already saved', recentMessage[0].id);
      } else {
        await new this.memoryModel({
          ...message,
          embedding: this.getZeroEmbedding(),
        }).save();
      }
    }
  }
}
