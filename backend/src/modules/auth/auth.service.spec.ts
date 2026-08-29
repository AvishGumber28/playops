import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';

interface MockUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
}

interface CreateArgs {
  data: { email: string; passwordHash: string; name: string };
  select?: unknown;
}

describe('AuthService', () => {
  let service: AuthService;
  let findUnique: jest.Mock<Promise<MockUser | null>, [unknown]>;
  let create: jest.Mock<
    Promise<Pick<MockUser, 'id' | 'email' | 'name'>>,
    [CreateArgs]
  >;
  let signMock: jest.Mock<string, [unknown]>;

  beforeEach(() => {
    findUnique = jest.fn<Promise<MockUser | null>, [unknown]>();
    create = jest.fn<
      Promise<Pick<MockUser, 'id' | 'email' | 'name'>>,
      [CreateArgs]
    >();
    signMock = jest.fn<string, [unknown]>().mockReturnValue('signed.jwt.token');

    const prisma = { user: { findUnique, create } } as unknown as PrismaService;
    const jwtService = { sign: signMock } as unknown as JwtService;
    const config = {
      get: jest.fn().mockReturnValue('@testcollege.edu'),
    } as unknown as ConfigService;

    service = new AuthService(prisma, jwtService, config);
  });

  describe('signup', () => {
    it('rejects an email outside the college domain', async () => {
      await expect(
        service.signup({
          name: 'Riya',
          email: 'riya@gmail.com',
          password: 'password123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a duplicate email', async () => {
      findUnique.mockResolvedValue({
        id: 'existing-user',
        email: 'riya@testcollege.edu',
        name: 'Riya',
        passwordHash: 'irrelevant',
      });
      await expect(
        service.signup({
          name: 'Riya',
          email: 'riya@testcollege.edu',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('hashes the password before storing it - never stores plain text', async () => {
      findUnique.mockResolvedValue(null);
      create.mockImplementation((args) =>
        Promise.resolve({
          id: 'new-user',
          email: args.data.email,
          name: args.data.name,
        }),
      );

      await service.signup({
        name: 'Riya',
        email: 'riya@testcollege.edu',
        password: 'password123',
      });

      const createArgs = create.mock.calls[0][0];
      expect(createArgs.data.passwordHash).not.toBe('password123');
      expect(
        await bcrypt.compare('password123', createArgs.data.passwordHash),
      ).toBe(true);
    });
  });

  describe('login', () => {
    it('rejects a non-existent email', async () => {
      findUnique.mockResolvedValue(null);
      await expect(
        service.login({
          email: 'nobody@testcollege.edu',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a wrong password', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'riya@testcollege.edu',
        name: 'Riya',
        passwordHash,
      });

      await expect(
        service.login({
          email: 'riya@testcollege.edu',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('issues a JWT on correct credentials', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'riya@testcollege.edu',
        name: 'Riya',
        passwordHash,
      });

      const result = await service.login({
        email: 'riya@testcollege.edu',
        password: 'correct-password',
      });

      expect(result.token).toBe('signed.jwt.token');
      expect(signMock).toHaveBeenCalledWith({ sub: 'user-1' });
    });
  });
});
