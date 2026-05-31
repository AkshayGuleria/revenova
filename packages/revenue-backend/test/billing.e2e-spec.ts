import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { BillingFrequency } from '../src/modules/contracts/dto/create-contract.dto';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../src/common/queues';
import { Queue } from 'bullmq';

describe('Billing API (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let testAccountId: string;
  let testContractId: string;
  let contractBillingQueue: Queue;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Get BullMQ queue for cleanup
    contractBillingQueue = moduleFixture.get<Queue>(
      getQueueToken(QUEUE_NAMES.CONTRACT_BILLING),
    );

    // Create test account
    const testAccount = await prisma.account.create({
      data: {
        accountName: 'Test Billing Account',
        primaryContactEmail: 'test-billing@example.com',
        paymentTermsDays: 30,
        currency: 'USD',
      },
    });
    testAccountId = testAccount.id;

    // Create test contract
    const testContract = await prisma.contract.create({
      data: {
        contractNumber: 'TEST-BILL-CNT-001',
        accountId: testAccountId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        contractValue: 120000,
        billingFrequency: BillingFrequency.QUARTERLY,
        seatCount: 50,
        committedSeats: 50,
        seatPrice: 600,
        status: 'active',
      },
    });
    testContractId = testContract.id;
  });

  afterAll(async () => {
    // Clean up test data in correct order (respect foreign keys)
    try {
      // 1. Delete all invoices for test account (invoice items cascade delete)
      if (testAccountId) {
        await prisma.invoice.deleteMany({
          where: {
            OR: [
              { accountId: testAccountId },
              { invoiceNumber: { contains: 'INV-' } },
            ],
          },
        });
      }

      // 2. Delete test contract
      if (testContractId) {
        await prisma.contract
          .delete({
            where: { id: testContractId },
          })
          .catch(() => {
            // Contract might already be deleted
          });
      }

      // 3. Delete test account last
      if (testAccountId) {
        await prisma.account
          .delete({
            where: { id: testAccountId },
          })
          .catch(() => {
            // Account might already be deleted
          });
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    } finally {
      // Close all connections properly
      try {
        // Close BullMQ queue connections
        if (contractBillingQueue) {
          await contractBillingQueue.close();
        }

        // Disconnect Prisma
        await prisma.$disconnect();

        // Close NestJS app (this closes workers and other connections)
        await app.close();
      } catch (closeError) {
        console.error('Error during connection closure:', closeError);
      }
    }
  }, 30000); // 30 second timeout for cleanup

  describe('POST /billing/generate', () => {
    it('should generate invoice synchronously from contract', () => {
      return request(app.getHttpServer())
        .post('/api/billing/generate')
        .send({
          contractId: testContractId,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body.data).toHaveProperty('invoiceId');
          expect(res.body.data).toHaveProperty('invoiceNumber');
          expect(res.body.data).toHaveProperty('total');
          expect(res.body.data.total).toBe('30000');
          expect(res.body).toHaveProperty('paging');
        });
    });

    it('should generate invoice with custom period dates', () => {
      return request(app.getHttpServer())
        .post('/api/billing/generate')
        .send({
          contractId: testContractId,
          periodStart: '2026-01-01',
          periodEnd: '2026-03-31',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('invoiceId');
          expect(res.body.data.total).toBe('30000');
        });
    });

    it('should return 404 for non-existent contract', () => {
      return request(app.getHttpServer())
        .post('/api/billing/generate')
        .send({
          contractId: '00000000-0000-0000-0000-000000000000',
        })
        .expect(404);
    });

    it('should validate required fields', () => {
      return request(app.getHttpServer())
        .post('/api/billing/generate')
        .send({})
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([expect.stringContaining('contractId')]),
          );
        });
    });

    it('should validate date format for period dates', () => {
      return request(app.getHttpServer())
        .post('/api/billing/generate')
        .send({
          contractId: testContractId,
          periodStart: 'invalid-date',
        })
        .expect(400);
    });
  });

  describe('POST /billing/queue', () => {
    it('should queue invoice generation job', () => {
      return request(app.getHttpServer())
        .post('/api/billing/queue')
        .send({
          contractId: testContractId,
        })
        .expect(202)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body.data).toHaveProperty('jobId');
          expect(res.body.data).toHaveProperty('status', 'queued');
          expect(res.body.data).toHaveProperty('message');
        });
    });

    it('should queue job with custom period dates', () => {
      return request(app.getHttpServer())
        .post('/api/billing/queue')
        .send({
          contractId: testContractId,
          periodStart: '2026-04-01',
          periodEnd: '2026-06-30',
        })
        .expect(202)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('jobId');
          expect(res.body.data.status).toBe('queued');
        });
    });

    it('should validate contract ID in queued job', () => {
      return request(app.getHttpServer())
        .post('/api/billing/queue')
        .send({})
        .expect(400);
    });
  });

  describe('POST /billing/batch', () => {
    it('should queue batch billing job', () => {
      return request(app.getHttpServer())
        .post('/api/billing/batch')
        .send({})
        .expect(202)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body.data).toHaveProperty('jobId');
          expect(res.body.data).toHaveProperty('status', 'queued');
        });
    });

    it('should queue batch job with billing date', () => {
      return request(app.getHttpServer())
        .post('/api/billing/batch')
        .send({
          billingDate: '2026-01-01',
          billingPeriod: 'monthly',
        })
        .expect(202)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('jobId');
        });
    });

    it('should queue batch job with quarterly period', () => {
      return request(app.getHttpServer())
        .post('/api/billing/batch')
        .send({
          billingDate: '2026-01-01',
          billingPeriod: 'quarterly',
        })
        .expect(202);
    });

    it('should queue batch job with annual period', () => {
      return request(app.getHttpServer())
        .post('/api/billing/batch')
        .send({
          billingDate: '2026-01-01',
          billingPeriod: 'annual',
        })
        .expect(202);
    });

    it('should validate billing date format', () => {
      return request(app.getHttpServer())
        .post('/api/billing/batch')
        .send({
          billingDate: 'invalid-date',
        })
        .expect(400);
    });
  });

  describe('GET /billing/jobs/:jobId', () => {
    it('should return job status for valid job ID', async () => {
      // Queue a job first
      const queueResponse = await request(app.getHttpServer())
        .post('/api/billing/queue')
        .send({
          contractId: testContractId,
        });

      const jobId = queueResponse.body.data.jobId;

      // Wait a bit for job to process
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return request(app.getHttpServer())
        .get(`/api/billing/jobs/${jobId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('paging');
        });
    });

    it('should return null for non-existent job', () => {
      return request(app.getHttpServer())
        .get('/api/billing/jobs/999999')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeNull();
        });
    });
  });

  describe('GET /billing/queue/stats', () => {
    it('should return queue statistics', () => {
      return request(app.getHttpServer())
        .get('/api/billing/queue/stats')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body.data).toHaveProperty('queue', 'contract-billing');
          expect(res.body.data).toHaveProperty('waiting');
          expect(res.body.data).toHaveProperty('active');
          expect(res.body.data).toHaveProperty('completed');
          expect(res.body.data).toHaveProperty('failed');
          expect(res.body.data).toHaveProperty('delayed');
          expect(res.body.data).toHaveProperty('total');
        });
    });

    it('should return valid numeric statistics', () => {
      return request(app.getHttpServer())
        .get('/api/billing/queue/stats')
        .expect(200)
        .expect((res) => {
          expect(typeof res.body.data.waiting).toBe('number');
          expect(typeof res.body.data.active).toBe('number');
          expect(typeof res.body.data.completed).toBe('number');
          expect(typeof res.body.data.failed).toBe('number');
          expect(typeof res.body.data.delayed).toBe('number');
          expect(typeof res.body.data.total).toBe('number');
        });
    });
  });

  describe('Dry Run', () => {
    describe('POST /billing/dry-run', () => {
      it('should return 200 with correct dry-run shape', () => {
        return request(app.getHttpServer())
          .post('/api/billing/dry-run')
          .send({ contractId: testContractId })
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('data');
            expect(res.body.data.isDryRun).toBe(true);
            expect(res.body.data.invoiceId).toBeNull();
            expect(Array.isArray(res.body.data.lineItems)).toBe(true);
            expect(res.body.data.lineItems.length).toBeGreaterThanOrEqual(1);
            // Decimal serialises as string via JSON
            expect(typeof res.body.data.total).toBe('string');
            expect(res.body.data.total).toBe('30000');
            expect(res.body).toHaveProperty('paging');
          });
      });

      it('should NOT create an invoice in the database', async () => {
        const beforeCount = await prisma.invoice.count({
          where: { contractId: testContractId },
        });

        await request(app.getHttpServer())
          .post('/api/billing/dry-run')
          .send({
            contractId: testContractId,
            periodStart: '2027-01-01',
            periodEnd: '2027-03-31',
          })
          .expect(200);

        const afterCount = await prisma.invoice.count({
          where: { contractId: testContractId },
        });

        expect(afterCount).toBe(beforeCount);
      });

      it('should return 400 for an invalid (non-UUID) contractId', () => {
        return request(app.getHttpServer())
          .post('/api/billing/dry-run')
          .send({ contractId: 'not-a-valid-uuid' })
          .expect(400);
      });

      it('should return 404 for a non-existent contractId', () => {
        return request(app.getHttpServer())
          .post('/api/billing/dry-run')
          .send({ contractId: '00000000-0000-0000-0000-000000000000' })
          .expect(404);
      });
    });

    describe('POST /billing/consolidated/dry-run', () => {
      it('should return 200 with isDryRun true for a known parent account', () => {
        return request(app.getHttpServer())
          .post('/api/billing/consolidated/dry-run')
          .send({
            parentAccountId: testAccountId,
            periodStart: '2026-01-01',
            periodEnd: '2026-01-31',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('data');
            expect(res.body.data.isDryRun).toBe(true);
            expect(res.body.data.invoiceId).toBeNull();
            expect(res.body).toHaveProperty('paging');
          });
      });

      it('should return 400 for invalid (non-UUID) parentAccountId', () => {
        return request(app.getHttpServer())
          .post('/api/billing/consolidated/dry-run')
          .send({
            parentAccountId: 'bad-id',
            periodStart: '2026-01-01',
            periodEnd: '2026-01-31',
          })
          .expect(400);
      });
    });
  });

  describe('Invoice Generation Verification', () => {
    it('should create invoice in database when generating synchronously', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/billing/generate')
        .send({
          contractId: testContractId,
          periodStart: '2025-01-01',
          periodEnd: '2025-03-31',
        })
        .expect(201);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('invoiceId');
      const invoiceId = response.body.data.invoiceId;

      // Verify invoice exists in database
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { items: true },
      });

      expect(invoice).toBeDefined();
      expect(invoice?.contractId).toBe(testContractId);
      expect(invoice?.accountId).toBe(testAccountId);
      expect(invoice?.status).toBe('draft');
      expect(parseFloat(invoice?.total.toString() || '0')).toBe(30000);

      // Verify invoice items
      expect(invoice?.items).toHaveLength(1);
      expect(invoice?.items[0].description).toContain('Quarterly Subscription');
      expect(parseFloat(invoice?.items[0].quantity.toString() || '0')).toBe(50);
      expect(parseFloat(invoice?.items[0].unitPrice.toString() || '0')).toBe(
        600,
      );
      expect(parseFloat(invoice?.items[0].amount.toString() || '0')).toBe(
        30000,
      );
    });

    it('should calculate correct due date based on payment terms', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/billing/generate')
        .send({
          contractId: testContractId,
          periodStart: '2025-04-01',
          periodEnd: '2025-06-30',
        });

      const invoiceId = response.body.data.invoiceId;

      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });

      // Payment terms are 30 days
      const issueDate = new Date(invoice!.issueDate);
      const dueDate = new Date(invoice!.dueDate);
      const daysDifference = Math.round(
        (dueDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      expect(daysDifference).toBe(30);
    });

    it('should generate unique invoice numbers', async () => {
      const response1 = await request(app.getHttpServer())
        .post('/api/billing/generate')
        .send({
          contractId: testContractId,
          periodStart: '2025-07-01',
          periodEnd: '2025-09-30',
        });

      const response2 = await request(app.getHttpServer())
        .post('/api/billing/generate')
        .send({
          contractId: testContractId,
          periodStart: '2025-10-01',
          periodEnd: '2025-12-31',
        });

      expect(response1.body.data.invoiceNumber).not.toBe(
        response2.body.data.invoiceNumber,
      );
    });
  });
});
