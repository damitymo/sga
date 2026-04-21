import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './dto/login.dto';

type AuthenticatedRequest = {
  user: {
    id: number;
    userId: number;
    username: string;
    full_name: string;
    role: string;
  };
};

/**
 * Nombre de la cookie httpOnly que lleva el JWT. Centralizado para
 * mantener consistencia entre login, logout y jwt.strategy.
 */
export const ACCESS_TOKEN_COOKIE = 'access_token';

/**
 * Opciones de la cookie:
 * - httpOnly: impide leerla desde JS (mitiga XSS).
 * - secure: true + sameSite: 'none' es necesario porque Vercel (frontend)
 *   y Render (backend) viven en dominios distintos en prod. En dev
 *   sobre localhost igual funciona porque el browser trata a localhost
 *   como secure context.
 * - maxAge: 1 día, igual que la expiración del JWT.
 * - path: '/' para que la cookie se envíe con cualquier request al backend.
 */
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  path: '/',
  maxAge: 24 * 60 * 60 * 1000,
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 5 intentos por minuto por IP
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(
      body.username,
      body.password,
    );

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const { access_token, user: safeUser } = this.authService.login(user);

    // El token viaja en cookie httpOnly; el body sólo lleva la info
    // no sensible del user para que el frontend la guarde en memoria
    // o localStorage (sin riesgo — no es un credential).
    res.cookie(ACCESS_TOKEN_COOKIE, access_token, COOKIE_OPTIONS);

    return { user: safeUser };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response) {
    // Limpiamos la cookie replicando las mismas opciones con las que
    // se creó (el browser requiere que path/sameSite/secure matcheen
    // para borrarla).
    res.clearCookie(ACCESS_TOKEN_COOKIE, COOKIE_OPTIONS);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req: AuthenticatedRequest) {
    return req.user;
  }
}
