import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Render (y la mayoría de PaaS) ponen un reverse proxy delante.
  // Sin esto, throttler / rate-limit verían siempre la misma IP del proxy.
  app.set('trust proxy', 1);

  app.use(helmet());

  // Necesario para leer la cookie httpOnly con el JWT desde jwt.strategy.
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const frontendUrl = config.get<string>('FRONTEND_URL');
  const allowedOrigins = ['http://localhost:3000', frontendUrl].filter(
    (origin): origin is string => Boolean(origin),
  );

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  const port = config.get<number>('PORT') ?? 3001;
  await app.listen(port);
}
bootstrap();
