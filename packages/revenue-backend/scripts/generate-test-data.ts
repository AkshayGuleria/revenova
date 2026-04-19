#!/usr/bin/env ts-node
/**
 * Test Data Generator for Revenue Management System
 *
 * Generates:
 * - Product catalog (seat-based, flat fee, volume-tiered) — ~130 products
 * - Hierarchical accounts (parent → subsidiary → department) — ~300 accounts
 * - Contracts for accounts with varying terms — ~150+ contracts
 *
 * Usage:
 *   npm run generate-data
 *   npm run generate-data -- --clean  (clears existing data first)
 */

import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5177';
const CLEAN_FIRST = process.argv.includes('--clean');

enum AccountType {
  ENTERPRISE = 'enterprise',
  SMB = 'smb',
  STARTUP = 'startup',
}

enum PaymentTerms {
  NET_30 = 'net_30',
  NET_60 = 'net_60',
  NET_90 = 'net_90',
  DUE_ON_RECEIPT = 'due_on_receipt',
}

enum PricingModel {
  SEAT_BASED = 'seat_based',
  FLAT_FEE = 'flat_fee',
  VOLUME_TIERED = 'volume_tiered',
  CUSTOM = 'custom',
}

enum ChargeType {
  RECURRING = 'recurring',
  ONE_TIME = 'one_time',
  USAGE_BASED = 'usage_based',
}

enum ProductCategory {
  PLATFORM = 'platform',
  SEATS = 'seats',
  ADDON = 'addon',
  SUPPORT = 'support',
  PROFESSIONAL_SERVICES = 'professional_services',
  STORAGE = 'storage',
  API = 'api',
}

enum BillingInterval {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  SEMI_ANNUAL = 'semi_annual',
  ANNUAL = 'annual',
}

enum BillingFrequency {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  SEMI_ANNUAL = 'semi_annual',
  ANNUAL = 'annual',
}

// ---------------------------------------------------------------------------
// Seed data pools for programmatic generation
// ---------------------------------------------------------------------------

const INDUSTRIES = [
  'Technology', 'Manufacturing', 'Healthcare', 'Finance', 'Retail',
  'Education', 'Energy', 'Logistics', 'Media', 'Telecommunications',
  'Aerospace', 'Automotive', 'Construction', 'Food & Beverage', 'Insurance',
  'Legal', 'Pharmaceuticals', 'Real Estate', 'Travel & Hospitality', 'Government',
  'Nonprofit', 'Agriculture', 'Mining', 'Utilities', 'Professional Services',
  'E-Commerce', 'Gaming', 'Cybersecurity', 'Biotech', 'Clean Energy',
];

const REGIONS = ['West', 'Central', 'East', 'Southwest', 'Southeast', 'Northwest', 'Northeast', 'Midwest'];

const SALES_REPS = [
  'Alice Johnson', 'Bob Martinez', 'Carol White', 'David Lee', 'Emily Brown',
  'Frank Davis', 'Grace Wilson', 'Henry Moore', 'Iris Taylor', 'James Anderson',
  'Karen Thomas', 'Leo Jackson', 'Monica Harris', 'Nathan Clark', 'Olivia Lewis',
];

const US_CITIES: { city: string; state: string; zip: string }[] = [
  { city: 'San Francisco', state: 'CA', zip: '94105' },
  { city: 'Austin', state: 'TX', zip: '78701' },
  { city: 'Seattle', state: 'WA', zip: '98101' },
  { city: 'New York', state: 'NY', zip: '10001' },
  { city: 'Chicago', state: 'IL', zip: '60601' },
  { city: 'Boston', state: 'MA', zip: '02101' },
  { city: 'Miami', state: 'FL', zip: '33101' },
  { city: 'Denver', state: 'CO', zip: '80201' },
  { city: 'Atlanta', state: 'GA', zip: '30301' },
  { city: 'Phoenix', state: 'AZ', zip: '85001' },
  { city: 'Portland', state: 'OR', zip: '97201' },
  { city: 'Detroit', state: 'MI', zip: '48201' },
  { city: 'Palo Alto', state: 'CA', zip: '94301' },
  { city: 'Dallas', state: 'TX', zip: '75201' },
  { city: 'Minneapolis', state: 'MN', zip: '55401' },
  { city: 'Nashville', state: 'TN', zip: '37201' },
  { city: 'Raleigh', state: 'NC', zip: '27601' },
  { city: 'Salt Lake City', state: 'UT', zip: '84101' },
  { city: 'Las Vegas', state: 'NV', zip: '89101' },
  { city: 'Pittsburgh', state: 'PA', zip: '15201' },
  { city: 'Columbus', state: 'OH', zip: '43201' },
  { city: 'Kansas City', state: 'MO', zip: '64101' },
  { city: 'San Diego', state: 'CA', zip: '92101' },
  { city: 'Baltimore', state: 'MD', zip: '21201' },
  { city: 'Tampa', state: 'FL', zip: '33601' },
  { city: 'Charlotte', state: 'NC', zip: '28201' },
  { city: 'Indianapolis', state: 'IN', zip: '46201' },
  { city: 'San Antonio', state: 'TX', zip: '78201' },
  { city: 'San Jose', state: 'CA', zip: '95101' },
  { city: 'Jacksonville', state: 'FL', zip: '32201' },
];

