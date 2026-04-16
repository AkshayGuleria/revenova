import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateInvoiceDto,
  InvoiceStatus,
  BillingType,
} from './create-invoice.dto';
import { CreateInvoiceItemDto } from './create-invoice-item.dto';

describe('CreateInvoiceDto', () => {
  it('should validate a minimal valid invoice', async () => {
    const plain = {
      invoiceNumber: 'INV-2024-0001',
      accountId: 'account-uuid-123',
      issueDate: '2024-01-01',
      dueDate: '2024-01-31',
      subtotal: 10000,
      total: 10000,
    };
    const dto = plainToInstance(CreateInvoiceDto, plain);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should transform nested items using @Type(() => CreateInvoiceItemDto)', async () => {
    // This test invokes the @Type(() => CreateInvoiceItemDto) factory (line 211)
    // by passing plain object items through plainToInstance
    const plain = {
      invoiceNumber: 'INV-ITEMS-001',
      accountId: 'account-uuid-456',
      issueDate: '2024-01-01',
      dueDate: '2024-01-31',
      subtotal: 9999,
      total: 9999,
      items: [
        {
          description: 'Enterprise Plan - 100 seats',
          quantity: 100,
          unitPrice: 99.99,
          amount: 9999,
        },
      ],
    };

    const dto = plainToInstance(CreateInvoiceDto, plain);

    // The @Type decorator should transform items into CreateInvoiceItemDto instances
    expect(dto.items).toBeDefined();
    expect(dto.items).toHaveLength(1);
    expect(dto.items![0]).toBeInstanceOf(CreateInvoiceItemDto);
    expect(dto.items![0].description).toBe('Enterprise Plan - 100 seats');
    expect(dto.items![0].quantity).toBe(100);

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate invoice with all optional fields', async () => {
    const plain = {
      invoiceNumber: 'INV-FULL-001',
      accountId: 'account-uuid-789',
      contractId: 'contract-uuid-123',
      purchaseOrderNumber: 'PO-2024-001',
      issueDate: '2024-01-01',
      dueDate: '2024-01-31',
      periodStart: '2024-01-01',
      periodEnd: '2024-01-31',
      subtotal: 10000,
      tax: 800,
      discount: 500,
      total: 10300,
      currency: 'USD',
      status: InvoiceStatus.DRAFT,
      paidAmount: 0,
      paidDate: '2024-01-15',
      billingType: BillingType.RECURRING,
      consolidated: false,
      parentInvoiceId: 'parent-invoice-uuid',
      notes: 'Thank you for your business',
      internalNotes: 'Negotiated discount applied',
      metadata: { salesRep: 'Jane Smith', region: 'West' },
    };

    const dto = plainToInstance(CreateInvoiceDto, plain);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail validation if invoiceNumber is missing', async () => {
    const plain = {
      accountId: 'account-uuid-123',
      issueDate: '2024-01-01',
      dueDate: '2024-01-31',
      subtotal: 10000,
      total: 10000,
    };
    const dto = plainToInstance(CreateInvoiceDto, plain);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const errorFields = errors.map((e) => e.property);
    expect(errorFields).toContain('invoiceNumber');
  });

  it('should fail validation if subtotal is negative', async () => {
    const plain = {
      invoiceNumber: 'INV-NEG-001',
      accountId: 'account-uuid-123',
      issueDate: '2024-01-01',
      dueDate: '2024-01-31',
      subtotal: -100,
      total: -100,
    };
    const dto = plainToInstance(CreateInvoiceDto, plain);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const errorFields = errors.map((e) => e.property);
    expect(errorFields).toContain('subtotal');
  });
});
