import { Controller, Post, Body, Patch, Param, Get } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { TwitterApi } from 'twitter-api-v2';

@Controller('users')
export class UserController {
  private twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);
  constructor(private readonly userService: UserService) { }

  @Post()
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.userService.createUser(createUserDto);
  }

  @Patch(':userId')
  async updateUser(
    @Param('userId') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.updateUser(userId, updateUserDto);
  }

  @Get(':userId')
  async getUser(@Param('userId') userId: string) {
    let twitterData: any = {};
    // try {
    //   twitterData = await this.twitterClient.v1.user({ user_id: userId });
    // } catch (err) {
    //   console.error('Failed to fetch Twitter user:', err);
    //   return null;
    // }
    const user = this.userService.getUserById(userId);
    return {
      ...user,
      username: "eketeUg",
      name: "EKETE"
    };
  }

  @Get('history/:userId')
  async getHistory(@Param('userId') userId: string) {
    return this.userService.getTransactionHistory(userId);
  }
}