const CURRENCIES = ['EUR'];

const PAYMENT_TERMS_LIST = [
  { terms: PaymentTerms.NET_30, days: 30 },
  { terms: PaymentTerms.NET_60, days: 60 },
  { terms: PaymentTerms.NET_90, days: 90 },
  { terms: PaymentTerms.DUE_ON_RECEIPT, days: 0 },
];

// ---------------------------------------------------------------------------
// Deterministic helpers (no Math.random — reproducible runs)
// ---------------------------------------------------------------------------

function pick<T>(arr: T[], index: number): T {
  return arr[index % arr.length];
}

function pickSlice<T>(arr: T[], startIndex: number, count: number): T[] {
  if (arr.length === 0) return [];
  const results: T[] = [];
  for (let j = 0; j < count && j < arr.length; j++) {
    results.push(arr[(startIndex + j) % arr.length]);
  }
  return results;
}

function pickPaymentTerms(index: number) {
  return PAYMENT_TERMS_LIST[index % PAYMENT_TERMS_LIST.length];
}

class DataGenerator {
  private client: AxiosInstance;
  private generatedIds: {
    products: string[];
    accounts: string[];
    contracts: string[];
  };

  constructor(baseURL: string) {
    this.client = axios.create({ baseURL, timeout: 15000 });

    // Add Content-Type only for write methods — DELETE has no body and
    // Fastify 400s if Content-Type is present without a matching body.
    this.client.interceptors.request.use((config) => {
      if (['post', 'put', 'patch'].includes(config.method ?? '')) {
        config.headers['Content-Type'] = 'application/json';
      }
      return config;
    });

    this.generatedIds = { products: [], accounts: [], contracts: [] };
  }

  private log(message: string, ...args: any[]) {
    console.log(`[${new Date().toISOString()}] ${message}`, ...args);
  }

  private error(message: string, error: any) {
    console.error(
      `[${new Date().toISOString()}] ❌ ${message}`,
      error.response?.data || error.message,
    );
  }

  private success(message: string) {
    console.log(`[${new Date().toISOString()}] ✅ ${message}`);
  }

  // ---------------------------------------------------------------------------
  // Products — ~130 total
  // ---------------------------------------------------------------------------

