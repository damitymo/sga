import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

type JwtPayload = {
  sub: number;
  username: string;
  role: string;
  full_name: string;
  agent_id?: number | null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    // La validación de JWT_SECRET ya corre en ConfigModule.validate al boot,
    // así que acá asumimos que existe y es >= 32 chars.
    const jwtSecret = config.get<string>('JWT_SECRET');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
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
