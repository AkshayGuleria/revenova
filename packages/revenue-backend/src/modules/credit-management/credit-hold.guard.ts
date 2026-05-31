import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CreditHoldGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const accountId = request.body?.accountId;
    if (!accountId) return true; // No accountId in body, skip check

    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { creditHold: true, accountName: true },
    });

    if (!account) return true; // Account validation handled elsewhere
    if (account.creditHold) {
      throw new ForbiddenException(
        `Account is on credit hold. Contact billing to resolve before creating invoices.`,
      );
    }
    return true;
  }
}