  async generateProducts() {
    this.log('📦 Generating product catalog...');

    const products: any[] = [];

    // ── Core Plans × 3 tiers × 4 billing intervals = 12 ─────────────────────
    const plans = [
      { name: 'Starter', sku: 'PLAN-STARTER', basePrice: 29.99, minSeats: 1 },
      { name: 'Professional', sku: 'PLAN-PRO', basePrice: 79.99, minSeats: 5, setupFee: 500 },
      { name: 'Business', sku: 'PLAN-BIZ', basePrice: 119.99, minSeats: 10, setupFee: 1000 },
      { name: 'Enterprise', sku: 'PLAN-ENT', basePrice: 149.99, minSeats: 25, setupFee: 2000, minCommitmentMonths: 12 },
      { name: 'Enterprise Plus', sku: 'PLAN-ENT-PLUS', basePrice: 199.99, minSeats: 50, setupFee: 5000, minCommitmentMonths: 12 },
    ];
    const intervals = [
      BillingInterval.MONTHLY,
      BillingInterval.QUARTERLY,
      BillingInterval.SEMI_ANNUAL,
      BillingInterval.ANNUAL,
    ];
    for (const plan of plans) {
      for (const interval of intervals) {
        const discount = interval === BillingInterval.ANNUAL ? 0.8
          : interval === BillingInterval.SEMI_ANNUAL ? 0.88
          : interval === BillingInterval.QUARTERLY ? 0.94
          : 1.0;
        products.push({
          name: `${plan.name} Plan (${interval})`,
          description: `${plan.name} plan billed ${interval}.`,
          sku: `${plan.sku}-${interval.toUpperCase()}`,
          pricingModel: PricingModel.SEAT_BASED,
          chargeType: ChargeType.RECURRING,
          category: ProductCategory.PLATFORM,
          basePrice: Math.round(plan.basePrice * discount * 100) / 100,
          currency: 'EUR',
          billingInterval: interval,
          setupFee: (plan as any).setupFee,
          minSeats: plan.minSeats,
          minCommitmentMonths: (plan as any).minCommitmentMonths,
          active: true,
          isAddon: false,
        });
      }
    }

    // ── Volume-tiered Enterprise plans × 3 seat bands = 3 ────────────────────
    const enterpriseTierSets = [
      { name: 'Enterprise Volume S', sku: 'ENT-VOL-S', base: 129.99, min: 10, max: 200 },
      { name: 'Enterprise Volume M', sku: 'ENT-VOL-M', base: 109.99, min: 201, max: 1000 },
      { name: 'Enterprise Volume L', sku: 'ENT-VOL-L', base: 89.99, min: 1001, max: null },
    ];
    for (const tier of enterpriseTierSets) {
      products.push({
        name: tier.name,
        description: `Volume-tiered enterprise plan (${tier.min}+ seats).`,
        sku: tier.sku,
        pricingModel: PricingModel.VOLUME_TIERED,
        chargeType: ChargeType.RECURRING,
        category: ProductCategory.PLATFORM,
        basePrice: tier.base,
        currency: 'EUR',
        billingInterval: BillingInterval.ANNUAL,
        setupFee: 2000,
        minCommitmentMonths: 12,
        minSeats: tier.min,
        volumeTiers: [
          { minQuantity: tier.min, maxQuantity: Math.min(tier.min + 49, tier.max ?? tier.min + 49), pricePerUnit: tier.base },
          { minQuantity: tier.min + 50, maxQuantity: Math.min(tier.min + 199, tier.max ?? tier.min + 199), pricePerUnit: tier.base * 0.9 },
          { minQuantity: tier.min + 200, maxQuantity: tier.max, pricePerUnit: tier.base * 0.75 },
        ],
        active: true,
        isAddon: false,
      });
    }

    // ── Add-ons × 10 modules = 10 ────────────────────────────────────────────
    const addons = [
      { name: 'Advanced Analytics', sku: 'ADDON-ANALYTICS', price: 499, desc: 'In-depth analytics dashboards, custom reports, and data exports.' },
      { name: 'AI Assistant', sku: 'ADDON-AI', price: 999, desc: 'AI-powered automation, recommendations, and workflow assistance.' },
      { name: 'Premium API Access', sku: 'ADDON-API', price: 299, desc: 'Higher rate limits, dedicated API keys, and webhook support.' },
      { name: 'Custom SSO / SAML', sku: 'ADDON-SSO', price: 199, desc: 'Enterprise SSO with SAML 2.0 and SCIM provisioning.' },
      { name: 'Audit & Compliance Pack', sku: 'ADDON-AUDIT', price: 399, desc: 'SOC2-ready audit logs, access reports, and compliance exports.' },
      { name: 'White-Label Branding', sku: 'ADDON-BRAND', price: 599, desc: 'Custom domain, logo, and color scheme for your workspace.' },
      { name: 'Advanced Security', sku: 'ADDON-SEC', price: 449, desc: 'IP allowlisting, session policies, and anomaly detection.' },
      { name: 'Workflow Automation', sku: 'ADDON-AUTO', price: 349, desc: 'No-code workflow builder with triggers and conditional logic.' },
      { name: 'Data Warehouse Sync', sku: 'ADDON-DWH', price: 799, desc: 'Real-time sync to Snowflake, BigQuery, or Redshift.' },
      { name: 'Mobile Management', sku: 'ADDON-MOBILE', price: 249, desc: 'MDM integration and mobile app management tools.' },
    ];
    for (const addon of addons) {
      products.push({
        name: addon.name,
        description: addon.desc,
        sku: addon.sku,
        pricingModel: PricingModel.FLAT_FEE,
        chargeType: ChargeType.RECURRING,
        category: ProductCategory.ADDON,
        basePrice: addon.price,
        currency: 'EUR',
        billingInterval: BillingInterval.MONTHLY,
        active: true,
        isAddon: true,
      });
    }

    // ── Support tiers × 4 = 4 ────────────────────────────────────────────────
    const supportTiers = [
      { name: 'Basic Support', sku: 'SUPPORT-BASIC', price: 199 },
      { name: 'Standard Support', sku: 'SUPPORT-STD', price: 499 },
      { name: 'Premium Support', sku: 'SUPPORT-PREM', price: 999 },
      { name: 'Dedicated CSM', sku: 'SUPPORT-CSM', price: 2500 },
    ];
    for (const s of supportTiers) {
      products.push({
        name: s.name,
        description: `${s.name} package with SLA guarantees and dedicated channels.`,
        sku: s.sku,
        pricingModel: PricingModel.FLAT_FEE,
        chargeType: ChargeType.RECURRING,
        category: ProductCategory.SUPPORT,
        basePrice: s.price,
        currency: 'EUR',
        billingInterval: BillingInterval.MONTHLY,
        active: true,
        isAddon: false,
      });
    }

    // ── Storage add-ons × 4 tiers = 4 ────────────────────────────────────────
    const storageTiers = [
      { name: 'Storage 100 GB', sku: 'STOR-100', price: 49 },
      { name: 'Storage 500 GB', sku: 'STOR-500', price: 199 },
      { name: 'Storage 2 TB', sku: 'STOR-2T', price: 599 },
      { name: 'Storage 10 TB', sku: 'STOR-10T', price: 1999 },
    ];
    for (const s of storageTiers) {
      products.push({
        name: s.name,
        description: `${s.name} of managed cloud storage with redundancy and encryption.`,
        sku: s.sku,
        pricingModel: PricingModel.FLAT_FEE,
        chargeType: ChargeType.RECURRING,
        category: ProductCategory.STORAGE,
        basePrice: s.price,
        currency: 'EUR',
        billingInterval: BillingInterval.MONTHLY,
        active: true,
        isAddon: true,
      });
    }

    // ── API rate-limit bundles × 5 = 5 ───────────────────────────────────────
    const apiBundles = [
      { name: 'API 10k calls/mo', sku: 'API-10K', price: 29 },
      { name: 'API 100k calls/mo', sku: 'API-100K', price: 99 },
      { name: 'API 1M calls/mo', sku: 'API-1M', price: 299 },
      { name: 'API 10M calls/mo', sku: 'API-10M', price: 799 },
      { name: 'API Unlimited', sku: 'API-UNL', price: 1999 },
    ];
    for (const b of apiBundles) {
      products.push({
        name: b.name,
        description: `${b.name} with dedicated rate limits and SLA.`,
        sku: b.sku,
        pricingModel: PricingModel.FLAT_FEE,
        chargeType: ChargeType.RECURRING,
        category: ProductCategory.API,
        basePrice: b.price,
        currency: 'EUR',
        billingInterval: BillingInterval.MONTHLY,
        active: true,
        isAddon: true,
      });
    }

    // ── Professional services × 10 = 10 ──────────────────────────────────────
    const professionalServices = [
      { name: 'Onboarding Package - Basic', sku: 'SVC-ONBOARD-BASIC', price: 2500 },
      { name: 'Onboarding Package - Standard', sku: 'SVC-ONBOARD-STD', price: 5000 },
      { name: 'Onboarding Package - Enterprise', sku: 'SVC-ONBOARD-ENT', price: 12000 },
      { name: 'Data Migration - Small', sku: 'SVC-MIG-S', price: 1500 },
      { name: 'Data Migration - Large', sku: 'SVC-MIG-L', price: 8000 },
      { name: 'Custom Integration', sku: 'SVC-INT', price: 15000 },
      { name: 'Training Workshop - Half Day', sku: 'SVC-TRAIN-HD', price: 1500 },
      { name: 'Training Workshop - Full Day', sku: 'SVC-TRAIN-FD', price: 2500 },
      { name: 'Architecture Review', sku: 'SVC-ARCH', price: 5000 },
      { name: 'Security Assessment', sku: 'SVC-SEC-ASSESS', price: 7500 },
    ];
    for (const svc of professionalServices) {
      products.push({
        name: svc.name,
        description: `Professional service: ${svc.name}.`,
        sku: svc.sku,
        pricingModel: PricingModel.FLAT_FEE,
        chargeType: ChargeType.ONE_TIME,
        category: ProductCategory.PROFESSIONAL_SERVICES,
        basePrice: svc.price,
        currency: 'EUR',
        active: true,
        isAddon: false,
      });
    }

    // ── EUR-priced plan variants × 20 (mirrors base EUR plans, different intervals) ──
    for (const plan of plans) {
      for (const interval of intervals) {
        const discount = interval === BillingInterval.ANNUAL ? 0.8
          : interval === BillingInterval.SEMI_ANNUAL ? 0.88
          : interval === BillingInterval.QUARTERLY ? 0.94
          : 1.0;
        products.push({
          name: `${plan.name} Plan (${interval}) — EUR`,
          description: `${plan.name} plan billed ${interval} in EUR.`,
          sku: `${plan.sku}-${interval.toUpperCase()}-EUR`,
          pricingModel: PricingModel.SEAT_BASED,
          chargeType: ChargeType.RECURRING,
          category: ProductCategory.PLATFORM,
          basePrice: Math.round(plan.basePrice * discount * 1.08 * 100) / 100,
          currency: 'EUR',
          billingInterval: interval,
          setupFee: (plan as any).setupFee,
          minSeats: plan.minSeats,
          minCommitmentMonths: (plan as any).minCommitmentMonths,
          active: true,
          isAddon: false,
        });
      }
    }

    // ── Industry-specific bundles × 10 ───────────────────────────────────────
    const industryBundles = [
      { name: 'Healthcare Compliance Bundle', sku: 'BUNDLE-HC', price: 1499, desc: 'HIPAA-ready workspace with audit trails and access controls.' },
      { name: 'Financial Services Pack', sku: 'BUNDLE-FS', price: 1299, desc: 'SOX/GDPR compliance, encrypted data storage, and audit reporting.' },
      { name: 'Education Institution Plan', sku: 'BUNDLE-EDU', price: 299, desc: 'Volume licensing for academic institutions with LMS integration.' },
      { name: 'Government & Public Sector', sku: 'BUNDLE-GOV', price: 1999, desc: 'FedRAMP-aligned deployment with on-prem option.' },
      { name: 'Legal & Law Firm Pack', sku: 'BUNDLE-LEGAL', price: 899, desc: 'Matter management, conflict checks, and DMS integration.' },
      { name: 'Retail & E-Commerce Pack', sku: 'BUNDLE-RETAIL', price: 699, desc: 'Inventory, POS integration, and seasonal scaling.' },
      { name: 'Manufacturing Operations Pack', sku: 'BUNDLE-MFG', price: 1099, desc: 'ERP integration, shop floor visibility, and IoT connectors.' },
      { name: 'Media & Publishing Pack', sku: 'BUNDLE-MEDIA', price: 799, desc: 'DAM integration, workflow approvals, and CDN connectors.' },
      { name: 'Logistics & Supply Chain Pack', sku: 'BUNDLE-LOGI', price: 999, desc: 'Route optimization, carrier integrations, and real-time tracking.' },
      { name: 'Nonprofit & NGO Pack', sku: 'BUNDLE-NGO', price: 149, desc: 'Discounted plan with grant reporting and donor management.' },
    ];
    for (const b of industryBundles) {
      products.push({
        name: b.name,
        description: b.desc,
        sku: b.sku,
        pricingModel: PricingModel.FLAT_FEE,
        chargeType: ChargeType.RECURRING,
        category: ProductCategory.PLATFORM,
        basePrice: b.price,
        currency: 'EUR',
        billingInterval: BillingInterval.ANNUAL,
        minCommitmentMonths: 12,
        active: true,
        isAddon: false,
      });
    }

    // ── Usage-based API products × 5 ─────────────────────────────────────────
    const usageProducts = [
      { name: 'SMS Notifications (per 1k)', sku: 'USAGE-SMS', price: 4.99 },
      { name: 'Email Delivery (per 10k)', sku: 'USAGE-EMAIL', price: 1.99 },
      { name: 'OCR Processing (per 1k pages)', sku: 'USAGE-OCR', price: 9.99 },
      { name: 'ML Inference (per 1k calls)', sku: 'USAGE-ML', price: 14.99 },
      { name: 'Video Transcoding (per hour)', sku: 'USAGE-VIDEO', price: 2.99 },
    ];
    for (const u of usageProducts) {
      products.push({
        name: u.name,
        description: `Usage-based: ${u.name}.`,
        sku: u.sku,
        pricingModel: PricingModel.CUSTOM,
        chargeType: ChargeType.USAGE_BASED,
        category: ProductCategory.API,
        basePrice: u.price,
        currency: 'EUR',
        active: true,
        isAddon: true,
      });
    }

    // ── Collaboration & productivity add-ons × 10 ────────────────────────────
    const collabAddons = [
      { name: 'Video Conferencing Integration', sku: 'COLLAB-VIDEO', price: 149 },
      { name: 'E-Signature Module', sku: 'COLLAB-ESIGN', price: 199 },
      { name: 'Project Management Suite', sku: 'COLLAB-PM', price: 249 },
      { name: 'CRM Connector Pack', sku: 'COLLAB-CRM', price: 179 },
      { name: 'Slack & Teams Integration', sku: 'COLLAB-CHAT', price: 99 },
      { name: 'Document Management', sku: 'COLLAB-DMS', price: 299 },
      { name: 'HR System Connector', sku: 'COLLAB-HR', price: 149 },
      { name: 'ERP Integration Bridge', sku: 'COLLAB-ERP', price: 399 },
      { name: 'BI & Reporting Connector', sku: 'COLLAB-BI', price: 349 },
      { name: 'Customer Portal', sku: 'COLLAB-PORTAL', price: 499 },
    ];
    for (const a of collabAddons) {
      products.push({
        name: a.name,
        description: `Collaboration add-on: ${a.name}.`,
        sku: a.sku,
        pricingModel: PricingModel.FLAT_FEE,
        chargeType: ChargeType.RECURRING,
        category: ProductCategory.ADDON,
        basePrice: a.price,
        currency: 'EUR',
        billingInterval: BillingInterval.MONTHLY,
        active: true,
        isAddon: true,
      });
    }

    // ── Inactive / legacy products × 5 (for realistic catalog) ───────────────
    const legacyProducts = [
      { name: 'Legacy Basic Plan', sku: 'LEGACY-BASIC', price: 19.99 },
      { name: 'Legacy Pro Plan', sku: 'LEGACY-PRO', price: 59.99 },
      { name: 'Legacy API Bundle', sku: 'LEGACY-API', price: 149 },
      { name: 'Old Support Tier', sku: 'LEGACY-SUPPORT', price: 299 },
      { name: 'Deprecated Add-on', sku: 'LEGACY-ADDON', price: 99 },
    ];
    for (const p of legacyProducts) {
      products.push({
        name: p.name,
        description: `Legacy product — no longer sold to new customers.`,
        sku: p.sku,
        pricingModel: PricingModel.FLAT_FEE,
        chargeType: ChargeType.RECURRING,
        category: ProductCategory.PLATFORM,
        basePrice: p.price,
        currency: 'EUR',
        billingInterval: BillingInterval.MONTHLY,
        active: false,
        isAddon: false,
      });
    }

    for (const product of products) {
      try {
        const response = await this.client.post('/api/products', product);
        const productId = response.data.data.id;
        this.generatedIds.products.push(productId);
        this.success(`Created product: ${product.name} (ID: ${productId})`);
      } catch (error) {
        this.error(`Failed to create product: ${product.name}`, error);
      }
    }

    this.log(`✅ Created ${this.generatedIds.products.length} products`);
  }

