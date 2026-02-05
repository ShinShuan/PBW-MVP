import { Module } from '@nestjs/common';
import { ValidationEngineService } from './validation-engine.service';

@Module({
  providers: [ValidationEngineService]
})
export class ValidationEngineModule {}
