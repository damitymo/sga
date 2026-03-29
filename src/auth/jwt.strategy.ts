import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

type JwtPayload = {
  sub: number;
  username: string;
  role: string;
  full_name: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super-secret-key',
    });
  }

  validate(payload: JwtPayload) {
    return {
      id: payload.sub,
      userId: payload.sub,
      username: payload.username,
      full_name: payload.full_name,
      role: payload.role,
    };
  }
}