  // ---------------------------------------------------------------------------
  // Accounts — 30 parents × 3 subsidiaries × 3 departments + 30 standalone
  // ---------------------------------------------------------------------------

  async generateAccounts() {
    this.log('🏢 Generating hierarchical accounts...');

    // ── 30 Parent companies ───────────────────────────────────────────────────
    const parentCompanyNames = [
      'Acme Corporation', 'GlobalTech Industries', 'CloudScale Solutions',
      'Nexus Dynamics', 'Pinnacle Systems', 'Apex Innovations',
      'Meridian Enterprises', 'Vanguard Technologies', 'Horizon Group',
      'Summit Corp', 'Titan Solutions', 'Atlas Industries',
      'Quantum Ventures', 'Orion Technologies', 'Phoenix Holdings',
      'Cascade Networks', 'Redwood Dynamics', 'Sterling Global',
      'Vector Systems', 'Prism Technologies', 'Eclipse Corp',
      'Polaris Industries', 'Delta Innovations', 'Stellar Enterprises',
      'Olympus Group', 'Helios Technologies', 'Zodiac Solutions',
      'Mosaic Industries', 'Compass Technologies', 'Lighthouse Corp',
    ];

    const parentIds: string[] = [];
    let accountIdx = 0;

    for (let i = 0; i < parentCompanyNames.length; i++) {
      const name = parentCompanyNames[i];
      const loc = pick(US_CITIES, i);
      const pt = pickPaymentTerms(i);
      const industry = pick(INDUSTRIES, i);
      const salesRep = pick(SALES_REPS, i);
      const region = pick(REGIONS, i);
      const creditLimit = 100000 + (i % 10) * 100000;
      const currency = pick(CURRENCIES, i);
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');

      const payload = {
        accountName: name,
        accountType: AccountType.ENTERPRISE,
        primaryContactEmail: `contact@${slug}.com`,
        billingContactName: salesRep,
        billingContactEmail: `billing@${slug}.com`,
        billingContactPhone: `+1-555-${String(i + 1).padStart(3, '0')}-0001`,
        billingAddressLine1: `${100 + i} Corporate Blvd`,
        billingCity: loc.city,
        billingState: loc.state,
        billingPostalCode: loc.zip,
        billingCountry: 'USA',
        paymentTerms: pt.terms,
        paymentTermsDays: pt.days,
        currency,
        taxId: `US-TAX-${slug.toUpperCase().slice(0, 8)}-${String(i + 1).padStart(3, '0')}`,
        creditLimit,
        creditHold: false,
        metadata: { industry, employeeCount: 1000 + i * 500, salesRep, region },
      };

      try {
        const response = await this.client.post('/api/accounts', payload);
        const id = response.data.data.id;
        this.generatedIds.accounts.push(id);
        parentIds.push(id);
        this.success(`Created parent account: ${name} (ID: ${id})`);
        accountIdx++;
      } catch (error) {
        this.error(`Failed to create parent account: ${name}`, error);
        parentIds.push(''); // keep index alignment
      }
    }

    // ── 3 Subsidiaries per parent ─────────────────────────────────────────────
    const divisionNames = ['North America', 'Europe', 'Asia Pacific'];
    const level2Ids: string[] = [];

    for (let p = 0; p < parentIds.length; p++) {
      const parentId = parentIds[p];
      if (!parentId) continue;
      const parentName = parentCompanyNames[p];

      for (let d = 0; d < divisionNames.length; d++) {
        const division = divisionNames[d];
        const loc = pick(US_CITIES, p * 3 + d + 10);
        const pt = pickPaymentTerms(p + d + 1);
        const currency = pick(CURRENCIES, d);
        const slug = `${parentName}${division}`.toLowerCase().replace(/[^a-z0-9]/g, '');

        const payload = {
          parentAccountId: parentId,
          accountName: `${parentName} — ${division}`,
          accountType: AccountType.ENTERPRISE,
          primaryContactEmail: `contact@${slug.slice(0, 20)}.com`,
          billingContactEmail: `billing@${slug.slice(0, 20)}.com`,
          billingAddressLine1: `${200 + p * 3 + d} Division Parkway`,
          billingCity: loc.city,
          billingState: loc.state,
          billingPostalCode: loc.zip,
          billingCountry: d === 1 ? 'UK' : d === 2 ? 'SGP' : 'USA',
          paymentTerms: pt.terms,
          paymentTermsDays: pt.days,
          currency,
          creditLimit: 50000 + (p % 5) * 50000,
          creditHold: false,
          metadata: { division, parentCompany: parentName, level: 2 },
        };

        try {
          const response = await this.client.post('/api/accounts', payload);
          const id = response.data.data.id;
          this.generatedIds.accounts.push(id);
          level2Ids.push(id);
          this.success(`Created subsidiary: ${payload.accountName} (ID: ${id})`);
        } catch (error) {
          this.error(`Failed to create subsidiary: ${payload.accountName}`, error);
          level2Ids.push('');
        }
      }
    }

    // ── 3 Departments per subsidiary ──────────────────────────────────────────
    const departmentNames = ['Sales', 'Engineering', 'Operations'];

    for (let s = 0; s < level2Ids.length; s++) {
      const subId = level2Ids[s];
      if (!subId) continue;

      for (let d = 0; d < departmentNames.length; d++) {
        const dept = departmentNames[d];
        const loc = pick(US_CITIES, s + d + 5);
        const slug = `sub${s}dept${d}`.replace(/[^a-z0-9]/g, '');

        const payload = {
          parentAccountId: subId,
          accountName: `Dept ${s + 1} — ${dept}`,
          accountType: AccountType.SMB,
          primaryContactEmail: `contact-${dept.toLowerCase()}@${slug}.internal`,
          billingAddressLine1: `${300 + s * 3 + d} Department Street`,
          billingCity: loc.city,
          billingState: loc.state,
          billingPostalCode: loc.zip,
          billingCountry: 'USA',
          paymentTerms: PaymentTerms.NET_30,
          currency: 'EUR',
          creditLimit: 25000 + d * 10000,
          creditHold: d === 2 && s % 7 === 0, // occasional credit hold for realism
          metadata: { department: dept, level: 3 },
        };

        try {
          const response = await this.client.post('/api/accounts', payload);
          const id = response.data.data.id;
          this.generatedIds.accounts.push(id);
          this.success(`Created department: ${payload.accountName} (ID: ${id})`);
        } catch (error) {
          this.error(`Failed to create department: ${payload.accountName}`, error);
        }
      }
    }

    // ── 30 standalone SMB / Startup accounts ──────────────────────────────────
    const startupNames = [
      'TechStart Inc', 'MidMarket Solutions', 'LaunchPad Corp', 'ScaleUp Ventures',
      'DataFlow Technologies', 'NextGen Software', 'InnovateTech', 'BrightSpark Labs',
      'Agile Systems', 'Catalyst Technologies', 'Ember Innovations', 'Forge Digital',
      'Surge Analytics', 'Helix Data', 'Mosaic Labs', 'Cobalt Systems',
      'Flint Technologies', 'Drift Analytics', 'Harbor Software', 'Lumen Tech',
      'Crest Innovations', 'Zenith Platforms', 'Pillar Technologies', 'Beam Analytics',
      'Core Systems', 'Spark Solutions', 'Nova Technologies', 'Arc Innovations',
      'Base Systems', 'Pixel Platforms',
    ];

    for (let i = 0; i < startupNames.length; i++) {
      const name = startupNames[i];
      const isStartup = i % 3 === 0;
      const loc = pick(US_CITIES, i + 5);
      const pt = pickPaymentTerms(i + 2);
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');

      const payload = {
        accountName: name,
        accountType: isStartup ? AccountType.STARTUP : AccountType.SMB,
        primaryContactEmail: `founder@${slug}.io`,
        billingContactEmail: `billing@${slug}.io`,
        billingAddressLine1: `${400 + i} Startup Ave`,
        billingCity: loc.city,
        billingState: loc.state,
        billingPostalCode: loc.zip,
        billingCountry: 'USA',
        paymentTerms: pt.terms,
        paymentTermsDays: pt.days,
        currency: pick(CURRENCIES, i),
        creditLimit: isStartup ? 25000 : 75000,
        creditHold: false,
        metadata: {
          stage: isStartup ? pick(['Pre-Seed', 'Seed', 'Series A', 'Series B'], i) : undefined,
          employees: 10 + i * 5,
          industry: pick(INDUSTRIES, i + 5),
        },
      };

      try {
        const response = await this.client.post('/api/accounts', payload);
        const id = response.data.data.id;
        this.generatedIds.accounts.push(id);
        this.success(`Created standalone account: ${name} (ID: ${id})`);
      } catch (error) {
        this.error(`Failed to create standalone account: ${name}`, error);
      }
    }

    this.log(`✅ Created ${this.generatedIds.accounts.length} accounts`);
  }

