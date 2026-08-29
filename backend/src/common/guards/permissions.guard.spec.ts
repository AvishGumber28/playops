import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { AuthenticatedRequest } from '../types/authenticated-request';

function mockContext(
  userContext: { permissions: string[] } | undefined,
): ExecutionContext {
  const request = { userContext } as AuthenticatedRequest;
  return {
    switchToHttp: () => ({ getRequest: <T>() => request as T }),
    getHandler: () => (() => {}) as unknown as ExecutionContext['getHandler'],
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let reflector: jest.Mocked<Reflector>;
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = { get: jest.fn() } as unknown as jest.Mocked<Reflector>;
    guard = new PermissionsGuard(reflector);
  });

  it('allows the request if the route requires no permission', () => {
    reflector.get.mockReturnValue(undefined);
    const ctx = mockContext({ permissions: [] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects a user missing the required permission', () => {
    reflector.get.mockReturnValue('tournament:create');
    const ctx = mockContext({ permissions: ['tournament:view'] });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows a user who has the required permission', () => {
    reflector.get.mockReturnValue('tournament:create');
    const ctx = mockContext({ permissions: ['tournament:create'] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects when no userContext exists at all (unauthenticated slipping through)', () => {
    reflector.get.mockReturnValue('tournament:create');
    const ctx = mockContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
