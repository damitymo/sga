import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AgentsModule } from './agents/agents.module';
import { PofModule } from './pof/pof.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { AttendanceModule } from './attendance/attendance.module';
import { RevistaModule } from './revista/revista.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { dataSourceOptions } from './data-source';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    // Config global: carga .env y valida variables al arranque.
    // Cualquier módulo puede inyectar ConfigService sin volver a importar ConfigModule.
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    // Rate-limit global: 100 requests por minuto por IP.
    // Endpoints sensibles pueden sobreescribirlo con @Throttle() (ej: login).
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]),
    TypeOrmModule.forRoot({
      ...dataSourceOptions,
      autoLoadEntities: true,
    }),
    AgentsModule,
    PofModule,
    AssignmentsModule,
    AttendanceModule,
    RevistaModule,
    UsersModule,
    AuthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
