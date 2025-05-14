import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TwitterClientModule } from './twitter-client/twitter-client.module';
import { CacheModule } from '@nestjs/cache-manager';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    TwitterClientModule,
    CacheModule.register({ isGlobal: true }),
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
