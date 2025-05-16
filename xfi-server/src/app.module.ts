import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TwitterClientModule } from './twitter-client/twitter-client.module';
import { CacheModule } from '@nestjs/cache-manager';
import { DatabaseModule } from './database/database.module';
// import { XfiAgentModule } from './xfi-agent/xfi-agent.module';
import { WalletModule } from './wallet/wallet.module';
// import { XfiDexModule } from './xfi-dex/xfi-dex.module';
import { TwitterOAuthModule } from './twitter-oauth/twitter-oauth.module';

@Module({
  imports: [
    CacheModule.register({ isGlobal: true }),
    WalletModule,
    DatabaseModule,
<<<<<<< HEAD
    TwitterOAuthModule,
    // TwitterClientModule,
    // XfiAgentModule,
    // XfiDexModule,
=======
    TwitterClientModule,
    // XfiAgentModule,
    XfiDexModule,
>>>>>>> 7edc661794e71b77f05c8d31be266fd3643f75a8
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
