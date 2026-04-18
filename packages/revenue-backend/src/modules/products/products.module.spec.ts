import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ProductsModule } from './products.module';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';

describe('ProductsModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ProductsModule,
        PrismaModule,
      ],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide ProductsService', () => {
    const productsService = module.get<ProductsService>(ProductsService);
    expect(productsService).toBeDefined();
  });

  it('should provide ProductsController', () => {
    const productsController =
      module.get<ProductsController>(ProductsController);
    expect(productsController).toBeDefined();
  });

  it('should export ProductsService', async () => {
    const testModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ProductsModule,
        PrismaModule,
      ],
    }).compile();

    const productsService = testModule.get<ProductsService>(ProductsService);
    expect(productsService).toBeInstanceOf(ProductsService);
  });
});
