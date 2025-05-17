import { Injectable } from '@nestjs/common';
import { UserService } from 'src/twitter-client/user.service';

@Injectable()
export class TwitterOAuthService {
    constructor(
        private readonly userService: UserService
    ) { }

    public async saveTwitterUser(createUserDto: {
        userId;
        userName: string;
        chains?: string[];
    }) {
        //check if user exists
        const user = await this.userService.getUserById(createUserDto.userId);
        if (!user) {
            //create user
            await this.userService.createUser(createUserDto);
        }
    }
}
