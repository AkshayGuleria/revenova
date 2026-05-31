import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateContractDto, UpdateContractDto, QueryContractsDto } from './dto';
import { CreateContractProductDto } from './dto/contract-product.dto';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { parseQuery } from '../../common/utils/query-parser';
import {
  buildSingleResponse,
  buildPaginatedListResponse,
} from '../../common/utils/response-builder';
import { ApiResponse } from '../../common/interfaces';

@Injectable()
export class ContractsService {
  constructor(private prisma: PrismaService) {}

  async create(
    createContractDto: CreateContractDto,
  ): Promise<ApiResponse<any>> {
    const { accountId, startDate, endDate, products, ...data } =
      createContractDto;

    // Validate account exists
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${accountId} not found`);
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      throw new BadRequestException('End date must be after start date');
    }

    // Validate all product IDs exist
    const productIds = products.map((p) => p.productId);
    const existingProducts = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });

    const foundIds = new Set(existingProducts.map((p) => p.id));
    const missingIds = productIds.filter((id) => !foundIds.has(id));

    if (missingIds.length > 0) {
      throw new BadRequestException(
        `Products not found: ${missingIds.join(', ')}`,
      );
    }

    try {
      const contract = await this.prisma.$transaction(async (tx) => {
        const created = await tx.contract.create({
          data: {
            ...data,
            accountId,
            startDate: start,
            endDate: end,
          },
        });

        await tx.contractProduct.createMany({
          data: products.map((p) => ({
            contractId: created.id,
            productId: p.productId,
            quantity: p.quantity ?? 1,
            unitPrice: p.unitPrice ?? undefined,
            discount: p.discount ?? undefined,
            billingInterval: p.billingInterval ?? undefined,
          })),
        });

        return tx.contract.findUnique({
          where: { id: created.id },
          include: {
            products: {
              include: { product: true },
            },
          },
        });
      });

      return buildSingleResponse(contract);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'Contract with this number already exists',
          );
        }
      }
      throw error;
    }
  }

  async findAll(query: QueryContractsDto): Promise<ApiResponse<any>> {
    // Parse query parameters using utility
    const { pagination, where: parsedWhere } = parseQuery(query);

    const where: Prisma.ContractWhereInput = {
      ...parsedWhere,
    };

    const [contracts, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          account: {
            select: {
              id: true,
              accountName: true,
              status: true,
            },
          },
          _count: {
            select: {
              invoices: true,
            },
          },
        },
      }),
      this.prisma.contract.count({ where }),
    ]);

    return buildPaginatedListResponse(
      contracts,
      pagination.offset,
      pagination.limit,
      total,
    );
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        account: {
          select: {
            id: true,
            accountName: true,
            primaryContactEmail: true,
            status: true,
          },
        },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            total: true,
            issueDate: true,
            dueDate: true,
          },
          orderBy: {
            issueDate: 'desc',
          },
        },
        _count: {
          select: {
            invoices: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID ${id} not found`);
    }

    return buildSingleResponse(contract);
  }

  async update(
    id: string,
    updateContractDto: UpdateContractDto,
  ): Promise<ApiResponse<any>> {
    // Check if contract exists
    await this.findOne(id);

    const { accountId, startDate, endDate, ...data } = updateContractDto;

    // Validate account if being updated
    if (accountId) {
      const account = await this.prisma.account.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        throw new NotFoundException(`Account with ID ${accountId} not found`);
      }
    }

    // Validate dates if both are provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (end <= start) {
        throw new BadRequestException('End date must be after start date');
      }
    }

    try {
      const updateData: any = { ...data };

      if (accountId) updateData.accountId = accountId;
      if (startDate) updateData.startDate = new Date(startDate);
      if (endDate) updateData.endDate = new Date(endDate);

      const contract = await this.prisma.contract.update({
        where: { id },
        data: updateData,
      });

      return buildSingleResponse(contract);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'Contract with this number already exists',
          );
        }
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    // Check if contract exists
    await this.findOne(id);

    // Hard delete (no soft delete for contracts in schema)
    await this.prisma.contract.delete({
      where: { id },
    });
  }

  // ---------------------------------------------------------------------------
  // Contract-Product sub-endpoints (CP5/CP6)
  // ---------------------------------------------------------------------------

  async findProducts(contractId: string): Promise<ApiResponse<any>> {
    // Validate contract exists
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID ${contractId} not found`);
    }

    const contractProducts = await this.prisma.contractProduct.findMany({
      where: { contractId },
      include: { product: true },
      orderBy: { createdAt: 'asc' },
    });

    return buildPaginatedListResponse(
      contractProducts,
      0,
      contractProducts.length,
      contractProducts.length,
    );
  }

  async addProduct(
    contractId: string,
    dto: CreateContractProductDto,
  ): Promise<ApiResponse<any>> {
    // Validate contract exists
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID ${contractId} not found`);
    }

    // Validate product exists
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${dto.productId} not found`);
    }

    try {
      const contractProduct = await this.prisma.contractProduct.create({
        data: {
          contractId,
          productId: dto.productId,
          quantity: dto.quantity ?? 1,
          unitPrice: dto.unitPrice ?? undefined,
          discount: dto.discount ?? undefined,
          billingInterval: dto.billingInterval ?? undefined,
        },
        include: { product: true },
      });

      return buildSingleResponse(contractProduct);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            `Product ${dto.productId} is already attached to contract ${contractId}`,
          );
        }
      }
      throw error;
    }
  }

  async removeProduct(contractId: string, productId: string): Promise<void> {
    const contractProduct = await this.prisma.contractProduct.findUnique({
      where: {
        contractId_productId: { contractId, productId },
      },
    });

    if (!contractProduct) {
      throw new NotFoundException(
        `Product ${productId} is not attached to contract ${contractId}`,
      );
    }

    await this.prisma.contractProduct.delete({
      where: {
        contractId_productId: { contractId, productId },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Shared Contracts (Phase 3)
  // ---------------------------------------------------------------------------

  /**
   * Share a contract with another account (subsidiary)
   * Phase 3: Shared Contracts
   */
  async shareContract(
    contractId: string,
    accountId: string,
    notes?: string,
  ): Promise<ApiResponse<any>> {
    // Validate contract exists
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { account: { select: { id: true, accountName: true } } },
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID ${contractId} not found`);
    }

    // Validate target account exists
    const targetAccount = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true, accountName: true, parentAccountId: true },
    });

    if (!targetAccount) {
      throw new NotFoundException(`Account with ID ${accountId} not found`);
    }

    // Prevent sharing contract with its own owner
    if (contract.accountId === accountId) {
      throw new BadRequestException(
        'Cannot share contract with its owner account',
      );
    }

    // Check if already shared
    const existingShare = await this.prisma.contractShare.findUnique({
      where: {
        contractId_accountId: {
          contractId,
          accountId,
        },
      },
    });

    if (existingShare) {
      throw new ConflictException(
        `Contract is already shared with account ${accountId}`,
      );
    }

    // Create share
    const share = await this.prisma.contractShare.create({
      data: {
        contractId,
        accountId,
        notes,
      },
      include: {
        account: {
          select: {
            id: true,
            accountName: true,
          },
        },
        contract: {
          select: {
            id: true,
            contractNumber: true,
          },
        },
      },
    });

    return buildSingleResponse(share);
  }

  /**
   * Unshare a contract from an account
   */
  async unshareContract(contractId: string, accountId: string): Promise<void> {
    // Validate contract exists
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID ${contractId} not found`);
    }

    // Find share
    const share = await this.prisma.contractShare.findUnique({
      where: {
        contractId_accountId: {
          contractId,
          accountId,
        },
      },
    });

    if (!share) {
      throw new NotFoundException(
        `Contract is not shared with account ${accountId}`,
      );
    }

    // Delete share
    await this.prisma.contractShare.delete({
      where: {
        contractId_accountId: {
          contractId,
          accountId,
        },
      },
    });
  }

  /**
   * Get all accounts a contract is shared with
   */
  async getContractShares(contractId: string): Promise<ApiResponse<any>> {
    // Validate contract exists
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID ${contractId} not found`);
    }

    const shares = await this.prisma.contractShare.findMany({
      where: { contractId },
      include: {
        account: {
          select: {
            id: true,
            accountName: true,
            accountType: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return buildPaginatedListResponse(shares, 0, shares.length, shares.length);
  }

  /**
   * Get all contracts shared with a specific account
   */
  async getSharedContractsForAccount(
    accountId: string,
  ): Promise<ApiResponse<any>> {
    // Validate account exists
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${accountId} not found`);
    }

    const shares = await this.prisma.contractShare.findMany({
      where: { accountId },
      include: {
        contract: {
          include: {
            account: {
              select: {
                id: true,
                accountName: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return buildPaginatedListResponse(
      shares.map((s) => s.contract),
      0,
      shares.length,
      shares.length,
    );
  }
}
