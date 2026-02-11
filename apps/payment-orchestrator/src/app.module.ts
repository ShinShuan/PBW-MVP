import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PriceEngineModule } from './price-engine/price-engine.module';
import { ValidationEngineModule } from './validation-engine/validation-engine.module';
import { PrismaModule } from './prisma/prisma.module';
import { SolanaModule } from './solana/solana.module';
import { TpeService } from './tpe.service';
import { SimulationController } from './simulation.controller';
import { SecurityMiddleware } from './auth/security.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PriceEngineModule,
    ValidationEngineModule,
    SolanaModule,
  ],
  controllers: [SimulationController],
  providers: [TpeService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SecurityMiddleware)
      .forRoutes(
        { path: 'payment/*', method: RequestMethod.POST },
      );
  }
}
