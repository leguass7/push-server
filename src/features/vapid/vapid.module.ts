import { Module } from '@nestjs/common';

import { VapidController } from './vapid.controller';

@Module({
  controllers: [VapidController],
})
export class VapidModule {}
