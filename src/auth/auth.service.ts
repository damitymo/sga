import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../users/entities/user.entity';

type SafeUser = {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  role: string;
  is_active: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(
    username: string,
    password: string,
  ): Promise<SafeUser | null> {
    const user = await this.usersRepository.findOne({
      where: { username, is_active: true },
    });

    if (!user) return null;

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) return null;

    return {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      email: user.email ?? null,
      role: user.role,
      is_active: user.is_active,
    };
  }

  login(user: SafeUser) {
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      full_name: user.full_name,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
      },
    };
  }
}
