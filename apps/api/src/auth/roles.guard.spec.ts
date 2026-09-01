import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';

class TestController {}

function createContext(userRoles: string[]): ExecutionContext {
  const handler = () => undefined;
  Reflect.defineMetadata(ROLES_KEY, ['ADMIN'], handler);

  return {
    getClass: () => TestController,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({ user: { roles: userRoles } }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows users with a required role', () => {
    const guard = new RolesGuard(new Reflector());

    expect(guard.canActivate(createContext(['ADMIN']))).toBe(true);
  });

  it('rejects users without a required role', () => {
    const guard = new RolesGuard(new Reflector());

    expect(guard.canActivate(createContext(['TRAVELER']))).toBe(false);
  });
});
