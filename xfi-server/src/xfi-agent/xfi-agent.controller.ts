// import { Body, Controller, Post } from '@nestjs/common';
// import { XfiAgentService } from './xfi-agent.service';

// @Controller('xfi-agent')
// export class XfiAgentController {
//   constructor(private readonly agentService: XfiAgentService) {}

//   @Post()
//   quote(@Body() payload: { prompt: string }) {
//     const privateKeyEVM =
//       '0xae33c3a7377093e254036b45c8c7e034b261e02aa00125e6bb79e6e18184e863'; // add privateKey here
//     return this.agentService.BaseAgent(privateKeyEVM, payload.prompt);
//   }
// }

// // privateKey: '0xae33c3a7377093e254036b45c8c7e034b261e02aa00125e6bb79e6e18184e863',
// // address: '0x70836E5A1905B88a41D6926D8913393997b8FC74'
