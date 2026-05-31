import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockPrismaService = {
  account: { findUnique: jest.fn() },
  webhookEndpoint: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  webhookDelivery: {
    create: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
};

describe('WebhooksService', () => {
  let service: WebhooksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // create
  // -----------------------------------------------------------------------
  describe('create', () => {
    it('should generate a secret, save webhook, and return secret in response', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({ id: 'acc-1' });
      mockPrismaService.webhookEndpoint.create.mockResolvedValue({
        id: 'wh-1',
        accountId: 'acc-1',
        url: 'https://example.com/hooks',
        events: ['invoice.created'],
        active: true,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        secret: 'stored-secret', // Prisma returns stored secret
      });

      const result = await service.create({
        accountId: 'acc-1',
        url: 'https://example.com/hooks',
        events: ['invoice.created'],
      });

      expect(result.data).toBeDefined();
      // The response must include secret (returned only at creation time)
      expect((result.data as any).secret).toBeDefined();
      expect((result.data as any).secret).toHaveLength(64); // 32 bytes hex = 64 chars
      expect(result.paging.total).toBeNull();

      // Verify create was called with all required fields including a non-empty secret
      expect(mockPrismaService.webhookEndpoint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountId: 'acc-1',
            url: 'https://example.com/hooks',
            events: ['invoice.created'],
            active: true,
          }),
        }),
      );
      const callArg = mockPrismaService.webhookEndpoint.create.mock.calls[0][0];
      expect(callArg.data.secret).toHaveLength(64);
    });

    it('should throw NotFoundException for unknown account', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          accountId: 'bad-acc',
          url: 'https://example.com/hooks',
          events: ['invoice.created'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid event names', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({ id: 'acc-1' });

      await expect(
        service.create({
          accountId: 'acc-1',
          url: 'https://example.com/hooks',
          events: ['invalid.event', 'another.bad'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept all valid event types without error', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({ id: 'acc-1' });
      mockPrismaService.webhookEndpoint.create.mockResolvedValue({
        id: 'wh-2',
        accountId: 'acc-1',
        url: 'https://example.com/hooks',
        events: ['invoice.created', 'payment.received'],
        active: true,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        secret: 'x'.repeat(64),
      });

      const result = await service.create({
        accountId: 'acc-1',
        url: 'https://example.com/hooks',
        events: ['invoice.created', 'payment.received'],
      });

      expect(result.data).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // findAll
  // -----------------------------------------------------------------------
  describe('findAll', () => {
    it('should return a paginated list without secret field', async () => {
      const webhooks = [
        {
          id: 'wh-1',
          accountId: 'acc-1',
          url: 'https://example.com',
          events: ['invoice.created'],
          active: true,
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          // Note: no secret field — Prisma select excludes it
        },
      ];
      mockPrismaService.webhookEndpoint.findMany.mockResolvedValue(webhooks);
      mockPrismaService.webhookEndpoint.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.paging.total).toBe(1);
      // Confirm select was used (no secret in response objects)
      const item = (result.data as any[])[0];
      expect(item).not.toHaveProperty('secret');
    });

    it('should apply query filters from operator-based query params', async () => {
      mockPrismaService.webhookEndpoint.findMany.mockResolvedValue([]);
      mockPrismaService.webhookEndpoint.count.mockResolvedValue(0);

      await service.findAll({ 'active[eq]': 'true' });

      expect(mockPrismaService.webhookEndpoint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.any(Object) }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // findOne
  // -----------------------------------------------------------------------
  describe('findOne', () => {
    it('should return webhook by id without secret', async () => {
      mockPrismaService.webhookEndpoint.findUnique.mockResolvedValue({
        id: 'wh-1',
        accountId: 'acc-1',
        url: 'https://example.com',
        events: ['invoice.created'],
        active: true,
        description: 'Test',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.findOne('wh-1');

      expect((result.data as any).id).toBe('wh-1');
      expect(result.paging.total).toBeNull();
      // secret must NOT be present
      expect(result.data).not.toHaveProperty('secret');
    });

    it('should throw NotFoundException for unknown webhook id', async () => {
      mockPrismaService.webhookEndpoint.findUnique.mockResolvedValue(null);

      await expect(service.findOne('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -----------------------------------------------------------------------
  // deactivate
  // -----------------------------------------------------------------------
  describe('deactivate', () => {
    it('should set active=false on the webhook', async () => {
      mockPrismaService.webhookEndpoint.findUnique.mockResolvedValue({
        id: 'wh-1',
        active: true,
      });
      mockPrismaService.webhookEndpoint.update.mockResolvedValue({
        id: 'wh-1',
        accountId: 'acc-1',
        url: 'https://example.com',
        events: ['invoice.created'],
        active: false,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.deactivate('wh-1');

      expect(mockPrismaService.webhookEndpoint.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'wh-1' },
          data: expect.objectContaining({ active: false }),
        }),
      );
      expect((result.data as any).active).toBe(false);
    });

    it('should throw NotFoundException for unknown webhook id', async () => {
      mockPrismaService.webhookEndpoint.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -----------------------------------------------------------------------
  // getDeliveries
  // -----------------------------------------------------------------------
  describe('getDeliveries', () => {
    it('should return delivery history for a known webhook', async () => {
      mockPrismaService.webhookEndpoint.findUnique.mockResolvedValue({
        id: 'wh-1',
      });
      const deliveries = [
        {
          id: 'del-1',
          webhookId: 'wh-1',
          event: 'invoice.created',
          payload: {},
          status: 'delivered',
          responseStatus: 200,
          attemptCount: 1,
          createdAt: new Date(),
        },
      ];
      mockPrismaService.webhookDelivery.findMany.mockResolvedValue(deliveries);

      const result = await service.getDeliveries('wh-1');

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.paging.total).toBe(1);
    });

    it('should throw NotFoundException for unknown webhook id', async () => {
      mockPrismaService.webhookEndpoint.findUnique.mockResolvedValue(null);

      await expect(service.getDeliveries('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -----------------------------------------------------------------------
  // dispatch
  // -----------------------------------------------------------------------
  describe('dispatch', () => {
    it('should create WebhookDelivery records for all active matching webhooks', async () => {
      const matchingWebhooks = [
        {
          id: 'wh-1',
          url: 'https://a.example.com/hook',
          secret: 'secret-a',
          events: ['invoice.created'],
          active: true,
        },
        {
          id: 'wh-2',
          url: 'https://b.example.com/hook',
          secret: 'secret-b',
          events: ['invoice.created'],
          active: true,
        },
      ];

      mockPrismaService.webhookEndpoint.findMany.mockResolvedValue(
        matchingWebhooks,
      );
      mockPrismaService.webhookDelivery.create.mockResolvedValue({
        id: 'del-x',
      });
      mockPrismaService.webhookDelivery.updateMany.mockResolvedValue({
        count: 1,
      });

      // Spy on attemptDelivery via fetch — mock global fetch to avoid network calls
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'OK',
      });
      global.fetch = mockFetch;

      await service.dispatch('acc-1', 'invoice.created', {
        invoiceId: 'inv-1',
      });

      // One delivery record per matching webhook
      expect(mockPrismaService.webhookDelivery.create).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.webhookDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            webhookId: 'wh-1',
            event: 'invoice.created',
            status: 'pending',
          }),
        }),
      );

      // findMany called with correct filters
      expect(mockPrismaService.webhookEndpoint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accountId: 'acc-1',
            active: true,
            events: { has: 'invoice.created' },
          }),
        }),
      );
    });

    it('should not create delivery records when no active webhooks match', async () => {
      mockPrismaService.webhookEndpoint.findMany.mockResolvedValue([]);

      await service.dispatch('acc-1', 'invoice.created', {});

      expect(mockPrismaService.webhookDelivery.create).not.toHaveBeenCalled();
    });
  });
});
