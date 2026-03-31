import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Not, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Agent } from '../agents/entities/agent.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Agent)
    private readonly agentsRepository: Repository<Agent>,
  ) {}

  async create(data: CreateUserDto) {
    const existingUsername = await this.usersRepository.findOne({
      where: { username: data.username },
    });

    if (existingUsername) {
      throw new BadRequestException('Ya existe un usuario con ese username.');
    }

    if (data.email) {
      const existingEmail = await this.usersRepository.findOne({
        where: { email: data.email },
      });

      if (existingEmail) {
        throw new BadRequestException('Ya existe un usuario con ese email.');
      }
    }

    if (data.role === 'AGENTE' && !data.agent_id) {
      throw new BadRequestException(
        'Un usuario con rol AGENTE debe estar vinculado a un docente/agente.',
      );
    }

    if (data.agent_id) {
      const agentExists = await this.agentsRepository.findOne({
        where: { id: data.agent_id, is_active: true },
      });

      if (!agentExists) {
        throw new BadRequestException('El agente/docente indicado no existe.');
      }
    }

    const password_hash = await bcrypt.hash(data.password, 10);

    const userData: DeepPartial<User> = {
      full_name: data.full_name.trim(),
      username: data.username.trim(),
      email: data.email?.trim() || null,
      password_hash,
      role: data.role ?? 'ADMINISTRATIVO',
      is_active: true,
      agent_id: data.agent_id ?? null,
    };

    const user = this.usersRepository.create(userData);

    return this.usersRepository.save(user);
  }

  findAll() {
    return this.usersRepository.find({
      order: { full_name: 'ASC' },
    });
  }

  findActive() {
    return this.usersRepository.find({
      where: { is_active: true },
      order: { full_name: 'ASC' },
    });
  }

  async findById(id: number) {
    const user = await this.usersRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    return user;
  }

  findByUsername(username: string) {
    return this.usersRepository.findOne({
      where: {
        username,
        is_active: true,
      },
    });
  }

  async update(id: number, data: UpdateUserDto) {
    const user = await this.findById(id);

    if (data.username && data.username !== user.username) {
      const existingUsername = await this.usersRepository.findOne({
        where: {
          username: data.username,
          id: Not(id),
        },
      });

      if (existingUsername) {
        throw new BadRequestException('Ya existe un usuario con ese username.');
      }
    }

    if (data.email && data.email !== user.email) {
      const existingEmail = await this.usersRepository.findOne({
        where: {
          email: data.email,
          id: Not(id),
        },
      });

      if (existingEmail) {
        throw new BadRequestException('Ya existe un usuario con ese email.');
      }
    }

    const newRole = data.role ?? user.role;
    const newAgentId =
      data.agent_id !== undefined ? data.agent_id : user.agent_id;

    if (newRole === 'AGENTE' && !newAgentId) {
      throw new BadRequestException(
        'Un usuario con rol AGENTE debe estar vinculado a un docente/agente.',
      );
    }

    if (newAgentId) {
      const agentExists = await this.agentsRepository.findOne({
        where: { id: newAgentId, is_active: true },
      });

      if (!agentExists) {
        throw new BadRequestException('El agente/docente indicado no existe.');
      }
    }

    let password_hash = user.password_hash;

    if (data.password) {
      password_hash = await bcrypt.hash(data.password, 10);
    }

    await this.usersRepository.update(id, {
      full_name: data.full_name?.trim() ?? user.full_name,
      username: data.username?.trim() ?? user.username,
      email: data.email !== undefined ? data.email.trim() || null : user.email,
      password_hash,
      role: newRole,
      is_active: data.is_active ?? user.is_active,
      agent_id: newAgentId ?? null,
    });

    return this.findById(id);
  }

  async deactivate(id: number) {
    const user = await this.findById(id);

    await this.usersRepository.update(id, {
      is_active: false,
    });

    return {
      message: `Usuario ${user.username} desactivado correctamente.`,
    };
  }

  async activate(id: number) {
    const user = await this.findById(id);

    await this.usersRepository.update(id, {
      is_active: true,
    });

    return {
      message: `Usuario ${user.username} activado correctamente.`,
    };
  }
}
