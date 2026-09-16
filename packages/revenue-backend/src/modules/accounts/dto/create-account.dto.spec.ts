import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ArgumentMetadata } from '@nestjs/common/interfaces';
import { CreateAccountDto } from './create-account.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
});

const metadata: ArgumentMetadata = {
  type: 'body',
  metatype: CreateAccountDto,
  data: '',
};

const validAccount = {
  accountName: 'Acme Corporation',
  primaryContactEmail: 'contact@acme.com',
};

describe('CreateAccountDto', () => {
  describe('credit terms are not settable at creation', () => {
    it('rejects creditLimit — credit is granted via PATCH /accounts/:id/credit', async () => {
      await expect(
        pipe.transform({ ...validAccount, creditLimit: 10_000_000 }, metadata),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects creditHold', async () => {
      await expect(
        pipe.transform({ ...validAccount, creditHold: false }, metadata),
      ).rejects.toThrow(BadRequestException);
    });

    it('names the rejected field', async () => {
      await expect(
        pipe.transform({ ...validAccount, creditLimit: 1 }, metadata),
      ).rejects.toMatchObject({
        response: { message: [expect.stringContaining('creditLimit')] },
      });
    });
  });

  it('accepts an otherwise valid account', async () => {
    await expect(pipe.transform(validAccount, metadata)).resolves.toMatchObject(
      { accountName: 'Acme Corporation' },
    );
  });
});
