import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ArgumentMetadata } from '@nestjs/common/interfaces';
import { UpdateInvoiceDto } from './update-invoice.dto';
import { InvoiceStatus } from './create-invoice.dto';

/**
 * Mirrors the global pipe configured in main.ts, so these assertions reflect
 * what an HTTP client actually gets.
 */
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
});

const metadata: ArgumentMetadata = {
  type: 'body',
  metatype: UpdateInvoiceDto,
  data: '',
};

describe('UpdateInvoiceDto', () => {
  describe('money and payment state are not client-writable', () => {
    it.each([
      ['paidAmount', 5000],
      ['paidDate', '2026-01-15'],
      ['tax', 800],
      ['discount', 500],
    ])('rejects %s', async (field, value) => {
      await expect(pipe.transform({ [field]: value }, metadata)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('names the rejected field so the caller can see what was refused', async () => {
      await expect(
        pipe.transform({ paidAmount: 5000 }, metadata),
      ).rejects.toMatchObject({
        response: { message: [expect.stringContaining('paidAmount')] },
      });
    });
  });

  describe('editable fields still pass', () => {
    it('allows a status change', async () => {
      await expect(
        pipe.transform({ status: InvoiceStatus.SENT }, metadata),
      ).resolves.toMatchObject({ status: InvoiceStatus.SENT });
    });

    it('allows notes and due date', async () => {
      await expect(
        pipe.transform(
          { notes: 'Updated terms', dueDate: '2026-02-28' },
          metadata,
        ),
      ).resolves.toMatchObject({ notes: 'Updated terms' });
    });
  });
});
