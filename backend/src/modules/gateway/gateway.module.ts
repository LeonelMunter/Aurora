import { Module } from '@nestjs/common';

import { AppGateway } from './gateway';

@Module({
  providers: [AppGateway],
  exports: [AppGateway],
})
export class GatewayModule {}
