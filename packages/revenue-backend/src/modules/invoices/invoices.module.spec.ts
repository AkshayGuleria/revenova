import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { InvoicesModule } from './invoices.module';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';

describe('InvoicesModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        InvoicesModule,
        PrismaModule,
      ],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide InvoicesService', () => {
    const invoicesService = module.get<InvoicesService>(InvoicesService);
    expect(invoicesService).toBeDefined();
  });

  it('should provide InvoicesController', () => {
    const invoicesController =
      module.get<InvoicesController>(InvoicesController);
    expect(invoicesController).toBeDefined();
  });

  it('should export InvoicesService', async () => {
    const testModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        InvoicesModule,
        PrismaModule,
      ],
    }).compile();

    const invoicesService = testModule.get<InvoicesService>(InvoicesService);
    expect(invoicesService).toBeInstanceOf(InvoicesService);
  });
});
