import { Test } from '@nestjs/testing';
import { CreditHoldGuard } from './credit-hold.guard';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';

const mockPrismaService = {
  account: { findUnique: jest.fn() },
};

const mockContext = (body: any): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ body }),
    }),
  }) as any;

describe('CreditHoldGuard', () => {
  let guard: CreditHoldGuard;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CreditHoldGuard,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();
    guard = module.get(CreditHoldGuard);
    jest.clearAllMocks();
  });

  it('should allow when account not on credit hold', async () => {
    mockPrismaService.account.findUnique.mockResolvedValue({
      creditHold: false,
      accountName: 'Acme',
    });
    const result = await guard.canActivate(mockContext({ accountId: 'acc-1' }));
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when account on credit hold', async () => {
    mockPrismaService.account.findUnique.mockResolvedValue({
      creditHold: true,
      accountName: 'Acme',
    });
    await expect(
      guard.canActivate(mockContext({ accountId: 'acc-1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should include billing contact message in ForbiddenException', async () => {
    mockPrismaService.account.findUnique.mockResolvedValue({
      creditHold: true,
      accountName: 'Acme',
    });
    await expect(
      guard.canActivate(mockContext({ accountId: 'acc-1' })),
    ).rejects.toThrow(
      'Account is on credit hold. Contact billing to resolve before creating invoices.',
    );
  });

  it('should allow when no accountId in body', async () => {
    const result = await guard.canActivate(mockContext({}));
    expect(result).toBe(true);
    expect(mockPrismaService.account.findUnique).not.toHaveBeenCalled();
  });

  it('should allow when body is empty', async () => {
    const result = await guard.canActivate(mockContext(null));
    expect(result).toBe(true);
    expect(mockPrismaService.account.findUnique).not.toHaveBeenCalled();
  });

  it('should allow when account not found (validation handled elsewhere)', async () => {
    mockPrismaService.account.findUnique.mockResolvedValue(null);
    const result = await guard.canActivate(mockContext({ accountId: 'unknown-id' }));
    expect(result).toBe(true);
  });

  it('should query correct account by id', async () => {
    mockPrismaService.account.findUnique.mockResolvedValue({
      creditHold: false,
      accountName: 'Test Corp',
    });
    await guard.canActivate(mockContext({ accountId: 'specific-acc-id' }));
    expect(mockPrismaService.account.findUnique).toHaveBeenCalledWith({
      where: { id: 'specific-acc-id' },
      select: { creditHold: true, accountName: true },
    });
  });
});