  // ---------------------------------------------------------------------------
  // Contracts — up to 2 per account across all accounts
  // ---------------------------------------------------------------------------

  async generateContracts() {
    this.log('📝 Generating contracts...');

    if (this.generatedIds.accounts.length === 0 || this.generatedIds.products.length === 0) {
      this.error('Cannot generate contracts: no accounts or products available', new Error());
      return;
    }

    // Only use active products (first ~100) for contract binding to avoid legacy/inactive ones
    const activeProductIds = this.generatedIds.products.slice(0, 100);

    const contractTemplates = [
      {
        billingFrequency: BillingFrequency.ANNUAL,
        contractValue: 120000,
        seatCount: 100,
        committedSeats: 100,
        seatPrice: 100,
        billingInAdvance: true,
        autoRenew: true,
        renewalNoticeDays: 90,
        paymentTerms: PaymentTerms.NET_30,
        notes: 'Enterprise annual contract with volume discount',
      },
      {
        billingFrequency: BillingFrequency.QUARTERLY,
        contractValue: 30000,
        seatCount: 50,
        committedSeats: 50,
        seatPrice: 150,
        billingInAdvance: true,
        autoRenew: true,
        renewalNoticeDays: 60,
        paymentTerms: PaymentTerms.NET_30,
        notes: 'Quarterly billing with standard terms',
      },
      {
        billingFrequency: BillingFrequency.MONTHLY,
        contractValue: 12000,
        seatCount: 20,
        committedSeats: 20,
        seatPrice: 50,
        billingInAdvance: false,
        autoRenew: false,
        renewalNoticeDays: 30,
        paymentTerms: PaymentTerms.NET_60,
        notes: 'Monthly billing in arrears',
      },
      {
        billingFrequency: BillingFrequency.SEMI_ANNUAL,
        contractValue: 60000,
        seatCount: 75,
        committedSeats: 75,
        seatPrice: 80,
        billingInAdvance: true,
        autoRenew: true,
        renewalNoticeDays: 60,
        paymentTerms: PaymentTerms.NET_30,
        notes: 'Semi-annual billing mid-market deal',
      },
      {
        billingFrequency: BillingFrequency.ANNUAL,
        contractValue: 250000,
        seatCount: 250,
        committedSeats: 250,
        seatPrice: 85,
        billingInAdvance: true,
        autoRenew: true,
        renewalNoticeDays: 90,
        paymentTerms: PaymentTerms.NET_90,
        notes: 'Large enterprise deal with extended payment terms',
      },
      {
        billingFrequency: BillingFrequency.MONTHLY,
        contractValue: 5000,
        seatCount: 10,
        committedSeats: 10,
        seatPrice: 40,
        billingInAdvance: false,
        autoRenew: false,
        renewalNoticeDays: 30,
        paymentTerms: PaymentTerms.DUE_ON_RECEIPT,
        notes: 'Small team pilot contract',
      },
    ];

    let contractCounter = 1;

    for (let i = 0; i < this.generatedIds.accounts.length; i++) {
      const accountId = this.generatedIds.accounts[i];

      // Give each account 1 or 2 contracts, cycling through templates
      const numContracts = i % 3 === 0 ? 2 : 1;

      for (let c = 0; c < numContracts; c++) {
        const template = contractTemplates[(i + c) % contractTemplates.length];

        // Stagger start dates across the last 180 days for variety
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - ((i * 7 + c * 30) % 180));

        const endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);

        // Pick 1-3 products for each contract (deterministic, no random)
        const productCount = 1 + ((i + c) % 3); // cycles 1, 2, 3
        const contractProductIds = pickSlice(activeProductIds, i + c, productCount);
        const products = contractProductIds.map((productId, j) => ({
          productId,
          quantity: 1 + j * 5, // 1, 6, 11, ...
        }));

        const contract = {
          contractNumber: `CNT-2024-${String(contractCounter).padStart(4, '0')}`,
          accountId,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          ...template,
          metadata: { generatedBy: 'data-generator', version: '2.0' },
          products,
        };

        try {
          const response = await this.client.post('/api/contracts', contract);
          const contractId = response.data.data.id;
          this.generatedIds.contracts.push(contractId);
          this.success(`Created contract: ${contract.contractNumber} for account ${accountId}`);
          contractCounter++;
        } catch (error) {
          this.error(`Failed to create contract: ${contract.contractNumber}`, error);
        }
      }
    }

    this.log(`✅ Created ${this.generatedIds.contracts.length} contracts`);
  }

  // ---------------------------------------------------------------------------
  // Clean — paginate through all records and delete every one
  // ---------------------------------------------------------------------------

  private async fetchAllIds(url: string): Promise<string[]> {
    const ids: string[] = [];
    const pageSize = 100;
    let offset = 0;

    while (true) {
      const response = await this.client.get(
        `${url}?limit[eq]=${pageSize}&offset[eq]=${offset}`,
      );
      const items: any[] = response.data.data || [];
      if (!Array.isArray(items) || items.length === 0) break;

      ids.push(...items.map((item: any) => item.id));

      // Stop when we've received fewer items than the page size
      if (items.length < pageSize) break;
      offset += pageSize;
    }

    return ids;
  }

  async clean() {
    this.log('🧹 Cleaning all existing data...');

    // Order matters: delete contracts before accounts (FK), accounts before products
    const endpoints = [
      { url: '/api/contracts', name: 'contracts' },
      { url: '/api/accounts', name: 'accounts' },
      { url: '/api/products', name: 'products' },
    ];

    for (const endpoint of endpoints) {
      try {
        this.log(`Fetching all ${endpoint.name} (paginated)...`);
        const ids = await this.fetchAllIds(endpoint.url);

        if (ids.length === 0) {
          this.log(`No ${endpoint.name} found to delete`);
          continue;
        }

        this.log(`Deleting ${ids.length} ${endpoint.name}...`);

        for (const id of ids) {
          try {
            await this.client.delete(`${endpoint.url}/${id}`);
            this.success(`Deleted ${endpoint.name}: ${id}`);
          } catch (error) {
            this.error(`Failed to delete ${endpoint.name} ${id}`, error);
          }
        }

        this.success(`Cleaned all ${ids.length} ${endpoint.name}`);
      } catch (error) {
        this.error(`Failed to fetch ${endpoint.name}`, error);
      }
    }

    this.success('Data cleanup completed');
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 DATA GENERATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Products created:  ${this.generatedIds.products.length}`);
    console.log(`✅ Accounts created:  ${this.generatedIds.accounts.length}`);
    console.log(`✅ Contracts created: ${this.generatedIds.contracts.length}`);
    console.log('='.repeat(60));
    console.log('\n💡 You can now view the data at:');
    console.log(`   - Swagger UI: ${API_BASE_URL}/api/docs`);
    console.log(`   - Frontend:   http://localhost:3000`);
    console.log('\n');
  }

  async run() {
    console.log('🚀 Starting data generation...\n');
    console.log(`API Base URL: ${API_BASE_URL}`);
    console.log(`Clean first:  ${CLEAN_FIRST ? 'Yes' : 'No'}\n`);

    try {
      this.log('🏥 Checking API health...');
      await this.client.get('/health/liveness');
      this.success('API is healthy');

      if (CLEAN_FIRST) {
        await this.clean();
      }

      await this.generateProducts();
      await this.generateAccounts();
      await this.generateContracts();

      this.printSummary();
    } catch (error: any) {
      this.error('Data generation failed', error);
      process.exit(1);
    }
  }
}

const generator = new DataGenerator(API_BASE_URL);
generator.run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
