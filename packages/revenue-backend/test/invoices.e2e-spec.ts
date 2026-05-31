import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('InvoicesController (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let createdAccountId: string;
  let createdContractId: string;
  let createdProductId: string;
  let createdInvoiceId: string;

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
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = app.get<PrismaService>(PrismaService);

    // Clean up existing test data in FK-safe order
    await prisma.invoiceItem.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.contractProduct.deleteMany({});
    await prisma.contract.deleteMany({});
    await prisma.account.deleteMany({
      where: { primaryContactEmail: { contains: 'invoice-test' } },
    });

    // Create account
    const accountResponse = await request(app.getHttpServer())
      .post('/api/accounts')
      .send({
        accountName: 'Acme Corporation Invoice Test',
        primaryContactEmail: 'invoice-test@acme.com',
        accountType: 'enterprise',
      });
    createdAccountId = accountResponse.body.data.id;

    // Create product (via prisma for speed)
    const product = await prisma.product.create({
      data: {
        name: 'E2E Invoice Test Product',
        pricingModel: 'flat_fee',
        basePrice: 500,
        currency: 'USD',
        chargeType: 'recurring',
        category: 'platform',
        active: true,
      },
    });
    createdProductId = product.id;

    // Create contract with product (via API — goes through service validation)
    const contractResponse = await request(app.getHttpServer())
      .post('/api/contracts')
      .send({
        contractNumber: 'CNT-E2E-INV-BASE',
        accountId: createdAccountId,
        startDate: '2024-01-01',
        endDate: '2025-12-31',
        contractValue: 6000,
        products: [{ productId: createdProductId, quantity: 1 }],
      });
    createdContractId = contractResponse.body.data.id;
  });

  afterAll(async () => {
    // Clean up test data in FK-safe order
    await prisma.invoiceItem.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.contractProduct.deleteMany({});
    await prisma.contract.deleteMany({});
    await prisma.account.deleteMany({
      where: { primaryContactEmail: { contains: 'invoice-test' } },
    });
    await prisma.product.deleteMany({
      where: { name: 'E2E Invoice Test Product' },
    });

    await app.close();
  });

  describe('POST /api/invoices', () => {
    it('should create a new invoice with auto-generated items from contract', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/invoices')
        .send({
          invoiceNumber: 'INV-E2E-0001',
          accountId: createdAccountId,
          contractId: createdContractId,
          issueDate: '2024-01-01',
          dueDate: '2024-01-31',
          tax: 0,
          discount: 0,
          currency: 'USD',
          status: 'draft',
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toMatchObject({
        invoiceNumber: 'INV-E2E-0001',
        accountId: createdAccountId,
        contractId: createdContractId,
        status: 'draft',
      });

      // Items are auto-generated from the contract product (basePrice=500, qty=1)
      expect(response.body.data.items).toHaveLength(1);
      expect(parseFloat(response.body.data.subtotal)).toBeCloseTo(500);
      expect(parseFloat(response.body.data.total)).toBeCloseTo(500);

      expect(response.body.paging).toEqual({
        offset: null,
        limit: null,
        total: null,
        totalPages: null,
        hasNext: null,
        hasPrev: null,
      });

      createdInvoiceId = response.body.data.id;
    });

    it('should auto-generate items from contract products', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/invoices')
        .send({
          invoiceNumber: 'INV-E2E-0002',
          accountId: createdAccountId,
          contractId: createdContractId,
          issueDate: '2024-02-01',
          dueDate: '2024-02-28',
        })
        .expect(HttpStatus.CREATED);

      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].description).toBe(
        'E2E Invoice Test Product',
      );
      expect(parseFloat(response.body.data.items[0].quantity)).toBeCloseTo(1);
      expect(parseFloat(response.body.data.items[0].unitPrice)).toBeCloseTo(
        500,
      );
      expect(parseFloat(response.body.data.items[0].amount)).toBeCloseTo(500);
    });

    it('should create invoice linked to contract', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/invoices')
        .send({
          invoiceNumber: 'INV-E2E-0003',
          accountId: createdAccountId,
          contractId: createdContractId,
          issueDate: '2024-03-01',
          dueDate: '2024-03-31',
        })
        .expect(HttpStatus.CREATED);

      expect(response.body.data.contractId).toBe(createdContractId);
    });

    it('should fail when contractId is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/invoices')
        .send({
          invoiceNumber: 'INV-E2E-FAIL-000',
          accountId: createdAccountId,
          issueDate: '2024-01-01',
          dueDate: '2024-01-31',
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should fail if contract does not exist', async () => {
      await request(app.getHttpServer())
        .post('/api/invoices')
        .send({
          invoiceNumber: 'INV-E2E-FAIL-001',
          accountId: createdAccountId,
          contractId: '00000000-0000-0000-0000-000000000001',
          issueDate: '2024-01-01',
          dueDate: '2024-01-31',
        })
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should fail if due date is before issue date', async () => {
      await request(app.getHttpServer())
        .post('/api/invoices')
        .send({
          invoiceNumber: 'INV-E2E-FAIL-002',
          accountId: createdAccountId,
          contractId: createdContractId,
          issueDate: '2024-01-31',
          dueDate: '2024-01-01', // Before issue date
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should fail if invoice number already exists', async () => {
      await request(app.getHttpServer())
        .post('/api/invoices')
        .send({
          invoiceNumber: 'INV-E2E-0001', // Duplicate
          accountId: createdAccountId,
          contractId: createdContractId,
          issueDate: '2024-01-01',
          dueDate: '2024-01-31',
        })
        .expect(HttpStatus.CONFLICT);
    });
  });

  describe('GET /api/invoices', () => {
    it('should return paginated list of invoices', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/invoices')
        .query({ 'offset[eq]': 0, 'limit[eq]': 20 })
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('paging');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.paging).toMatchObject({
        offset: 0,
        limit: 20,
        hasNext: expect.any(Boolean),
        hasPrev: expect.any(Boolean),
      });

      if (response.body.data.length > 0) {
        expect(response.body.data[0]).toHaveProperty('account');
        expect(response.body.data[0]).toHaveProperty('_count');
      }
    });

    it('should filter by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/invoices')
        .query({ 'status[eq]': 'draft' })
        .expect(HttpStatus.OK);

      expect(response.body.data.every((inv) => inv.status === 'draft')).toBe(
        true,
      );
    });

    it('should filter by account', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/invoices')
        .query({ 'accountId[eq]': createdAccountId })
        .expect(HttpStatus.OK);

      expect(
        response.body.data.every((inv) => inv.accountId === createdAccountId),
      ).toBe(true);
    });

    it('should filter by total amount range', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/invoices')
        .query({ 'total[gte]': 100, 'total[lte]': 5000 })
        .expect(HttpStatus.OK);

      expect(
        response.body.data.every(
          (inv) =>
            parseFloat(inv.total) >= 100 && parseFloat(inv.total) <= 5000,
        ),
      ).toBe(true);
    });

    it('should search by invoice number', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/invoices')
        .query({ 'invoiceNumber[like]': 'INV-E2E' })
        .expect(HttpStatus.OK);

      expect(
        response.body.data.every((inv) =>
          inv.invoiceNumber.includes('INV-E2E'),
        ),
      ).toBe(true);
    });
  });

  describe('GET /api/invoices/:id', () => {
    it('should return invoice details with relations', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/invoices/${createdInvoiceId}`)
        .expect(HttpStatus.OK);

      expect(response.body.data).toMatchObject({
        id: createdInvoiceId,
        invoiceNumber: 'INV-E2E-0001',
      });

      expect(response.body.data).toHaveProperty('account');
      expect(response.body.data.account).toHaveProperty('accountName');
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('_count');

      expect(response.body.paging).toEqual({
        offset: null,
        limit: null,
        total: null,
        totalPages: null,
        hasNext: null,
        hasPrev: null,
      });
    });

    it('should return 404 for non-existent invoice', async () => {
      await request(app.getHttpServer())
        .get('/api/invoices/non-existent-id')
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('PATCH /api/invoices/:id', () => {
    it('should update invoice status', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/invoices/${createdInvoiceId}`)
        .send({
          status: 'sent',
        })
        .expect(HttpStatus.OK);

      expect(response.body.data.status).toBe('sent');
    });

    it('should update invoice amounts', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/invoices/${createdInvoiceId}`)
        .send({
          paidAmount: 500,
          paidDate: '2024-01-15',
          status: 'paid',
        })
        .expect(HttpStatus.OK);

      expect(parseFloat(response.body.data.paidAmount)).toBeCloseTo(500);
      expect(response.body.data.status).toBe('paid');
    });

    it('should return 404 for non-existent invoice', async () => {
      await request(app.getHttpServer())
        .patch('/api/invoices/non-existent-id')
        .send({ status: 'paid' })
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should fail if invoice number already exists', async () => {
      // Create second invoice
      await request(app.getHttpServer()).post('/api/invoices').send({
        invoiceNumber: 'INV-E2E-UNIQUE',
        accountId: createdAccountId,
        contractId: createdContractId,
        issueDate: '2024-04-01',
        dueDate: '2024-04-30',
      });

      // Try to update first invoice with second invoice's number
      await request(app.getHttpServer())
        .patch(`/api/invoices/${createdInvoiceId}`)
        .send({
          invoiceNumber: 'INV-E2E-UNIQUE',
        })
        .expect(HttpStatus.CONFLICT);
    });
  });

  describe('POST /api/invoices/:id/items', () => {
    it('should add line item to invoice', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/invoices/${createdInvoiceId}/items`)
        .send({
          description: 'Additional Service',
          quantity: 10,
          unitPrice: 50,
          amount: 500,
        })
        .expect(HttpStatus.CREATED);

      expect(response.body.data.description).toBe('Additional Service');
      expect(parseFloat(response.body.data.quantity)).toBeCloseTo(10);
      expect(parseFloat(response.body.data.unitPrice)).toBeCloseTo(50);
      expect(parseFloat(response.body.data.amount)).toBeCloseTo(500);
      expect(response.body.data.invoiceId).toBe(createdInvoiceId);
    });

    it('should return 404 for non-existent invoice', async () => {
      await request(app.getHttpServer())
        .post('/api/invoices/non-existent-id/items')
        .send({
          description: 'Test Item',
          quantity: 1,
          unitPrice: 100,
          amount: 100,
        })
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('DELETE /api/invoices/:id/items/:itemId', () => {
    let itemIdToDelete: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/invoices/${createdInvoiceId}/items`)
        .send({
          description: 'Item to Delete',
          quantity: 1,
          unitPrice: 100,
          amount: 100,
        });

      itemIdToDelete = response.body.data.id;
    });

    it('should remove line item from invoice', async () => {
      await request(app.getHttpServer())
        .delete(`/api/invoices/${createdInvoiceId}/items/${itemIdToDelete}`)
        .expect(HttpStatus.NO_CONTENT);

      const invoice = await request(app.getHttpServer()).get(
        `/api/invoices/${createdInvoiceId}`,
      );

      expect(
        invoice.body.data.items.find((item) => item.id === itemIdToDelete),
      ).toBeUndefined();
    });

    it('should return 404 for non-existent item', async () => {
      await request(app.getHttpServer())
        .delete(`/api/invoices/${createdInvoiceId}/items/non-existent-item-id`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 404 for non-existent invoice', async () => {
      await request(app.getHttpServer())
        .delete('/api/invoices/non-existent-id/items/some-item-id')
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('DELETE /api/invoices/:id', () => {
    it('should delete invoice', async () => {
      const invoiceToDelete = await request(app.getHttpServer())
        .post('/api/invoices')
        .send({
          invoiceNumber: 'INV-E2E-TO-DELETE',
          accountId: createdAccountId,
          contractId: createdContractId,
          issueDate: '2024-05-01',
          dueDate: '2024-05-31',
        });

      const invoiceId = invoiceToDelete.body.data.id;

      await request(app.getHttpServer())
        .delete(`/api/invoices/${invoiceId}`)
        .expect(HttpStatus.NO_CONTENT);

      await request(app.getHttpServer())
        .get(`/api/invoices/${invoiceId}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 404 for non-existent invoice', async () => {
      await request(app.getHttpServer())
        .delete('/api/invoices/non-existent-id')
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('ADR-003 Compliance', () => {
    it('should follow ADR-003 response structure for single resource', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/invoices/${createdInvoiceId}`)
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('paging');
      expect(typeof response.body.data).toBe('object');
      expect(Array.isArray(response.body.data)).toBe(false);
      expect(response.body.paging).toEqual({
        offset: null,
        limit: null,
        total: null,
        totalPages: null,
        hasNext: null,
        hasPrev: null,
      });
    });

    it('should follow ADR-003 response structure for paginated list', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/invoices')
        .query({ 'offset[eq]': 0, 'limit[eq]': 20 })
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('paging');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.paging).toMatchObject({
        offset: 0,
        limit: 20,
        total: expect.any(Number),
        totalPages: expect.any(Number),
        hasNext: expect.any(Boolean),
        hasPrev: expect.any(Boolean),
      });
    });

    it('should support operator-based query parameters', async () => {
      const eqResponse = await request(app.getHttpServer())
        .get('/api/invoices')
        .query({ 'status[eq]': 'paid' })
        .expect(HttpStatus.OK);

      expect(eqResponse.body.data.every((inv) => inv.status === 'paid')).toBe(
        true,
      );

      const gteResponse = await request(app.getHttpServer())
        .get('/api/invoices')
        .query({ 'total[gte]': 100 })
        .expect(HttpStatus.OK);

      expect(
        gteResponse.body.data.every((inv) => parseFloat(inv.total) >= 100),
      ).toBe(true);

      const likeResponse = await request(app.getHttpServer())
        .get('/api/invoices')
        .query({ 'invoiceNumber[like]': 'E2E' })
        .expect(HttpStatus.OK);

      expect(
        likeResponse.body.data.every((inv) =>
          inv.invoiceNumber.includes('E2E'),
        ),
      ).toBe(true);
    });
  });
});
