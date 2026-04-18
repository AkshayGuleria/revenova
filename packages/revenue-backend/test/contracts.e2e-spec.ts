import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import {
  BillingFrequency,
  ContractStatus,
} from '../src/modules/contracts/dto/create-contract.dto';

describe('Contracts API (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let testAccountId: string;
  let testProductId: string;

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

    // Create test account for contracts
    const testAccount = await prisma.account.create({
      data: {
        accountName: 'Test Contract Account',
        primaryContactEmail: 'test-contracts@example.com',
      },
    });
    testAccountId = testAccount.id;

    // Create test product (required for contract creation)
    const testProduct = await prisma.product.create({
      data: {
        name: 'E2E Contract Test Product',
        pricingModel: 'flat_fee',
        basePrice: 1000,
        currency: 'USD',
        chargeType: 'recurring',
        category: 'platform',
        active: true,
      },
    });
    testProductId = testProduct.id;

    // Clean up existing test contracts
    await prisma.contract.deleteMany({
      where: {
        contractNumber: { contains: 'TEST-CNT' },
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.contract.deleteMany({
      where: {
        contractNumber: { contains: 'TEST-CNT' },
      },
    });

    await prisma.account.deleteMany({
      where: {
        primaryContactEmail: 'test-contracts@example.com',
      },
    });

    await prisma.product.deleteMany({
      where: { name: 'E2E Contract Test Product' },
    });

    await app.close();
  });

  describe('POST /api/contracts', () => {
    it('should create a new contract successfully', () => {
      return request(app.getHttpServer())
        .post('/api/contracts')
        .send({
          contractNumber: 'TEST-CNT-001',
          accountId: testAccountId,
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          contractValue: 120000,
          billingFrequency: BillingFrequency.ANNUAL,
          seatCount: 100,
          committedSeats: 100,
          seatPrice: 99.99,
          products: [{ productId: testProductId, quantity: 1 }],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body.data).toMatchObject({
            contractNumber: 'TEST-CNT-001',
            accountId: testAccountId,
            status: 'active',
          });
          expect(res.body).toHaveProperty('paging');
          expect(res.body.paging).toEqual({
            offset: null,
            limit: null,
            total: null,
            totalPages: null,
            hasNext: null,
            hasPrev: null,
          });
        });
    });

    it('should create contract with minimal required fields', () => {
      return request(app.getHttpServer())
        .post('/api/contracts')
        .send({
          contractNumber: 'TEST-CNT-002',
          accountId: testAccountId,
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          contractValue: 50000,
          products: [{ productId: testProductId, quantity: 1 }],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.contractNumber).toBe('TEST-CNT-002');
        });
    });

    it('should return 400 when required fields are missing', () => {
      return request(app.getHttpServer())
        .post('/api/contracts')
        .send({
          contractNumber: 'TEST-CNT-INVALID',
          // Missing accountId, dates, and value
        })
        .expect(400);
    });

    it('should return 400 when end date is before start date', () => {
      return request(app.getHttpServer())
        .post('/api/contracts')
        .send({
          contractNumber: 'TEST-CNT-INVALID-DATES',
          accountId: testAccountId,
          startDate: '2024-12-31',
          endDate: '2024-01-01',
          contractValue: 10000,
          products: [{ productId: testProductId, quantity: 1 }],
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain(
            'End date must be after start date',
          );
        });
    });

    it('should return 404 when account does not exist', () => {
      return request(app.getHttpServer())
        .post('/api/contracts')
        .send({
          contractNumber: 'TEST-CNT-NO-ACCOUNT',
          accountId: '00000000-0000-0000-0000-000000000000',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          contractValue: 10000,
          products: [{ productId: testProductId, quantity: 1 }],
        })
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toContain('Account');
          expect(res.body.message).toContain('not found');
        });
    });

    it('should return 409 when contract number already exists', async () => {
      const contractNumber = `TEST-CNT-DUP-${Date.now()}`;

      // First request should succeed
      await request(app.getHttpServer())
        .post('/api/contracts')
        .send({
          contractNumber,
          accountId: testAccountId,
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          contractValue: 10000,
          products: [{ productId: testProductId, quantity: 1 }],
        })
        .expect(201);

      // Second request with same number should fail
      return request(app.getHttpServer())
        .post('/api/contracts')
        .send({
          contractNumber,
          accountId: testAccountId,
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          contractValue: 10000,
          products: [{ productId: testProductId, quantity: 1 }],
        })
        .expect(409)
        .expect((res) => {
          expect(res.body.message).toContain('already exists');
        });
    });
  });

  describe('GET /api/contracts', () => {
    beforeAll(async () => {
      // Create test contracts
      await prisma.contract.createMany({
        data: [
          {
            contractNumber: 'TEST-CNT-LIST-001',
            accountId: testAccountId,
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-12-31'),
            contractValue: 100000,
            status: 'active',
            billingFrequency: 'annual',
          },
          {
            contractNumber: 'TEST-CNT-LIST-002',
            accountId: testAccountId,
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-12-31'),
            contractValue: 50000,
            status: 'draft',
            billingFrequency: 'monthly',
          },
        ],
      });
    });

    it('should return paginated list of contracts', () => {
      return request(app.getHttpServer())
        .get('/api/contracts')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body).toHaveProperty('paging');
          expect(res.body.paging).toMatchObject({
            offset: 0,
            limit: 20,
            total: expect.any(Number),
            totalPages: expect.any(Number),
            hasNext: expect.any(Boolean),
            hasPrev: false,
          });
        });
    });

    it('should filter by status using eq operator', () => {
      return request(app.getHttpServer())
        .get('/api/contracts?status[eq]=active')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.every((c: any) => c.status === 'active')).toBe(
            true,
          );
        });
    });

    it('should filter by contract number using like operator', () => {
      return request(app.getHttpServer())
        .get('/api/contracts?contractNumber[like]=TEST-CNT-LIST')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBeGreaterThan(0);
          expect(
            res.body.data.some((c: any) =>
              c.contractNumber.includes('TEST-CNT-LIST'),
            ),
          ).toBe(true);
        });
    });

    it('should filter by account ID', () => {
      return request(app.getHttpServer())
        .get(`/api/contracts?accountId[eq]=${testAccountId}`)
        .expect(200)
        .expect((res) => {
          expect(
            res.body.data.every((c: any) => c.accountId === testAccountId),
          ).toBe(true);
        });
    });

    it('should include account information in response', () => {
      return request(app.getHttpServer())
        .get(`/api/contracts?accountId[eq]=${testAccountId}`)
        .expect(200)
        .expect((res) => {
          const contract = res.body.data[0];
          expect(contract).toHaveProperty('account');
          expect(contract.account).toHaveProperty('accountName');
          expect(contract).toHaveProperty('_count');
        });
    });
  });

  describe('GET /api/contracts/:id', () => {
    let testContractId: string;

    beforeAll(async () => {
      const contract = await prisma.contract.create({
        data: {
          contractNumber: 'TEST-CNT-SINGLE',
          accountId: testAccountId,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          contractValue: 75000,
          status: 'active',
        },
      });
      testContractId = contract.id;
    });

    it('should return contract details by ID', () => {
      return request(app.getHttpServer())
        .get(`/api/contracts/${testContractId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body.data.id).toBe(testContractId);
          expect(res.body.data.contractNumber).toBe('TEST-CNT-SINGLE');
          expect(res.body).toHaveProperty('paging');
          expect(res.body.paging).toEqual({
            offset: null,
            limit: null,
            total: null,
            totalPages: null,
            hasNext: null,
            hasPrev: null,
          });
        });
    });

    it('should include account and invoice information', () => {
      return request(app.getHttpServer())
        .get(`/api/contracts/${testContractId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('account');
          expect(res.body.data.account).toHaveProperty('accountName');
          expect(res.body.data).toHaveProperty('invoices');
          expect(Array.isArray(res.body.data.invoices)).toBe(true);
        });
    });

    it('should return 404 for non-existent contract', () => {
      return request(app.getHttpServer())
        .get('/api/contracts/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('PATCH /api/contracts/:id', () => {
    let testContractId: string;

    beforeEach(async () => {
      const contract = await prisma.contract.create({
        data: {
          contractNumber: `TEST-CNT-UPDATE-${Date.now()}`,
          accountId: testAccountId,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          contractValue: 60000,
          status: 'active',
        },
      });
      testContractId = contract.id;
    });

    it('should update contract successfully', () => {
      return request(app.getHttpServer())
        .patch(`/api/contracts/${testContractId}`)
        .send({
          contractValue: 80000,
          seatCount: 150,
        })
        .expect(200)
        .expect((res) => {
          expect(parseFloat(res.body.data.contractValue)).toBe(80000);
          expect(res.body.data.seatCount).toBe(150);
        });
    });

    it('should update contract status', () => {
      return request(app.getHttpServer())
        .patch(`/api/contracts/${testContractId}`)
        .send({
          status: ContractStatus.EXPIRED,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.status).toBe('expired');
        });
    });

    it('should return 404 when updating non-existent contract', () => {
      return request(app.getHttpServer())
        .patch('/api/contracts/00000000-0000-0000-0000-000000000000')
        .send({
          contractValue: 10000,
        })
        .expect(404);
    });

    it('should validate dates when updating', () => {
      return request(app.getHttpServer())
        .patch(`/api/contracts/${testContractId}`)
        .send({
          startDate: '2024-12-31',
          endDate: '2024-01-01',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain(
            'End date must be after start date',
          );
        });
    });
  });

  describe('DELETE /api/contracts/:id', () => {
    let testContractId: string;

    beforeEach(async () => {
      const contract = await prisma.contract.create({
        data: {
          contractNumber: `TEST-CNT-DELETE-${Date.now()}`,
          accountId: testAccountId,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          contractValue: 30000,
        },
      });
      testContractId = contract.id;
    });

    it('should delete contract successfully', async () => {
      await request(app.getHttpServer())
        .delete(`/api/contracts/${testContractId}`)
        .expect(204);

      // Verify contract is deleted
      return request(app.getHttpServer())
        .get(`/api/contracts/${testContractId}`)
        .expect(404);
    });

    it('should return 404 when deleting non-existent contract', () => {
      return request(app.getHttpServer())
        .delete('/api/contracts/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });
});
