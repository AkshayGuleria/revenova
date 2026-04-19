import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Consolidated Billing & Shared Contracts (E2E)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  let parentAccount: any;
  let child1Account: any;
  let child2Account: any;
  let sharedContract: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // Wait for any pending jobs to complete before closing
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await app.close();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  let sharedProductId: string;

  beforeEach(async () => {
    // Wait for any background jobs from previous tests to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Clean up database in FK-safe order
    await prisma.contractShare.deleteMany();
    await prisma.invoiceItem.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.contractProduct.deleteMany();
    await prisma.contract.deleteMany();
    await prisma.account.deleteMany();

    // Create test accounts (parent + 2 children)
    const parentResponse = await request(app.getHttpServer())
      .post('/api/accounts')
      .send({
        accountName: 'Parent Corporation',
        accountType: 'enterprise',
        primaryContactEmail: 'contact@parent.com',
        paymentTerms: 'net_30',
        paymentTermsDays: 30,
        currency: 'USD',
      });
    parentAccount = parentResponse.body.data;

    const child1Response = await request(app.getHttpServer())
      .post('/api/accounts')
      .send({
        accountName: 'Subsidiary USA',
        accountType: 'enterprise',
        primaryContactEmail: 'contact@usa.com',
        parentAccountId: parentAccount.id,
      });
    child1Account = child1Response.body.data;

    const child2Response = await request(app.getHttpServer())
      .post('/api/accounts')
      .send({
        accountName: 'Subsidiary Europe',
        accountType: 'enterprise',
        primaryContactEmail: 'contact@europe.com',
        parentAccountId: parentAccount.id,
      });
    child2Account = child2Response.body.data;

    // Create product (required for contract creation)
    const productResponse = await request(app.getHttpServer())
      .post('/api/products')
      .send({
        name: 'Enterprise Software License',
        pricingModel: 'seat_based',
        basePrice: 100,
        currency: 'USD',
        active: true,
      });
    sharedProductId = productResponse.body.data.id;
  });

  describe('Shared Contracts', () => {
    beforeEach(async () => {
      // Create a contract for parent account
      const contractResponse = await request(app.getHttpServer())
        .post('/api/contracts')
        .send({
          accountId: parentAccount.id,
          contractNumber: 'CNT-PARENT-001',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          contractValue: 120000,
          billingFrequency: 'annual',
          seatCount: 100,
          seatPrice: 100,
          status: 'active',
          products: [{ productId: sharedProductId, quantity: 100 }],
        });
      sharedContract = contractResponse.body.data;
    });

    it('should share contract with subsidiary account', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/contracts/${sharedContract.id}/shares`)
        .send({
          accountId: child1Account.id,
          notes: 'Shared for subsidiary use',
        })
        .expect(201);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.accountId).toBe(child1Account.id);
      expect(response.body.data.contractId).toBe(sharedContract.id);
    });

    it('should prevent sharing contract with its owner', async () => {
      await request(app.getHttpServer())
        .post(`/api/contracts/${sharedContract.id}/shares`)
        .send({
          accountId: parentAccount.id,
        })
        .expect(400);
    });

    it('should prevent duplicate shares', async () => {
      // Share once
      await request(app.getHttpServer())
        .post(`/api/contracts/${sharedContract.id}/shares`)
        .send({
          accountId: child1Account.id,
        })
        .expect(201);

      // Try to share again
      await request(app.getHttpServer())
        .post(`/api/contracts/${sharedContract.id}/shares`)
        .send({
          accountId: child1Account.id,
        })
        .expect(409);
    });

    it('should get all shares for a contract', async () => {
      // Share with both subsidiaries
      await request(app.getHttpServer())
        .post(`/api/contracts/${sharedContract.id}/shares`)
        .send({ accountId: child1Account.id });

      await request(app.getHttpServer())
        .post(`/api/contracts/${sharedContract.id}/shares`)
        .send({ accountId: child2Account.id });

      const response = await request(app.getHttpServer())
        .get(`/api/contracts/${sharedContract.id}/shares`)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.paging.total).toBe(2);
    });

    it('should get all shared contracts for an account', async () => {
      // Share contract with child1
      await request(app.getHttpServer())
        .post(`/api/contracts/${sharedContract.id}/shares`)
        .send({ accountId: child1Account.id });

      const response = await request(app.getHttpServer())
        .get(`/api/contracts/shared/${child1Account.id}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(sharedContract.id);
      expect(response.body.paging.total).toBe(1);
    });

    it('should unshare contract from account', async () => {
      // Share first
      await request(app.getHttpServer())
        .post(`/api/contracts/${sharedContract.id}/shares`)
        .send({ accountId: child1Account.id });

      // Unshare
      await request(app.getHttpServer())
        .delete(
          `/api/contracts/${sharedContract.id}/shares/${child1Account.id}`,
        )
        .expect(204);

      // Verify it's unshared
      const response = await request(app.getHttpServer())
        .get(`/api/contracts/${sharedContract.id}/shares`)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('POST /billing/consolidated', () => {
    beforeEach(async () => {
      // Create contracts for each account
      const parentContractResponse = await request(app.getHttpServer())
        .post('/api/contracts')
        .send({
          accountId: parentAccount.id,
          contractNumber: 'CNT-PARENT-001',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          contractValue: 120000,
          billingFrequency: 'annual',
          seatCount: 100,
          seatPrice: 100,
          status: 'active',
          products: [{ productId: sharedProductId, quantity: 100 }],
        });
      // Store parent contract (not used in this test)
      void parentContractResponse.body.data;

      const child1ContractResponse = await request(app.getHttpServer())
        .post('/api/contracts')
        .send({
          accountId: child1Account.id,
          contractNumber: 'CNT-USA-001',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          contractValue: 60000,
          billingFrequency: 'annual',
          seatCount: 50,
          seatPrice: 100,
          status: 'active',
          products: [{ productId: sharedProductId, quantity: 50 }],
        });
      // Store child1 contract (not used in this test)
      void child1ContractResponse.body.data;
    });

    it('should generate consolidated invoice for parent and subsidiaries', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/billing/consolidated')
        .send({
          parentAccountId: parentAccount.id,
          periodStart: '2026-01-01',
          periodEnd: '2026-01-31',
          includeChildren: true,
        })
        .expect(201);

      expect(response.body.data.invoiceId).toBeDefined();
      expect(response.body.data.invoiceNumber).toBeDefined();
      expect(response.body.data.subsidiariesIncluded).toBe(2);
      expect(response.body.data.total).toBeDefined();

      // Verify invoice was created
      const invoice = await prisma.invoice.findUnique({
        where: { id: response.body.data.invoiceId },
        include: { items: true },
      });

      expect(invoice).toBeDefined();
      expect(invoice.consolidated).toBe(true);
      expect(invoice.accountId).toBe(parentAccount.id);
      expect(invoice.items.length).toBeGreaterThan(0);
    });

    it('should generate invoice for parent only when includeChildren is false', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/billing/consolidated')
        .send({
          parentAccountId: parentAccount.id,
          periodStart: '2026-01-01',
          periodEnd: '2026-01-31',
          includeChildren: false,
        })
        .expect(201);

      expect(response.body.data.subsidiariesIncluded).toBe(0);
    });

    it('should include shared contracts in consolidated billing', async () => {
      // Create a contract owned by parent
      const sharedContractResponse = await request(app.getHttpServer())
        .post('/api/contracts')
        .send({
          accountId: parentAccount.id,
          contractNumber: 'CNT-SHARED-001',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          contractValue: 30000,
          billingFrequency: 'annual',
          seatCount: 25,
          seatPrice: 100,
          status: 'active',
          products: [{ productId: sharedProductId, quantity: 25 }],
        });
      const sharedContract = sharedContractResponse.body.data;

      // Share it with child1
      await request(app.getHttpServer())
        .post(`/api/contracts/${sharedContract.id}/shares`)
        .send({ accountId: child1Account.id });

      // Generate consolidated invoice
      const response = await request(app.getHttpServer())
        .post('/api/billing/consolidated')
        .send({
          parentAccountId: parentAccount.id,
          periodStart: '2026-01-01',
          periodEnd: '2026-01-31',
          includeChildren: true,
        })
        .expect(201);

      // Shared contract should be included
      expect(response.body.data.invoiceId).toBeDefined();

      const invoice = await prisma.invoice.findUnique({
        where: { id: response.body.data.invoiceId },
        include: { items: true },
      });

      // Should have items from parent contract, child1 contract, and shared contract
      expect(invoice.items.length).toBeGreaterThanOrEqual(2);
    });

    it('should throw error if parent account not found', async () => {
      await request(app.getHttpServer())
        .post('/api/billing/consolidated')
        .send({
          parentAccountId: '00000000-0000-0000-0000-000000000000', // Valid UUID format but non-existent
          periodStart: '2026-01-01',
          periodEnd: '2026-01-31',
        })
        .expect(404);
    });

    it('should throw error if account is on credit hold', async () => {
      // Put parent account on credit hold
      await prisma.account.update({
        where: { id: parentAccount.id },
        data: { creditHold: true },
      });

      await request(app.getHttpServer())
        .post('/api/billing/consolidated')
        .send({
          parentAccountId: parentAccount.id,
          periodStart: '2026-01-01',
          periodEnd: '2026-01-31',
        })
        .expect(400);
    });

    it('should throw error if no active contracts found', async () => {
      // Delete all contracts
      await prisma.contract.deleteMany();

      await request(app.getHttpServer())
        .post('/api/billing/consolidated')
        .send({
          parentAccountId: parentAccount.id,
          periodStart: '2026-01-01',
          periodEnd: '2026-01-31',
        })
        .expect(400);
    });
  });

  describe('POST /billing/consolidated/queue', () => {
    beforeEach(async () => {
      const parentContractResponse = await request(app.getHttpServer())
        .post('/api/contracts')
        .send({
          accountId: parentAccount.id,
          contractNumber: 'CNT-PARENT-001',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          contractValue: 120000,
          billingFrequency: 'annual',
          seatCount: 100,
          seatPrice: 100,
          status: 'active',
        });
      // Store parent contract (not used in this test)
      void parentContractResponse.body.data;
    });

    it('should queue consolidated invoice generation job', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/billing/consolidated/queue')
        .send({
          parentAccountId: parentAccount.id,
          periodStart: '2026-01-01',
          periodEnd: '2026-01-31',
          includeChildren: true,
        })
        .expect(202);

      expect(response.body.data.jobId).toBeDefined();
      expect(response.body.data.status).toBe('queued');
      expect(response.body.data.message).toContain('queued successfully');
    });
  });

  describe('GET /billing/consolidated/queue/stats', () => {
    it('should return consolidated billing queue statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/billing/consolidated/queue/stats')
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.queue).toBe('consolidated-billing');
      expect(typeof response.body.data.waiting).toBe('number');
      expect(typeof response.body.data.active).toBe('number');
      expect(typeof response.body.data.completed).toBe('number');
      expect(typeof response.body.data.failed).toBe('number');
    });
  });
});
