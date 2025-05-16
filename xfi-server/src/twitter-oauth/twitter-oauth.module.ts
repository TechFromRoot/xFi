import { Module } from '@nestjs/common';
import { TwitterOAuthController } from './twitter-oauth.controller';
import { TwitterOAuthService } from './twitter-oauth.service';
import { TwitterAuthStrategy } from './twitter.strategy';

@Module({
    controllers: [TwitterOAuthController],
    providers: [TwitterOAuthService, TwitterAuthStrategy],
})
export class TwitterOAuthModule { }
