import { Module } from '@nestjs/common';
import { OperatorsService } from './operators.service.js';
import { OperatorsController } from './operators.controller.js';

@Module({
  controllers: [OperatorsController],
  providers: [OperatorsService],
  exports: [OperatorsService],
})
export class OperatorsModule {}

