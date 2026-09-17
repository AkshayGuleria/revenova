import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateInvoiceDto } from './create-invoice.dto';

/**
 * Invoice amounts are derived, never client-supplied.
 *
 * `tax` and `discount` are omitted because update does not recompute `total`,
 * so accepting them lets a caller push an invoice's stored total out of sync
 * with its line items. `paidAmount`/`paidDate` are payment-derived state and
 * live on CreateInvoiceDto's exclusion list too — they change only through
 * PaymentsService.
 */
export class UpdateInvoiceDto extends PartialType(
  OmitType(CreateInvoiceDto, ['tax', 'discount'] as const),
) {}
