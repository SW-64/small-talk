import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV,
  port: parseInt(process.env.PORT ?? '3000', 10),
}));

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL !== 'false',
}));

export const corsConfig = registerAs('cors', () => ({
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
}));

export const swaggerConfig = registerAs('swagger', () => ({
  enabled: process.env.SWAGGER_ENABLED === 'true',
}));

export const naverConfig = registerAs('naver', () => ({
  keyId: process.env.NAVER_APIHUB_KEY_ID ?? '',
  key: process.env.NAVER_APIHUB_KEY ?? '',
  newsUrl: 'https://naverapihub.apigw.ntruss.com/search/v1/news',
  datalabUrl: 'https://naverapihub.apigw.ntruss.com/search-trend/v1/search',
}));
