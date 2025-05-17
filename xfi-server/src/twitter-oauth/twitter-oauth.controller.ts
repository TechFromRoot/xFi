import {
  Controller,
  Get,
  Req,
  Res,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { TwitterOAuthService } from './twitter-oauth.service';

@Controller('auth/twitter')
export class TwitterOAuthController {
  constructor(private readonly twitterService: TwitterOAuthService) {}

  // Step 1: Redirect to Twitter for OAuth login
  @Get()
  async twitterAuthRedirect(@Res() res: Response) {
    return res.redirect('xfi/auth/twitter/login');
  }

  // Step 2: Callback from Twitter after successful login
  @Get('callback')
  @UseGuards(AuthGuard('twitter'))
  async twitterCallback(@Req() req: Request, @Res() res: Response) {
    const twitterUser = req.user as any;

    if (!twitterUser) {
      throw new HttpException(
        'User not authenticated',
        HttpStatus.UNAUTHORIZED,
      );
    }

    try {
      await this.twitterService.saveTwitterUser({
        userId: twitterUser.id,
        userName: twitterUser.username,
      });

      return res.redirect(
        `https://xfi-app.vercel.app/home?twitterId=${twitterUser.id}`,
      );
    } catch (err) {
      console.error(err);
      throw new HttpException(
        'Failed to save user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
