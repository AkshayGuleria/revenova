import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buildSingleResponse } from '../../common/utils/response-builder';
import { ApiResponse } from '../../common/interfaces';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculate MRR from all active contracts as of a point in time.
   *
   * Per-billing-frequency normalisation:
   *   monthly   → contractValue (already monthly)
   *   quarterly → contractValue / 3
   *   annual    → contractValue / 12  (default)
   */
  async getMrr(asOf?: string): Promise<ApiResponse<any>> {
    const asOfDate = asOf ? new Date(asOf) : new Date();

    const activeContracts = await this.prisma.contract.findMany({
      where: {
        status: 'active',
        startDate: { lte: asOfDate },
        endDate: { gte: asOfDate },
      },
      select: { contractValue: true, billingFrequency: true },
    });

    let mrr = 0;
    for (const c of activeContracts) {
      const value = Number(c.contractValue);
      if (c.billingFrequency === 'monthly') {
        mrr += value;
      } else if (c.billingFrequency === 'quarterly') {
        mrr += value / 3;
      } else {
        // annual (default)
        mrr += value / 12;
      }
    }

    return buildSingleResponse({
      asOf: asOfDate.toISOString().split('T')[0],
      mrr: parseFloat(mrr.toFixed(2)),
      activeContracts: activeContracts.length,
    });
  }

  /**
   * ARR = MRR × 12
   */
  async getArr(asOf?: string): Promise<ApiResponse<any>> {
    const mrrResponse = await this.getMrr(asOf);
    const { mrr, asOf: asOfDate, activeContracts } = mrrResponse.data as any;

    return buildSingleResponse({
      asOf: asOfDate,
      arr: parseFloat((mrr * 12).toFixed(2)),
      mrr,
      activeContracts,
    });
  }

  /**
   * Combined dashboard summary: MRR, ARR, active contracts, total accounts.
   */
  async getSummary(asOf?: string): Promise<ApiResponse<any>> {
    const asOfDate = asOf ? new Date(asOf) : new Date();

    const [activeContractCount, totalAccounts, mrrResponse] = await Promise.all(
      [
        this.prisma.contract.count({
          where: {
            status: 'active',
            startDate: { lte: asOfDate },
            endDate: { gte: asOfDate },
          },
        }),
        this.prisma.account.count({
          where: { status: 'active', deletedAt: null },
        }),
        this.getMrr(asOf),
      ],
    );

    const mrr = (mrrResponse.data as any).mrr;

    return buildSingleResponse({
      asOf: asOfDate.toISOString().split('T')[0],
      mrr,
      arr: parseFloat((mrr * 12).toFixed(2)),
      activeContracts: activeContractCount,
      totalAccounts,
      currency: 'EUR',
    });
  }

  /**
   * Churn: contracts that moved to expired/cancelled within the date range.
   * Reports the annualised contract value lost (churnedArr).
   */
  async getChurn(from?: string, to?: string): Promise<ApiResponse<any>> {
    const fromDate = from ? new Date(from) : this._startOfYear();
    const toDate = to ? new Date(to) : new Date();

    if (fromDate > toDate) {
      throw new BadRequestException('from date must be before to date');
    }

    const churned = await this.prisma.contract.findMany({
      where: {
        status: { in: ['expired', 'cancelled'] },
        endDate: { gte: fromDate, lte: toDate },
      },
      select: {
        contractValue: true,
        billingFrequency: true,
        accountId: true,
        contractNumber: true,
      },
    });

    let churnedArr = 0;
    for (const c of churned) {
      const value = Number(c.contractValue);
      if (c.billingFrequency === 'monthly') {
        churnedArr += value * 12;
      } else if (c.billingFrequency === 'quarterly') {
        churnedArr += value * 4;
      } else {
        // annual — contractValue is already annual
        churnedArr += value;
      }
    }

    return buildSingleResponse({
      from: fromDate.toISOString().split('T')[0],
      to: toDate.toISOString().split('T')[0],
      churnedContracts: churned.length,
      churnedArr: parseFloat(churnedArr.toFixed(2)),
    });
  }

  /**
   * Bookings: new contracts created within the date range.
   * totalBookings is the sum of contractValue (total deal value, not annualised).
   */
  async getBookings(from?: string, to?: string): Promise<ApiResponse<any>> {
    const fromDate = from ? new Date(from) : this._startOfYear();
    const toDate = to ? new Date(to) : new Date();

    if (fromDate > toDate) {
      throw new BadRequestException('from date must be before to date');
    }

    const newContracts = await this.prisma.contract.findMany({
      where: {
        createdAt: { gte: fromDate, lte: toDate },
      },
      select: {
        contractValue: true,
        billingFrequency: true,
        contractNumber: true,
        accountId: true,
      },
    });

    const totalBookings = newContracts.reduce(
      (sum, c) => sum + Number(c.contractValue),
      0,
    );

    return buildSingleResponse({
      from: fromDate.toISOString().split('T')[0],
      to: toDate.toISOString().split('T')[0],
      newContracts: newContracts.length,
      totalBookings: parseFloat(totalBookings.toFixed(2)),
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _startOfYear(): Date {
    const d = new Date();
    d.setMonth(0, 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
