import {
  Body,
  Controller,
  Post,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { RegisterSchema } from './dto/register.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import { LoginSchema } from './dto/login.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto,
  ) {
    try {
      const user = await this.usersService.create(dto);
      const { password: _, ...userWithoutPassword } = user;
      return {
        success: true,
        data: userWithoutPassword,
        message: 'User registered successfully',
      };
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException('Email already exists');
      }
      throw error;
    }
  }

  @Post('login')
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto,
  ) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) {
      throw new BadRequestException('Invalid email or password');
    }

    const result = await this.authService.login({
      ...user,
      password: '', // Placeholder since we don't have it
    } as any);

    return {
      success: true,
      data: result,
    };
  }
}
