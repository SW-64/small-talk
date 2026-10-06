import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  appConfig,
  corsConfig,
  databaseConfig,
  swaggerConfig,
} from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      load: [appConfig, databaseConfig, corsConfig, swaggerConfig],
    }),
    DatabaseModule,
    HealthModule,
  ],
})
export class AppModule {}
