import { assertTestDatabase } from './assert-test-database';

describe('assertTestDatabase', () => {
  const devUrl =
    'postgresql://revenue_local:devpassword@localhost:5433/revenue_db_local?schema=public';

  it('throws when the database name is not a test database', () => {
    expect(() => assertTestDatabase(devUrl)).toThrow(/refusing/i);
  });

  it('names the offending database so the operator can see what was refused', () => {
    expect(() => assertTestDatabase(devUrl)).toThrow(/revenue_db_local/);
  });

  it('never includes the connection password in the error', () => {
    expect(() => assertTestDatabase(devUrl)).not.toThrow(/devpassword/);
  });

  it('allows a database named for unit tests', () => {
    expect(() =>
      assertTestDatabase(
        'postgresql://revenue_test:test_password@localhost:5432/revenue_test_db?schema=public',
      ),
    ).not.toThrow();
  });

  it('allows a database named for e2e tests', () => {
    expect(() =>
      assertTestDatabase(
        'postgresql://revenue_test:test_password@localhost:5432/revenue_e2e_db?schema=public',
      ),
    ).not.toThrow();
  });

  it('throws when no database url is configured', () => {
    expect(() => assertTestDatabase(undefined)).toThrow(/DATABASE_URL/);
  });

  it('throws when the url cannot be parsed', () => {
    expect(() => assertTestDatabase('not-a-url')).toThrow(/parse/i);
  });

  it('does not treat a test-like substring inside another word as a test database', () => {
    expect(() =>
      assertTestDatabase(
        'postgresql://u:p@localhost:5432/latest_billing?schema=public',
      ),
    ).toThrow(/refusing/i);
  });
});
