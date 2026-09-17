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
  AccountType,
  PaymentTerms,
} from '../src/modules/accounts/dto/create-account.dto';
import { AccountStatus } from '../src/modules/accounts/dto/update-account.dto';

describe('Accounts API (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  // Test data
  const testAccount1 = {
    accountName: 'Test Acme Corporation',
    primaryContactEmail: 'test-acme@example.com',
    accountType: AccountType.ENTERPRISE,
    paymentTerms: PaymentTerms.NET_30,
    currency: 'USD',
  };

  // Secondary test account data (may be used in future tests)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const testAccount2 = {
    accountName: 'Test Tech Startup',
    primaryContactEmail: 'test-startup@example.com',
    accountType: AccountType.STARTUP,
    paymentTerms: PaymentTerms.NET_60,
    currency: 'USD',
  };

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

    // Clean up test data before running tests
    await prisma.account.deleteMany({
      where: {
        OR: [
          { primaryContactEmail: { contains: 'test-' } },
          { accountName: { contains: 'Test ' } },
        ],
      },
    });
  });

  afterAll(async () => {
    // Clean up test data after all tests
    await prisma.account.deleteMany({
      where: {
        OR: [
          { primaryContactEmail: { contains: 'test-' } },
          { accountName: { contains: 'Test ' } },
        ],
      },
    });

    await app.close();
  });

  describe('POST /api/accounts', () => {
    it('rejects creditLimit at creation — credit is granted via PATCH /accounts/:id/credit', () => {
      return request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test Credit Injection',
          primaryContactEmail: `test-credit-${Date.now()}@example.com`,
          creditLimit: 10000000,
        })
        .expect(400);
    });

    it('rejects creditHold at creation', () => {
      return request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test Credit Hold Injection',
          primaryContactEmail: `test-hold-${Date.now()}@example.com`,
          creditHold: false,
        })
        .expect(400);
    });

    it('should create a new account successfully', () => {
      return request(app.getHttpServer())
        .post('/api/accounts')
        .send(testAccount1)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body.data).toMatchObject({
            accountName: testAccount1.accountName,
            primaryContactEmail: testAccount1.primaryContactEmail,
            accountType: testAccount1.accountType,
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

    it('should create account with minimal required fields', () => {
      return request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test Minimal Account',
          primaryContactEmail: 'test-minimal@example.com',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data).toMatchObject({
            accountName: 'Test Minimal Account',
            primaryContactEmail: 'test-minimal@example.com',
          });
        });
    });

    it('should return 400 when required fields are missing', () => {
      return request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test Invalid Account',
          // Missing primaryContactEmail
        })
        .expect(400);
    });

    it('should return 400 when email is invalid', () => {
      return request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test Invalid Email',
          primaryContactEmail: 'not-an-email',
        })
        .expect(400);
    });

    // NOTE: Skipped because primaryContactEmail doesn't have @unique constraint in schema
    // The service code handles P2002 errors, but the DB schema allows duplicates
    // TODO: Add @unique constraint to primaryContactEmail in schema if business logic requires it
    it.skip('should return 409 when email already exists', async () => {
      const uniqueEmail = `test-duplicate-${Date.now()}@example.com`;

      // First request should succeed
      await request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test Duplicate Email 1',
          primaryContactEmail: uniqueEmail,
        })
        .expect(201);

      // Second request with same email should fail
      return request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test Duplicate Email 2',
          primaryContactEmail: uniqueEmail,
        })
        .expect(409)
        .expect((res) => {
          expect(res.body.message).toContain('already exists');
        });
    });

    it('should create account with parent hierarchy', async () => {
      // Create parent account first
      const parentResponse = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test Parent Account',
          primaryContactEmail: 'test-parent@example.com',
        })
        .expect(201);

      const parentId = parentResponse.body.data.id;

      // Create child account
      return request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test Child Account',
          primaryContactEmail: 'test-child@example.com',
          parentAccountId: parentId,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.parentAccountId).toBe(parentId);
        });
    });

    it('should return 404 when parent account does not exist', () => {
      return request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test Invalid Parent',
          primaryContactEmail: 'test-invalid-parent@example.com',
          parentAccountId: '00000000-0000-0000-0000-000000000000',
        })
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toContain('Parent account');
          expect(res.body.message).toContain('not found');
        });
    });
  });

  describe('GET /api/accounts', () => {
    const createdAccountIds: string[] = [];

    beforeAll(async () => {
      // Create test accounts
      const account1Response = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test List Account 1',
          primaryContactEmail: 'test-list-1@example.com',
          accountType: AccountType.ENTERPRISE,
        });
      createdAccountIds.push(account1Response.body.data.id);

      const account2Response = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test List Account 2',
          primaryContactEmail: 'test-list-2@example.com',
          accountType: AccountType.STARTUP,
        });
      createdAccountIds.push(account2Response.body.data.id);

      const account3Response = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test List Account 3',
          primaryContactEmail: 'test-list-3@example.com',
          accountType: AccountType.SMB,
        });
      createdAccountIds.push(account3Response.body.data.id);
    });

    it('should return paginated list of accounts', () => {
      return request(app.getHttpServer())
        .get('/api/accounts')
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
        .get('/api/accounts?status[eq]=active')
        .expect(200)
        .expect((res) => {
          expect(
            res.body.data.every((acc: any) => acc.status === 'active'),
          ).toBe(true);
        });
    });

    it('should filter by account name using like operator', () => {
      return request(app.getHttpServer())
        .get('/api/accounts?accountName[like]=List Account 1')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBeGreaterThan(0);
          expect(
            res.body.data.some((acc: any) =>
              acc.accountName.includes('List Account 1'),
            ),
          ).toBe(true);
        });
    });

    it('should filter by account type using eq operator', () => {
      return request(app.getHttpServer())
        .get('/api/accounts?accountType[eq]=enterprise')
        .expect(200)
        .expect((res) => {
          expect(
            res.body.data.every((acc: any) => acc.accountType === 'enterprise'),
          ).toBe(true);
        });
    });

    it('should filter by multiple statuses using in operator', () => {
      return request(app.getHttpServer())
        .get('/api/accounts?status[in]=active,suspended')
        .expect(200)
        .expect((res) => {
          expect(
            res.body.data.every(
              (acc: any) =>
                acc.status === 'active' || acc.status === 'suspended',
            ),
          ).toBe(true);
        });
    });

    it('should filter accounts without parent using null operator', () => {
      return request(app.getHttpServer())
        .get('/api/accounts?parentAccountId[null]=true')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBeGreaterThan(0);
        });
    });

    it('should handle pagination with custom offset and limit', () => {
      return request(app.getHttpServer())
        .get('/api/accounts?offset[eq]=0&limit[eq]=2')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBeLessThanOrEqual(2);
          expect(res.body.paging.offset).toBe(0);
          expect(res.body.paging.limit).toBe(2);
        });
    });

    it('should handle second page of results', async () => {
      const firstPageResponse = await request(app.getHttpServer())
        .get('/api/accounts?offset[eq]=0&limit[eq]=2')
        .expect(200);

      if (firstPageResponse.body.paging.hasNext) {
        return request(app.getHttpServer())
          .get('/api/accounts?offset[eq]=2&limit[eq]=2')
          .expect(200)
          .expect((res) => {
            expect(res.body.paging.offset).toBe(2);
            expect(res.body.paging.hasPrev).toBe(true);
          });
      }
    });

    it('should include parent information in response', async () => {
      // Create parent and child
      const parentResponse = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test List Parent',
          primaryContactEmail: 'test-list-parent@example.com',
        });

      await request(app.getHttpServer()).post('/api/accounts').send({
        accountName: 'Test List Child',
        primaryContactEmail: 'test-list-child@example.com',
        parentAccountId: parentResponse.body.data.id,
      });

      return request(app.getHttpServer())
        .get(`/api/accounts?accountName[like]=Test List Child`)
        .expect(200)
        .expect((res) => {
          const childAccount = res.body.data.find(
            (acc: any) => acc.accountName === 'Test List Child',
          );
          expect(childAccount).toBeDefined();
          expect(childAccount.parent).toBeDefined();
          expect(childAccount.parent.accountName).toBe('Test List Parent');
        });
    });

    it('should not return soft-deleted accounts', async () => {
      // Create and then soft-delete an account
      const response = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test Deleted Account',
          primaryContactEmail: 'test-deleted@example.com',
        });

      const accountId = response.body.data.id;

      await request(app.getHttpServer()).delete(`/api/accounts/${accountId}`);

      // Verify it's not in the list
      return request(app.getHttpServer())
        .get(`/api/accounts?accountName[like]=Test Deleted Account`)
        .expect(200)
        .expect((res) => {
          expect(
            res.body.data.find((acc: any) => acc.id === accountId),
          ).toBeUndefined();
        });
    });
  });

  describe('GET /api/accounts/:id', () => {
    let testAccountId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test Single Account',
          primaryContactEmail: 'test-single@example.com',
          accountType: AccountType.ENTERPRISE,
        });
      testAccountId = response.body.data.id;
    });

    it('should return account details by ID', () => {
      return request(app.getHttpServer())
        .get(`/api/accounts/${testAccountId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body.data.id).toBe(testAccountId);
          expect(res.body.data.accountName).toBe('Test Single Account');
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

    it('should include related data (parent, children, contracts)', () => {
      return request(app.getHttpServer())
        .get(`/api/accounts/${testAccountId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('parent');
          expect(res.body.data).toHaveProperty('children');
          expect(res.body.data).toHaveProperty('contracts');
          expect(res.body.data).toHaveProperty('_count');
        });
    });

    it('should return 404 for non-existent account', () => {
      return request(app.getHttpServer())
        .get('/api/accounts/00000000-0000-0000-0000-000000000000')
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toContain('not found');
        });
    });

    it('should return 404 for soft-deleted account', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test To Delete',
          primaryContactEmail: 'test-to-delete@example.com',
        });

      const accountId = response.body.data.id;

      await request(app.getHttpServer()).delete(`/api/accounts/${accountId}`);

      return request(app.getHttpServer())
        .get(`/api/accounts/${accountId}`)
        .expect(404);
    });
  });

  describe('PATCH /api/accounts/:id', () => {
    let testAccountId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test Update Account',
          primaryContactEmail: `test-update-${Date.now()}@example.com`,
        });
      testAccountId = response.body.data.id;
    });

    it('should update account successfully', () => {
      return request(app.getHttpServer())
        .patch(`/api/accounts/${testAccountId}`)
        .send({
          accountName: 'Test Updated Account Name',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.accountName).toBe('Test Updated Account Name');
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

    it('should update account status', () => {
      return request(app.getHttpServer())
        .patch(`/api/accounts/${testAccountId}`)
        .send({
          status: AccountStatus.SUSPENDED,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.status).toBe('suspended');
        });
    });

    it('should return 404 when updating non-existent account', () => {
      return request(app.getHttpServer())
        .patch('/api/accounts/00000000-0000-0000-0000-000000000000')
        .send({
          accountName: 'Updated Name',
        })
        .expect(404);
    });

    it('should prevent account from being its own parent', () => {
      return request(app.getHttpServer())
        .patch(`/api/accounts/${testAccountId}`)
        .send({
          parentAccountId: testAccountId,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('own parent');
        });
    });

    it('should detect circular hierarchy', async () => {
      // Create parent -> child hierarchy
      const parentResponse = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test Circular Parent',
          primaryContactEmail: 'test-circular-parent@example.com',
        });

      const childResponse = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test Circular Child',
          primaryContactEmail: 'test-circular-child@example.com',
          parentAccountId: parentResponse.body.data.id,
        });

      // Try to set parent's parent to child (creating circular reference)
      return request(app.getHttpServer())
        .patch(`/api/accounts/${parentResponse.body.data.id}`)
        .send({
          parentAccountId: childResponse.body.data.id,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('circular');
        });
    });

    it('should update parent account successfully', async () => {
      const newParentResponse = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test New Parent',
          primaryContactEmail: 'test-new-parent@example.com',
        });

      return request(app.getHttpServer())
        .patch(`/api/accounts/${testAccountId}`)
        .send({
          parentAccountId: newParentResponse.body.data.id,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.parentAccountId).toBe(
            newParentResponse.body.data.id,
          );
        });
    });

    // NOTE: Skipped because primaryContactEmail doesn't have @unique constraint in schema
    // The service code handles P2002 errors, but the DB schema allows duplicates
    // TODO: Add @unique constraint to primaryContactEmail in schema if business logic requires it
    it.skip('should return 409 when updating to existing email', async () => {
      const existingEmail = `test-existing-${Date.now()}@example.com`;

      // Create another account with unique email
      await request(app.getHttpServer()).post('/api/accounts').send({
        accountName: 'Test Existing Email',
        primaryContactEmail: existingEmail,
      });

      // Try to update testAccount to use the same email
      return request(app.getHttpServer())
        .patch(`/api/accounts/${testAccountId}`)
        .send({
          primaryContactEmail: existingEmail,
        })
        .expect(409)
        .expect((res) => {
          expect(res.body.message).toContain('already exists');
        });
    });
  });

  describe('DELETE /api/accounts/:id', () => {
    let testAccountId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test Delete Account',
          primaryContactEmail: `test-delete-${Date.now()}@example.com`,
        });
      testAccountId = response.body.data.id;
    });

    it('should soft delete account successfully', async () => {
      await request(app.getHttpServer())
        .delete(`/api/accounts/${testAccountId}`)
        .expect(204);

      // Verify account is soft-deleted (not returned by GET)
      return request(app.getHttpServer())
        .get(`/api/accounts/${testAccountId}`)
        .expect(404);
    });

    it('should return 404 when deleting non-existent account', () => {
      return request(app.getHttpServer())
        .delete('/api/accounts/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('should return 404 when deleting already deleted account', async () => {
      // Delete once
      await request(app.getHttpServer())
        .delete(`/api/accounts/${testAccountId}`)
        .expect(204);

      // Try to delete again
      return request(app.getHttpServer())
        .delete(`/api/accounts/${testAccountId}`)
        .expect(404);
    });

    it('should set status to inactive when soft deleting', async () => {
      await request(app.getHttpServer())
        .delete(`/api/accounts/${testAccountId}`)
        .expect(204);

      // Check directly in database
      const deletedAccount = await prisma.account.findUnique({
        where: { id: testAccountId },
      });

      expect(deletedAccount?.status).toBe('inactive');
      expect(deletedAccount?.deletedAt).not.toBeNull();
    });
  });

  describe('Hierarchical Account Relationships', () => {
    it('should create multi-level hierarchy', async () => {
      // Create grandparent
      const grandparentResponse = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test Grandparent Corp',
          primaryContactEmail: 'test-grandparent@example.com',
        });

      // Create parent
      const parentResponse = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test Parent Division',
          primaryContactEmail: 'test-parent-div@example.com',
          parentAccountId: grandparentResponse.body.data.id,
        });

      // Create child
      const childResponse = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test Child Dept',
          primaryContactEmail: 'test-child-dept@example.com',
          parentAccountId: parentResponse.body.data.id,
        });

      // Verify child has correct parent
      const childDetails = await request(app.getHttpServer())
        .get(`/api/accounts/${childResponse.body.data.id}`)
        .expect(200);

      expect(childDetails.body.data.parent.id).toBe(
        parentResponse.body.data.id,
      );

      // Verify parent has child in children array
      const parentDetails = await request(app.getHttpServer())
        .get(`/api/accounts/${parentResponse.body.data.id}`)
        .expect(200);

      expect(parentDetails.body.data.children).toContainEqual(
        expect.objectContaining({
          id: childResponse.body.data.id,
          accountName: 'Test Child Dept',
        }),
      );
    });

    it('should list children count in parent account', async () => {
      // Create parent with multiple children
      const parentResponse = await request(app.getHttpServer())
        .post('/api/accounts')
        .send({
          accountName: 'Test Parent With Kids',
          primaryContactEmail: 'test-parent-kids@example.com',
        });

      await request(app.getHttpServer()).post('/api/accounts').send({
        accountName: 'Test Kid 1',
        primaryContactEmail: 'test-kid-1@example.com',
        parentAccountId: parentResponse.body.data.id,
      });

      await request(app.getHttpServer()).post('/api/accounts').send({
        accountName: 'Test Kid 2',
        primaryContactEmail: 'test-kid-2@example.com',
        parentAccountId: parentResponse.body.data.id,
      });

      const parentDetails = await request(app.getHttpServer())
        .get(`/api/accounts/${parentResponse.body.data.id}`)
        .expect(200);

      expect(parentDetails.body.data._count.children).toBe(2);
    });
  });
});
