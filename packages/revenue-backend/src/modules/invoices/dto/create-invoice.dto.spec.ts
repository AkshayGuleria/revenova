import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateInvoiceDto,
  InvoiceStatus,
  BillingType,
} from './create-invoice.dto';

describe('CreateInvoiceDto', () => {
  it('should validate a minimal valid invoice', async () => {
    const plain = {
      invoiceNumber: 'INV-2024-0001',
      accountId: 'account-uuid-123',
      contractId: 'contract-uuid-456',
      issueDate: '2024-01-01',
      dueDate: '2024-01-31',
    };
    const dto = plainToInstance(CreateInvoiceDto, plain);
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
      tax: 800,
      discount: 500,
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
      contractId: 'contract-uuid-456',
      issueDate: '2024-01-01',
      dueDate: '2024-01-31',
    };
    const dto = plainToInstance(CreateInvoiceDto, plain);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const errorFields = errors.map((e) => e.property);
    expect(errorFields).toContain('invoiceNumber');
  });

  it('should fail validation if contractId is missing', async () => {
    const plain = {
      invoiceNumber: 'INV-2024-0001',
      accountId: 'account-uuid-123',
      issueDate: '2024-01-01',
      dueDate: '2024-01-31',
    };
    const dto = plainToInstance(CreateInvoiceDto, plain);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const errorFields = errors.map((e) => e.property);
    expect(errorFields).toContain('contractId');
  });

  it('should fail validation if tax is negative', async () => {
    const plain = {
      invoiceNumber: 'INV-NEG-001',
      accountId: 'account-uuid-123',
      contractId: 'contract-uuid-456',
      issueDate: '2024-01-01',
      dueDate: '2024-01-31',
      tax: -100,
    };
    const dto = plainToInstance(CreateInvoiceDto, plain);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const errorFields = errors.map((e) => e.property);
    expect(errorFields).toContain('tax');
  });
});
