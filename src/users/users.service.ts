import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(data: {
    full_name: string;
    username: string;
    email?: string;
    password: string;
    role?: string;
  }) {
    const password_hash = await bcrypt.hash(data.password, 10);

    const user = this.usersRepository.create({
      full_name: data.full_name,
      username: data.username,
      email: data.email,
      password_hash,
      role: data.role ?? 'ADMINISTRATIVO',
    });

    return this.usersRepository.save(user);
  }

  findAll() {
    return this.usersRepository.find({
      where: { is_active: true },
    });
  }

  findByUsername(username: string) {
    return this.usersRepository.findOne({
      where: {
        username,
        is_active: true,
      },
    });
  }

  findById(id: number) {
    return this.usersRepository.findOne({
      where: {
        id,
        is_active: true,
      },
    });
  }
}
