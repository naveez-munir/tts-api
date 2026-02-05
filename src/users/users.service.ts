import { Injectable, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service.js';
import type { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email, isActive: true },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async create(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    role: 'CUSTOMER' | 'OPERATOR' | 'ADMIN';
  }): Promise<User> {
    if (data.phoneNumber) {
      const existingUserWithPhone = await this.prisma.user.findFirst({
        where: { phoneNumber: data.phoneNumber },
      });
      if (existingUserWithPhone) {
        throw new BadRequestException('Phone number already exists');
      }
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
    });
  }

  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany();
  }

  async update(
    id: string,
    data: Partial<User>,
  ): Promise<User> {
    if (data.email) {
      const existingUserWithEmail = await this.prisma.user.findFirst({
        where: { email: data.email, id: { not: id } },
      });
      if (existingUserWithEmail) {
        throw new BadRequestException('Email already exists');
      }
    }

    if (data.phoneNumber) {
      const existingUserWithPhone = await this.prisma.user.findFirst({
        where: { phoneNumber: data.phoneNumber, id: { not: id } },
      });
      if (existingUserWithPhone) {
        throw new BadRequestException('Phone number already exists');
      }
    }

    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<User> {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  async markEmailAsVerified(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: true },
    });
  }
}
