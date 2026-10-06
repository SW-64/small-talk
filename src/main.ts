import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const allowedOrigins = config.get<string[]>('cors.allowedOrigins') ?? [];
  app.enableCors({
    origin: allowedOrigins.length ? allowedOrigins : false,
  });

  if (config.get<boolean>('swagger.enabled')) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Smalltalk Today API')
        .setDescription('뉴스 기반 카테고리별 스몰토크 카드 API')
        .setVersion('0.1.0')
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(config.get<number>('app.port') ?? 3000);
}
void bootstrap();
