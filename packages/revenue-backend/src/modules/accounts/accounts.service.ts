import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateAccountDto,
  UpdateAccountDto,
  QueryAccountsDto,
  UpdateCreditDto,
} from './dto';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { parseQuery } from '../../common/utils/query-parser';
import {
  buildSingleResponse,
  buildPaginatedListResponse,
} from '../../common/utils/response-builder';
import { ApiResponse } from '../../common/interfaces';

@Injectable()
export class AccountsService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async create(createAccountDto: CreateAccountDto): Promise<ApiResponse<any>> {
    const { parentAccountId, ...data } = createAccountDto;
    const currency =
      data.currency ??
      this.configService.get<string>('DEFAULT_CURRENCY', 'EUR');
    data.currency = currency;

    // Validate parent account exists if provided
    if (parentAccountId) {
      const parentAccount = await this.prisma.account.findUnique({
        where: { id: parentAccountId },
      });

      if (!parentAccount) {
        throw new NotFoundException(
          `Parent account with ID ${parentAccountId} not found`,
        );
      }

      // Prevent creating circular hierarchy
      if (parentAccountId === data.primaryContactEmail) {
        throw new BadRequestException(
          'Cannot create circular account hierarchy',
        );
      }
    }

    try {
      const account = await this.prisma.account.create({
        data: {
          ...data,
          parentAccountId,
        },
      });

      return buildSingleResponse(account);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Account with this email already exists');
        }
      }
      throw error;
    }
  }

  async findAll(query: QueryAccountsDto): Promise<ApiResponse<any>> {
    // Parse query parameters using utility
    const { pagination, where: parsedWhere } = parseQuery(query);

    // Build complete where clause
    const where: Prisma.AccountWhereInput = {
      ...parsedWhere,
      deletedAt: null, // Always exclude soft-deleted accounts
    };

    const [accounts, total] = await Promise.all([
      this.prisma.account.findMany({
        where,
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          parent: {
            select: {
              id: true,
              accountName: true,
            },
          },
          _count: {
            select: {
              children: true,
              contracts: true,
              invoices: true,
            },
          },
        },
      }),
      this.prisma.account.count({ where }),
    ]);

    return buildPaginatedListResponse(
      accounts,
      pagination.offset,
      pagination.limit,
      total,
    );
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: {
        parent: {
          select: {
            id: true,
            accountName: true,
          },
        },
        children: {
          select: {
            id: true,
            accountName: true,
            status: true,
          },
        },
        contracts: {
          select: {
            id: true,
            contractNumber: true,
            status: true,
            startDate: true,
            endDate: true,
          },
          where: {
            status: 'active',
          },
        },
        _count: {
          select: {
            children: true,
            contracts: true,
            invoices: true,
          },
        },
      },
    });

    if (!account || account.deletedAt) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    return buildSingleResponse(account);
  }

  async update(
    id: string,
    updateAccountDto: UpdateAccountDto,
  ): Promise<ApiResponse<any>> {
    // Check if account exists (this will throw if not found)
    await this.findOne(id);

    const { parentAccountId, ...data } = updateAccountDto;

    // Validate parent account if being updated
    if (parentAccountId !== undefined) {
      if (parentAccountId) {
        const parentAccount = await this.prisma.account.findUnique({
          where: { id: parentAccountId },
        });

        if (!parentAccount) {
          throw new NotFoundException(
            `Parent account with ID ${parentAccountId} not found`,
          );
        }

        // Prevent self-referencing
        if (parentAccountId === id) {
          throw new BadRequestException('Account cannot be its own parent');
        }

        // Check for circular hierarchy
        await this.checkCircularHierarchy(id, parentAccountId);
      }
    }

    try {
      const account = await this.prisma.account.update({
        where: { id },
        data: {
          ...data,
          ...(parentAccountId !== undefined && { parentAccountId }),
        },
      });

      return buildSingleResponse(account);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Account with this email already exists');
        }
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    // Check if account exists (this will throw if not found)
    await this.findOne(id);

    // Soft delete
    await this.prisma.account.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'inactive',
      },
    });
  }

  /**
   * Get full account hierarchy tree (all descendants)
   * Uses recursive traversal with max depth of 5 levels
   */
  async getHierarchy(id: string, maxDepth = 5): Promise<ApiResponse<any>> {
    // Verify account exists
    const rootAccount = await this.prisma.account.findUnique({
      where: { id },
      include: {
        parent: {
          select: {
            id: true,
            accountName: true,
          },
        },
      },
    });

    if (!rootAccount || rootAccount.deletedAt) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    // Build hierarchy tree recursively
    const tree = await this.buildAccountTree(rootAccount, 0, maxDepth);

    return buildSingleResponse(tree);
  }

  /**
   * Get all direct children of an account
   */
  async getChildren(id: string): Promise<ApiResponse<any>> {
    // Verify parent account exists
    const parentAccount = await this.prisma.account.findUnique({
      where: { id },
    });

    if (!parentAccount || parentAccount.deletedAt) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    const children = await this.prisma.account.findMany({
      where: {
        parentAccountId: id,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            children: true,
            contracts: true,
            invoices: true,
          },
        },
      },
      orderBy: { accountName: 'asc' },
    });

    return buildPaginatedListResponse(
      children,
      0,
      children.length,
      children.length,
    );
  }

  /**
   * Get all ancestors (parent, grandparent, etc.) of an account
   */
  async getAncestors(id: string): Promise<ApiResponse<any>> {
    // Verify account exists
    const account = await this.prisma.account.findUnique({
      where: { id },
    });

    if (!account || account.deletedAt) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    const ancestors = [];
    let currentId = account.parentAccountId;
    let depth = 0;
    const maxDepth = 5;

    // Traverse up the parent chain
    while (currentId && depth < maxDepth) {
      const parent = await this.prisma.account.findUnique({
        where: { id: currentId },
        select: {
          id: true,
          parentAccountId: true,
          accountName: true,
          accountType: true,
          status: true,
          primaryContactEmail: true,
          deletedAt: true,
        },
      });

      if (!parent || parent.deletedAt) {
        break;
      }

      ancestors.push({ ...parent, depth: depth + 1 });
      currentId = parent.parentAccountId;
      depth++;
    }

    // Reverse to show from top (root) to bottom (immediate parent)
    ancestors.reverse();

    return buildPaginatedListResponse(
      ancestors,
      0,
      ancestors.length,
      ancestors.length,
    );
  }

  /**
   * Get all descendants (children, grandchildren, etc.) of an account
   * Returns flat list of all accounts in the hierarchy
   */
  async getDescendants(id: string): Promise<ApiResponse<any>> {
    // Verify account exists
    const account = await this.prisma.account.findUnique({
      where: { id },
    });

    if (!account || account.deletedAt) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    const descendants = [];
    await this.collectDescendants(id, descendants, 0, 5);

    return buildPaginatedListResponse(
      descendants,
      0,
      descendants.length,
      descendants.length,
    );
  }

  /**
   * Recursively build account tree with children
   */
  private async buildAccountTree(
    account: any,
    currentDepth: number,
    maxDepth: number,
  ): Promise<any> {
    if (currentDepth >= maxDepth) {
      return { ...account, children: [] };
    }

    const children = await this.prisma.account.findMany({
      where: {
        parentAccountId: account.id,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            children: true,
            contracts: true,
            invoices: true,
          },
        },
      },
      orderBy: { accountName: 'asc' },
    });

    const childrenWithDescendants = await Promise.all(
      children.map((child) =>
        this.buildAccountTree(child, currentDepth + 1, maxDepth),
      ),
    );

    return {
      ...account,
      depth: currentDepth,
      children: childrenWithDescendants,
    };
  }

  /**
   * Recursively collect all descendants
   */
  private async collectDescendants(
    parentId: string,
    result: any[],
    currentDepth: number,
    maxDepth: number,
  ): Promise<void> {
    if (currentDepth >= maxDepth) {
      return;
    }

    const children = await this.prisma.account.findMany({
      where: {
        parentAccountId: parentId,
        deletedAt: null,
      },
      select: {
        id: true,
        parentAccountId: true,
        accountName: true,
        accountType: true,
        status: true,
        primaryContactEmail: true,
      },
      orderBy: { accountName: 'asc' },
    });

    for (const child of children) {
      result.push({ ...child, depth: currentDepth + 1 });
      await this.collectDescendants(
        child.id,
        result,
        currentDepth + 1,
        maxDepth,
      );
    }
  }

  async getCreditStatus(id: string): Promise<ApiResponse<any>> {
    const account = await this.prisma.account.findUnique({
      where: { id },
      select: {
        id: true,
        accountName: true,
        creditLimit: true,
        creditHold: true,
        currency: true,
      },
    });
    if (!account) throw new NotFoundException(`Account ${id} not found`);

    const outstanding = await this.prisma.invoice.aggregate({
      where: { accountId: id, status: { in: ['sent', 'overdue'] } },
      _sum: { total: true },
    });

    const totalOutstanding = Number(outstanding._sum.total ?? 0);
    const creditLimit =
      account.creditLimit ? Number(account.creditLimit) : null;
    const availableCredit =
      creditLimit !== null ? creditLimit - totalOutstanding : null;
    const utilizationPercent =
      creditLimit !== null && creditLimit > 0
        ? parseFloat(((totalOutstanding / creditLimit) * 100).toFixed(2))
        : null;

    return buildSingleResponse({
      accountId: account.id,
      accountName: account.accountName,
      currency: account.currency,
      creditLimit,
      creditHold: account.creditHold,
      totalOutstanding,
      availableCredit,
      utilizationPercent,
    });
  }

  async updateCredit(
    id: string,
    dto: UpdateCreditDto,
  ): Promise<ApiResponse<any>> {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) throw new NotFoundException(`Account ${id} not found`);

    const updated = await this.prisma.account.update({
      where: { id },
      data: {
        ...(dto.creditLimit !== undefined && { creditLimit: dto.creditLimit }),
        ...(dto.creditHold !== undefined && { creditHold: dto.creditHold }),
      },
    });
    return buildSingleResponse(updated);
  }

  /**
   * Check for circular hierarchy by traversing parent chain
   */
  private async checkCircularHierarchy(
    accountId: string,
    newParentId: string,
  ): Promise<void> {
    let currentId = newParentId;
    const visited = new Set<string>([accountId]);

    while (currentId) {
      if (visited.has(currentId)) {
        throw new BadRequestException(
          'Cannot create circular account hierarchy',
        );
      }

      visited.add(currentId);

      const parent = await this.prisma.account.findUnique({
        where: { id: currentId },
        select: { parentAccountId: true },
      });

      currentId = parent?.parentAccountId || null;
    }
  }
}
