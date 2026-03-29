import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = [
    'http://localhost:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
