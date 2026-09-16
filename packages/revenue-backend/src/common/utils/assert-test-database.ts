/**
 * Guards destructive test setup/teardown against non-test databases.
 *
 * The e2e suite truncates core tables. Prisma resolves DATABASE_URL from the same
 * .env the dev server uses, so without this check `npm run test:e2e` wipes local
 * development data — and wipes a shared database if DATABASE_URL happens to point
 * at one. Call this before any destructive operation.
 */

/** Database-name segments that mark a database as disposable. */
const TEST_DB_SEGMENTS = new Set(['test', 'tests', 'e2e', 'ci']);

export function assertTestDatabase(databaseUrl: string | undefined): void {
  if (!databaseUrl) {
    throw new Error(
      'Refusing to run destructive test setup: DATABASE_URL is not set.',
    );
  }

  let databaseName: string;
  try {
    databaseName = new URL(databaseUrl).pathname.replace(/^\//, '');
  } catch {
    throw new Error(
      'Refusing to run destructive test setup: could not parse DATABASE_URL.',
    );
  }

  const isTestDatabase = databaseName
    .split(/[^a-zA-Z0-9]+/)
    .some((segment) => TEST_DB_SEGMENTS.has(segment.toLowerCase()));

  if (!isTestDatabase) {
    // Never interpolate the URL itself — it carries the password.
    throw new Error(
      `Refusing to wipe database "${databaseName}": it is not a test database. ` +
        `Point DATABASE_URL at a database whose name contains one of: ` +
        `${[...TEST_DB_SEGMENTS].join(', ')}.`,
    );
  }
}
