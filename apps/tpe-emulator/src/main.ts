import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    // Serve static files from the public folder
    app.useStaticAssets(join(__dirname, '..', 'public'));

    await app.listen(8081);
    console.log(`TPE Emulator running on: http://localhost:8081`);
}
bootstrap();
