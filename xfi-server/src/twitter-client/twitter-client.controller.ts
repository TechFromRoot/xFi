import { Body, Controller, Post } from '@nestjs/common';
import { ParseCommandService } from './parse-command';

@Controller('twitter-client')
export class TwitterClientController {
  constructor(private readonly handleDefiService: ParseCommandService) {}
  @Post()
  quote(@Body() payload: { prompt: string }) {
    // const privateKeyEVM =
    //   '0xae33c3a7377093e254036b45c8c7e034b261e02aa00125e6bb79e6e18184e863'; // add privateKey here
    return this.handleDefiService.handleTweetCommand(
      payload.prompt,
      '1881784875478630400',
    );
  }
}
