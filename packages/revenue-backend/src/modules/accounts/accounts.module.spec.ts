import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AccountsModule } from './accounts.module';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';

describe('AccountsModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        AccountsModule,
        PrismaModule,
      ],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide AccountsService', () => {
    const accountsService = module.get<AccountsService>(AccountsService);
    expect(accountsService).toBeDefined();
  });

  it('should provide AccountsController', () => {
    const accountsController =
      module.get<AccountsController>(AccountsController);
    expect(accountsController).toBeDefined();
  });

  it('should export AccountsService', async () => {
    const testModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        AccountsModule,
        PrismaModule,
      ],
    }).compile();

    const accountsService = testModule.get<AccountsService>(AccountsService);
    expect(accountsService).toBeInstanceOf(AccountsService);
  });
});
