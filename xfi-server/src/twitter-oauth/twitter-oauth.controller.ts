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

  @Get()
  async twitterAuthRedirect(@Res() res: Response) {
    // Initiate Twitter OAuth
    return res.redirect('xfi/auth/twitter/login');
  }

  @Get('login')
  @UseGuards(AuthGuard('twitter'))
  twitterLogin() {
    // Redirect handled by Passport
  }

  @Get('callback')
  @UseGuards(AuthGuard('twitter'))
  async twitterCallback(@Req() req: Request, @Res() res: Response) {
    if (!req.user) {
      throw new HttpException(
        'User not authenticated',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const twitterUser = req.user as any;
    console.log(twitterUser);
    // You can update the user DB here if needed
    try {
      // await this.twitterService.saveTwitterUser(twitterUser, email);
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
