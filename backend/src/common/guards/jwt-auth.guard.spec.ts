import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthenticatedRequest } from '../types/authenticated-request';

function mockContext(headers: Record<string, string>): ExecutionContext {
  const request = { headers } as AuthenticatedRequest;
  return {
    switchToHttp: () => ({
      getRequest: <T>() => request as T,
    }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let jwtService: jest.Mocked<JwtService>;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jwtService = { verify: jest.fn() } as unknown as jest.Mocked<JwtService>;
    guard = new JwtAuthGuard(jwtService);
  });

  it('rejects a request with no authorization header', () => {
    const ctx = mockContext({});
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rejects a header that is not a Bearer token', () => {
    const ctx = mockContext({ authorization: 'Basic abc123' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rejects an invalid/expired token', () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    const ctx = mockContext({ authorization: 'Bearer bad.token.here' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('accepts a valid token and attaches userId to the request', () => {
    jwtService.verify.mockReturnValue({ sub: 'user-123' });
    const request = {
      headers: { authorization: 'Bearer good.token.here' },
    } as AuthenticatedRequest;
    const ctx = {
      switchToHttp: () => ({ getRequest: <T>() => request as T }),
    } as unknown as ExecutionContext;

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request.userId).toBe('user-123');
  });
});
