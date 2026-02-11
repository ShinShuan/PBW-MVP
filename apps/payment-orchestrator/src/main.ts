import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // Enable CORS for TPE frontend
  await app.listen(process.env.PORT ?? 3000);
  console.log(`Payment Orchestrator running on: http://localhost:3000`);
}
bootstrap();
