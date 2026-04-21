import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { ACCESS_TOKEN_COOKIE } from './auth.controller';

type JwtPayload = {
  sub: number;
  username: string;
  role: string;
  full_name: string;
  agent_id?: number | null;
};

/**
 * Extrae el JWT desde la cookie httpOnly que setea /auth/login.
 */
function cookieExtractor(req: Request): string | null {
  const cookies = (req as unknown as { cookies?: Record<string, string> })
    .cookies;
  if (cookies && typeof cookies[ACCESS_TOKEN_COOKIE] === 'string') {
    return cookies[ACCESS_TOKEN_COOKIE];
  }
  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    // La validación de JWT_SECRET ya corre en ConfigModule.validate al boot,
    // así que acá asumimos que existe y es >= 32 chars.
    const jwtSecret = config.get<string>('JWT_SECRET');

    super({
      // Primero intenta leer la cookie httpOnly; fallback al header Authorization
      // para compat con clientes / scripts que todavía manden Bearer.
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtSecret as string,
    });
  }

  validate(payload: JwtPayload) {
    return {
      id: payload.sub,
      userId: payload.sub,
      username: payload.username,
      full_name: payload.full_name,
      role: payload.role,
      agent_id: payload.agent_id ?? null,
    };
  }
}
