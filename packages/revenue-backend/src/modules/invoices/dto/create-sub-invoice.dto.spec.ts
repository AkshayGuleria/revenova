import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateSubInvoiceDto } from './create-sub-invoice.dto';
import { InvoiceStatus } from './create-invoice.dto';

describe('CreateSubInvoiceDto', () => {
  const validMinimal = { subtotal: 5000, total: 5000 };

  it('should validate a minimal valid sub-invoice (only required fields)', async () => {
    const dto = plainToInstance(CreateSubInvoiceDto, validMinimal);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate with all optional fields populated', async () => {
    const plain = {
      contractId: 'contract-uuid-123',
      invoiceGroupId: 'group-uuid-456',
      issueDate: '2026-01-01',
      dueDate: '2026-01-31',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      subtotal: 5000,
      tax: 400,
      discount: 100,
      total: 5300,
      currency: 'EUR',
      status: InvoiceStatus.DRAFT,
      notes: 'Engineering department allocation',
      internalNotes: 'Internal reference only',
      items: [
        {
          description: 'Software license',
          quantity: 10,
          unitPrice: 500,
          amount: 5000,
        },
      ],
      metadata: { department: 'Engineering' },
    };
    const dto = plainToInstance(CreateSubInvoiceDto, plain);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when subtotal is missing', async () => {
    const dto = plainToInstance(CreateSubInvoiceDto, { total: 5000 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'subtotal')).toBe(true);
  });

  it('should fail when total is missing', async () => {
    const dto = plainToInstance(CreateSubInvoiceDto, { subtotal: 5000 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'total')).toBe(true);
  });

  it('should fail when subtotal is negative', async () => {
    const dto = plainToInstance(CreateSubInvoiceDto, {
      subtotal: -1,
      total: 0,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'subtotal')).toBe(true);
  });

  it('should fail when total is negative', async () => {
    const dto = plainToInstance(CreateSubInvoiceDto, {
      subtotal: 0,
      total: -1,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'total')).toBe(true);
  });

  it('should fail when tax is negative', async () => {
    const dto = plainToInstance(CreateSubInvoiceDto, {
      ...validMinimal,
      tax: -1,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'tax')).toBe(true);
  });

  it('should fail when discount is negative', async () => {
    const dto = plainToInstance(CreateSubInvoiceDto, {
      ...validMinimal,
      discount: -5,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'discount')).toBe(true);
  });

  it('should fail when subtotal is not a number', async () => {
    const dto = plainToInstance(CreateSubInvoiceDto, {
      subtotal: 'abc',
      total: 100,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'subtotal')).toBe(true);
  });

  it('should fail when total is not a number', async () => {
    const dto = plainToInstance(CreateSubInvoiceDto, {
      subtotal: 100,
      total: 'xyz',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'total')).toBe(true);
  });

  it('should fail when issueDate is not a valid date string', async () => {
    const dto = plainToInstance(CreateSubInvoiceDto, {
      ...validMinimal,
      issueDate: 'not-a-date',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'issueDate')).toBe(true);
  });

  it('should fail when dueDate is not a valid date string', async () => {
    const dto = plainToInstance(CreateSubInvoiceDto, {
      ...validMinimal,
      dueDate: 'invalid',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'dueDate')).toBe(true);
  });

  it('should fail when periodStart is not a valid date string', async () => {
    const dto = plainToInstance(CreateSubInvoiceDto, {
      ...validMinimal,
      periodStart: 'bad',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'periodStart')).toBe(true);
  });

  it('should fail when periodEnd is not a valid date string', async () => {
    const dto = plainToInstance(CreateSubInvoiceDto, {
      ...validMinimal,
      periodEnd: 'bad',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'periodEnd')).toBe(true);
  });

  it('should fail when contractId is not a string', async () => {
    const dto = plainToInstance(CreateSubInvoiceDto, {
      ...validMinimal,
      contractId: 123,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'contractId')).toBe(true);
  });

  it('should fail when invoiceGroupId is not a string', async () => {
    const dto = plainToInstance(CreateSubInvoiceDto, {
      ...validMinimal,
      invoiceGroupId: 999,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'invoiceGroupId')).toBe(true);
  });

  it('should fail when currency is not a string', async () => {
    const dto = plainToInstance(CreateSubInvoiceDto, {
      ...validMinimal,
      currency: 42,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'currency')).toBe(true);
  });

  it('should fail when notes is not a string', async () => {
    const dto = plainToInstance(CreateSubInvoiceDto, {
      ...validMinimal,
      notes: 123,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'notes')).toBe(true);
  });

  it('should fail when internalNotes is not a string', async () => {
    const dto = plainToInstance(CreateSubInvoiceDto, {
      ...validMinimal,
      internalNotes: true,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'internalNotes')).toBe(true);
  });

  it('should fail when status is an invalid enum value', async () => {
    const dto = plainToInstance(CreateSubInvoiceDto, {
      ...validMinimal,
      status: 'invalid-status',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  it('should accept all valid InvoiceStatus enum values', async () => {
    for (const status of Object.values(InvoiceStatus)) {
      const dto = plainToInstance(CreateSubInvoiceDto, {
        ...validMinimal,
        status,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'status')).toBe(false);
    }
  });

  it('should fail when items is not an array', async () => {
    const dto = plainToInstance(CreateSubInvoiceDto, {
      ...validMinimal,
      items: 'not-an-array',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'items')).toBe(true);
  });

  it('should validate nested items using CreateInvoiceItemDto', async () => {
    const plain = {
      ...validMinimal,
      items: [
        { description: 'Service', quantity: 1, unitPrice: 5000, amount: 5000 },
      ],
    };
    const dto = plainToInstance(CreateSubInvoiceDto, plain);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail on invalid nested item', async () => {
    const plain = {
      ...validMinimal,
      items: [
        { description: 123, quantity: 'bad', unitPrice: -1, amount: 5000 },
      ],
    };
    const dto = plainToInstance(CreateSubInvoiceDto, plain);
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'items')).toBe(true);
  });

  it('should allow zero values for subtotal and total', async () => {
    const dto = plainToInstance(CreateSubInvoiceDto, { subtotal: 0, total: 0 });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should allow metadata of any shape', async () => {
    const dto = plainToInstance(CreateSubInvoiceDto, {
      ...validMinimal,
      metadata: { key: 'value', nested: { a: 1 } },
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});
