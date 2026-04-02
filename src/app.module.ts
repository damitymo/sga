import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsModule } from './agents/agents.module';
import { PofModule } from './pof/pof.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { AttendanceModule } from './attendance/attendance.module';
import { RevistaModule } from './revista/revista.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import * as dotenv from 'dotenv';

dotenv.config();

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || '123456',
      database: process.env.DB_DATABASE || process.env.DB_NAME || 'sga',
      autoLoadEntities: true,
      synchronize: false,
      ssl: process.env.DB_HOST?.includes('render.com')
        ? { rejectUnauthorized: false }
        : false,
    }),
    AgentsModule,
    PofModule,
    AssignmentsModule,
    AttendanceModule,
    RevistaModule,
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
