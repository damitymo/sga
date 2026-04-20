import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';

dotenv.config();

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_DATABASE || process.env.DB_NAME || 'sga',
  // Glob .ts y .js para que funcione tanto en dev (ts-node) como en prod (dist compilado).
  entities: [path.join(__dirname, '**/*.entity.{ts,js}')],
  migrations: [path.join(__dirname, 'migrations/*.{ts,js}')],
  migrationsTableName: 'migrations',
  synchronize: false,
  logging: false,
  ssl: process.env.DB_HOST?.includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
};

export const AppDataSource = new DataSource(dataSourceOptions);
