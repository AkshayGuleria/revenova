import { PrismaClient } from '@prisma/client';

/**
 * Global setup for E2E tests
 * Ensures a clean database state before running tests
 */

const prisma = new PrismaClient();

async function globalSetup() {
  try {
    console.log('🔧 Setting up E2E test environment...');

    // Verify database connection
    await prisma.$connect();
    console.log('✅ Database connected');

    // Clean up existing test data
    console.log('🧹 Cleaning up test data...');

    // Delete in correct order (respecting foreign keys)
    await prisma.invoiceItem.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.invoiceGroup.deleteMany();
    await prisma.contractProduct.deleteMany();
    await prisma.contractShare.deleteMany();
    await prisma.contract.deleteMany();
    await prisma.product.deleteMany();
    await prisma.account.deleteMany();

    console.log('✅ Database cleaned successfully');

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ E2E setup failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

export default globalSetup;
