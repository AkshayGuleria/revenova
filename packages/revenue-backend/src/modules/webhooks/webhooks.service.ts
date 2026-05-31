import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateWebhookDto, VALID_EVENTS } from './dto';
import {
  buildSingleResponse,
  buildPaginatedListResponse,
} from '../../common/utils/response-builder';
import { ApiResponse } from '../../common/interfaces';
import { parseQuery } from '../../common/utils/query-parser';

@Injectable()
export class WebhooksService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateWebhookDto): Promise<ApiResponse<any>> {
    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId },
    });
    if (!account) {
      throw new NotFoundException(`Account ${dto.accountId} not found`);
    }

    const invalidEvents = dto.events.filter(
      (e) => !VALID_EVENTS.includes(e as any),
    );
    if (invalidEvents.length > 0) {
      throw new BadRequestException(
        `Invalid events: ${invalidEvents.join(', ')}. Valid events: ${VALID_EVENTS.join(', ')}`,
      );
    }

    const secret = crypto.randomBytes(32).toString('hex');

    const webhook = await this.prisma.webhookEndpoint.create({
      data: {
        accountId: dto.accountId,
        url: dto.url,
        secret,
        events: dto.events,
        description: dto.description ?? null,
        active: true,
      },
    });

    // Return secret on creation only — never exposed again
    return buildSingleResponse({ ...webhook, secret });
  }

  async findAll(query: Record<string, any>): Promise<ApiResponse<any>> {
    const { pagination, where } = parseQuery(query);
    const { offset, limit } = pagination;

    const [data, total] = await Promise.all([
      this.prisma.webhookEndpoint.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          accountId: true,
          url: true,
          events: true,
          active: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          // secret intentionally omitted from list responses
        },
      }),
      this.prisma.webhookEndpoint.count({ where }),
    ]);

    return buildPaginatedListResponse(data, offset, limit, total);
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
    const webhook = await this.prisma.webhookEndpoint.findUnique({
      where: { id },
      select: {
        id: true,
        accountId: true,
        url: true,
        events: true,
        active: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        // secret intentionally omitted
      },
    });
    if (!webhook) {
      throw new NotFoundException(`Webhook ${id} not found`);
    }
    return buildSingleResponse(webhook);
  }

  async deactivate(id: string): Promise<ApiResponse<any>> {
    const existing = await this.prisma.webhookEndpoint.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Webhook ${id} not found`);
    }
    const updated = await this.prisma.webhookEndpoint.update({
      where: { id },
      data: { active: false },
      select: {
        id: true,
        accountId: true,
        url: true,
        events: true,
        active: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return buildSingleResponse(updated);
  }

  async getDeliveries(webhookId: string): Promise<ApiResponse<any>> {
    const webhook = await this.prisma.webhookEndpoint.findUnique({
      where: { id: webhookId },
    });
    if (!webhook) {
      throw new NotFoundException(`Webhook ${webhookId} not found`);
    }

    const deliveries = await this.prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return buildPaginatedListResponse(deliveries, 0, 50, deliveries.length);
  }

  /**
   * Dispatch an event to all active matching webhooks for an account.
   * Called by other services (InvoicesService, PaymentsService, etc.) after mutations.
   * Creates a WebhookDelivery record then attempts HTTP delivery asynchronously.
   */
  async dispatch(
    accountId: string,
    event: string,
    payload: Record<string, any>,
  ): Promise<void> {
    const webhooks = await this.prisma.webhookEndpoint.findMany({
      where: { accountId, active: true, events: { has: event } },
    });

    for (const webhook of webhooks) {
      await this.prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          event,
          payload,
          status: 'pending',
        },
      });

      // Fire-and-forget HTTP delivery; errors are caught and recorded
      this.attemptDelivery(
        webhook.id,
        webhook.url,
        webhook.secret,
        event,
        payload,
      ).catch(() => {
        // Errors are swallowed here — they are recorded inside attemptDelivery
      });
    }
  }

  private async attemptDelivery(
    webhookId: string,
    url: string,
    secret: string,
    event: string,
    payload: Record<string, any>,
  ): Promise<void> {
    const body = JSON.stringify({
      event,
      data: payload,
      timestamp: new Date().toISOString(),
    });
    const signature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    let status: 'delivered' | 'failed';
    let responseStatus: number | null = null;
    let responseBody: string | null = null;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-Event': event,
        },
        body,
        signal: AbortSignal.timeout(10000),
      });
      responseStatus = res.status;
      responseBody = await res.text().catch(() => null);
      status = res.ok ? 'delivered' : 'failed';
    } catch {
      status = 'failed';
    }

    await this.prisma.webhookDelivery.updateMany({
      where: { webhookId, event, status: 'pending' },
      data: {
        status,
        responseStatus,
        responseBody,
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        deliveredAt: status === 'delivered' ? new Date() : null,
      },
    });
  }
}
