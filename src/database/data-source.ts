import 'dotenv/config';
import { DataSource } from 'typeorm';

const sslEnabled = process.env.DATABASE_SSL !== 'false';

export const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: sslEnabled ? { rejectUnauthorized: false } : false,
  entities: ['src/database/entities/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
});

export default dataSource;
