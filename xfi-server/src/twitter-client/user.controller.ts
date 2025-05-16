import { Controller, Post, Body, Patch, Param, Get } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

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
    return this.userService.getUserById(userId);
  }

  @Get('history/:userId')
  async getHistory(@Param('userId') userId: string) {
    return this.userService.getTransactionHistory(userId);
  }
}
