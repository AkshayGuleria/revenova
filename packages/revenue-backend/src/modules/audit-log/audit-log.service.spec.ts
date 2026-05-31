import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from './audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrismaService = {
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
};

describe('AuditLogService', () => {
  let service: AuditLogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    jest.clearAllMocks();
  });

  // Test 1: log() calls prisma.auditLog.create with correct fields
  describe('log', () => {
    it('should call prisma.auditLog.create with all provided fields', async () => {
      mockPrismaService.auditLog.create.mockResolvedValue({});

      await service.log({
        entityType: 'invoice',
        entityId: 'inv-uuid-001',
        action: 'created',
        actorId: 'user-uuid-001',
        actorType: 'user',
        changes: { status: { from: 'draft', to: 'sent' } },
        metadata: { invoiceNumber: 'INV-2026-000001' },
      });

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          entityType: 'invoice',
          entityId: 'inv-uuid-001',
          action: 'created',
          actorId: 'user-uuid-001',
          actorType: 'user',
          changes: { status: { from: 'draft', to: 'sent' } },
          metadata: { invoiceNumber: 'INV-2026-000001' },
        },
      });
    });

    // Test 2: log() with actorType defaults to 'system'
    it('should default actorType to "system" when not provided', async () => {
      mockPrismaService.auditLog.create.mockResolvedValue({});

      await service.log({
        entityType: 'contract',
        entityId: 'con-uuid-001',
        action: 'updated',
      });

      const callData =
        mockPrismaService.auditLog.create.mock.calls[0][0].data;
      expect(callData.actorType).toBe('system');
      expect(callData.actorId).toBeNull();
      expect(callData.changes).toBeNull();
      expect(callData.metadata).toBeNull();
    });
  });

  // Test 3: findAll() returns paginated list
  describe('findAll', () => {
    it('should return a paginated list with correct paging metadata', async () => {
      const fakeLogs = [
        { id: 'log-1', entityType: 'invoice', entityId: 'inv-1', action: 'created' },
        { id: 'log-2', entityType: 'invoice', entityId: 'inv-2', action: 'paid' },
      ];
      mockPrismaService.auditLog.findMany.mockResolvedValue(fakeLogs);
      mockPrismaService.auditLog.count.mockResolvedValue(2);

      const result = await service.findAll({
        'offset[eq]': '0',
        'limit[eq]': '20',
      });

      expect(result.data).toEqual(fakeLogs);
      expect(result.paging.total).toBe(2);
      expect(result.paging.offset).toBe(0);
      expect(result.paging.limit).toBe(20);
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
          skip: 0,
          take: 20,
        }),
      );
    });

    // Test 4: findAll() filters by entityType
    it('should pass entityType filter to Prisma where clause', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      await service.findAll({ 'entityType[eq]': 'invoice' });

      const findManyCall = mockPrismaService.auditLog.findMany.mock.calls[0][0];
      expect(findManyCall.where).toMatchObject({ entityType: 'invoice' });
    });
  });

  // Test 5: findByEntity() returns all logs for entity ordered by createdAt desc
  describe('findByEntity', () => {
    it('should return all logs for the given entityType and entityId ordered by createdAt desc', async () => {
      const logs = [
        {
          id: 'log-2',
          entityType: 'invoice',
          entityId: 'inv-abc',
          action: 'paid',
          createdAt: new Date('2026-05-02'),
        },
        {
          id: 'log-1',
          entityType: 'invoice',
          entityId: 'inv-abc',
          action: 'created',
          createdAt: new Date('2026-05-01'),
        },
      ];
      mockPrismaService.auditLog.findMany.mockResolvedValue(logs);

      const result = await service.findByEntity('invoice', 'inv-abc');

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: { entityType: 'invoice', entityId: 'inv-abc' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result.data).toEqual(logs);
      expect(result.paging.total).toBe(2);
    });
  });

  // Test 6: findOne() returns log by id
  describe('findOne', () => {
    it('should return a single audit log wrapped in buildSingleResponse', async () => {
      const fakeLog = {
        id: 'log-uuid-001',
        entityType: 'payment',
        entityId: 'pay-001',
        action: 'created',
        actorType: 'system',
        actorId: null,
        changes: null,
        metadata: null,
        createdAt: new Date(),
      };
      mockPrismaService.auditLog.findUnique.mockResolvedValue(fakeLog);

      const result = await service.findOne('log-uuid-001');

      expect(mockPrismaService.auditLog.findUnique).toHaveBeenCalledWith({
        where: { id: 'log-uuid-001' },
      });
      expect(result.data).toEqual(fakeLog);
      // Single resource — all paging fields null
      expect(result.paging.offset).toBeNull();
      expect(result.paging.limit).toBeNull();
      expect(result.paging.total).toBeNull();
    });

    // Test 7: findOne() throws NotFoundException for unknown id
    it('should throw NotFoundException when audit log is not found', async () => {
      mockPrismaService.auditLog.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        'Audit log non-existent-id not found',
      );
    });
  });
});
