// @nestjs/bullmq internal providers (BullExplorer, BullMetadataAccessor, BullRegistrar) rely on
// ModuleRef and Reflector which are not auto-provided in global dynamic modules under NestJS v11.
// Mock the full package so module compilation succeeds and queue tokens resolve to mock instances.
const _mockQueueToken = (name: string) => `BullQueue_${name}`;
jest.mock('@nestjs/bullmq', () => {
  const getQueueToken = (name: string) => `BullQueue_${name}`;
  const mockQueue = { close: jest.fn().mockResolvedValue(undefined) };
  return {
    BullModule: {
      forRoot: jest.fn(() => ({ module: class MockBullRootModule {} })),
      forRootAsync: jest.fn(() => ({ module: class MockBullRootModule {} })),
      registerQueue: jest.fn((...configs: Array<{ name: string }>) => ({
        module: class MockBullQueueModule {},
        providers: configs.map((c) => ({
          provide: getQueueToken(c.name),
          useValue: mockQueue,
        })),
        exports: configs.map((c) => getQueueToken(c.name)),
      })),
      registerQueueAsync: jest.fn(() => ({
        module: class MockBullQueueModule {},
      })),
    },
    getQueueToken,
    // Use the real @nestjs/common Inject decorator so parameter metadata is registered correctly
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    InjectQueue: (name: string) => require('@nestjs/common').Inject(getQueueToken(name)),
    getFlowProducerToken: (name: string) => `BullFlowProducer_${name}`,
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    InjectFlowProducer: (name: string) => require('@nestjs/common').Inject(`BullFlowProducer_${name}`),
    Processor: () => () => {},
    WorkerHost: class {},
    OnWorkerEvent: () => () => {},
    OnQueueEvent: () => () => {},
    QueueEventsListener: () => () => {},
    QueueEventsHost: class {},
  };
});

import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './common/prisma/prisma.service';
import { AccountsService } from './modules/accounts/accounts.service';
import { ContractsService } from './modules/contracts/contracts.service';
import { ProductsService } from './modules/products/products.service';
import { InvoicesService } from './modules/invoices/invoices.service';
import { HealthController } from './health/health.controller';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_NAMES } from './common/queues';
import { Queue } from 'bullmq';

describe('AppModule', () => {
  let module: TestingModule;
  let contractBillingQueue: Queue;
  let consoleLogSpy: jest.SpyInstance;

  beforeAll(async () => {
    // Suppress Prisma connection logs during tests
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Get BullMQ queue for cleanup
    contractBillingQueue = module.get<Queue>(
      getQueueToken(QUEUE_NAMES.CONTRACT_BILLING),
    );
  });

  afterAll(async () => {
    // Close connections once after all tests complete
    try {
      if (contractBillingQueue) {
        await contractBillingQueue.close();
      }
      if (module) {
        await module.close();
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    } finally {
      // Restore console.log
      if (consoleLogSpy) {
        consoleLogSpy.mockRestore();
      }
    }
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide AppController', () => {
    const appController = module.get<AppController>(AppController);
    expect(appController).toBeDefined();
  });

  it('should provide AppService', () => {
    const appService = module.get<AppService>(AppService);
    expect(appService).toBeDefined();
  });

  it('should provide PrismaService', () => {
    const prismaService = module.get<PrismaService>(PrismaService);
    expect(prismaService).toBeDefined();
  });

  it('should provide AccountsService', () => {
    const accountsService = module.get<AccountsService>(AccountsService);
    expect(accountsService).toBeDefined();
  });

  it('should provide ContractsService', () => {
    const contractsService = module.get<ContractsService>(ContractsService);
    expect(contractsService).toBeDefined();
  });

  it('should provide ProductsService', () => {
    const productsService = module.get<ProductsService>(ProductsService);
    expect(productsService).toBeDefined();
  });

  it('should provide InvoicesService', () => {
    const invoicesService = module.get<InvoicesService>(InvoicesService);
    expect(invoicesService).toBeDefined();
  });

  it('should provide HealthController', () => {
    const healthController = module.get<HealthController>(HealthController);
    expect(healthController).toBeDefined();
  });
});
