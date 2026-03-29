import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('ADMIN', 'ADMINISTRATIVO')
  @Post()
  create(
    @Body()
    body: {
      full_name: string;
      username: string;
      email?: string;
      password: string;
      role?: string;
    },
  ) {
    return this.usersService.create(body);
  }

  @Roles('ADMIN', 'ADMINISTRATIVO')
  @Get()
  findAll() {
    return this.usersService.findAll();
  }
}
