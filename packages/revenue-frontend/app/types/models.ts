/**
 * Domain Models - Entity Types
 * Matches backend Prisma schema and DTOs
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum AccountType {
  ENTERPRISE = "enterprise",
  SMB = "smb",
  STARTUP = "startup",
}

export enum AccountStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  SUSPENDED = "suspended",
}

export enum ContractStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  EXPIRED = "expired",
  CANCELLED = "cancelled",
  RENEWED = "renewed",
}

export enum BillingFrequency {
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  SEMI_ANNUAL = "semi_annual",
  ANNUAL = "annual",
}

export enum InvoiceStatus {
  DRAFT = "draft",
  SENT = "sent",
  PAID = "paid",
  OVERDUE = "overdue",
  CANCELLED = "cancelled",
  VOID = "void",
}

export enum BillingType {
  RECURRING = "recurring",
  ONE_TIME = "one_time",
}

export enum PaymentTerms {
  NET_30 = "net_30",
  NET_60 = "net_60",
  NET_90 = "net_90",
  DUE_ON_RECEIPT = "due_on_receipt",
}

export enum PricingModel {
  SEAT_BASED = "seat_based",
  FLAT_FEE = "flat_fee",
  VOLUME_TIERED = "volume_tiered",
  CUSTOM = "custom",
}

export enum BillingInterval {
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  SEMI_ANNUAL = "semi_annual",
  ANNUAL = "annual",
}

export enum ChargeType {
  RECURRING = "recurring",
  ONE_TIME = "one_time",
  USAGE_BASED = "usage_based", // Phase 6 — field added, billing logic deferred
}

export enum ProductCategory {
  PLATFORM = "platform",
  SEATS = "seats",
  ADDON = "addon",
  SUPPORT = "support",
  PROFESSIONAL_SERVICES = "professional_services",
  STORAGE = "storage", // Phase 6
  API = "api", // Phase 6
}

// ============================================================================
// ACCOUNT TYPES
// ============================================================================

export interface Account {
  id: string;
  accountName: string;
  primaryContactEmail: string;
  accountType: AccountType;
  status: AccountStatus;

  // Billing contact information
  billingContactName?: string;
  billingContactEmail?: string;
  billingContactPhone?: string;

  // Billing address
  billingAddressLine1?: string;
  billingAddressLine2?: string;
  billingCity?: string;
  billingState?: string;
  billingPostalCode?: string;
  billingCountry?: string;

  // Financial terms
  paymentTerms: PaymentTerms;
  currency: string;
  taxId?: string;
  creditLimit?: number;

  // Hierarchy (Phase 3)
  parentAccountId?: string;
  parent?: Account;
  children?: Account[];

  // Metadata
  metadata?: Record<string, any>;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface AccountHierarchyNode {
  id: string;
  accountName: string;
  accountType: AccountType;
  depth: number;
  children: AccountHierarchyNode[];
}

// ============================================================================
// CONTRACT TYPES
// ============================================================================

export interface ContractProduct {
  id: string;
  contractId: string;
  productId: string;
  quantity: number;
  unitPrice?: number | null;
  discount?: number | null;
  billingInterval?: string | null;
  createdAt: string;
  updatedAt: string;
  product?: Product;
}

export interface CreateContractProductDto {
  productId: string;
  quantity?: number;
  unitPrice?: number;
  discount?: number;
  billingInterval?: string;
}

export interface Contract {
  id: string;
  contractNumber: string;
  accountId: string;
  account?: Account;

  // Contract dates
  startDate: string;
  endDate: string;

  // Financial terms
  contractValue: number;
  billingFrequency: BillingFrequency;
  paymentTerms: PaymentTerms;
  billingInAdvance: boolean;

  // Seat-based pricing
  seatCount?: number;
  committedSeats?: number;
  seatPrice?: number;

  // Renewal
  autoRenew: boolean;
  renewalNoticeDays: number;

  // Status
  status: ContractStatus;

  // Metadata
  notes?: string;
  metadata?: Record<string, any>;

  // Relations
  invoices?: Invoice[];
  products?: ContractProduct[];
  _count?: {
    invoices: number;
  };

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface ContractShare {
  id: string;
  contractId: string;
  accountId: string;
  account?: Account;
  notes?: string;
  createdAt: string;
}

// ============================================================================
// PRODUCT TYPES
// ============================================================================

export interface VolumeTier {
  minQuantity: number;
  maxQuantity?: number;
  unitPrice: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  sku?: string;

  // Pricing
  pricingModel: PricingModel;
  basePrice?: number;
  currency: string;

  // Charge type & category (Phase 3.5)
  chargeType: ChargeType;
  category: ProductCategory;

  // Seat-based options
  minSeats?: number;
  maxSeats?: number;
  seatIncrement?: number;

  // Volume tiers
  volumeTiers?: VolumeTier[];

  // Configuration
  billingInterval?: BillingInterval;

  // Subscription & commitment fields (Phase 3.5)
  setupFee?: number;
  trialPeriodDays?: number;
  minCommitmentMonths?: number;

  active: boolean;
  isAddon: boolean;

  // Metadata
  metadata?: Record<string, any>;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// INVOICE GROUP TYPES
// ============================================================================

export enum InvoiceGroupType {
  DEPARTMENT = 'DEPARTMENT',
  COST_CENTER = 'COST_CENTER',
  LOCATION = 'LOCATION',
  CUSTOM = 'CUSTOM',
}

export interface InvoiceGroup {
  id: string;
  accountId: string;
  account?: Pick<Account, 'id' | 'accountName'>;
  name: string;
  groupType: InvoiceGroupType;
  code?: string;
  metadata?: Record<string, any>;
  _count?: { invoices: number };
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceGroupDto {
  accountId: string;
  name: string;
  groupType: InvoiceGroupType;
  code?: string;
  metadata?: Record<string, any>;
}

export interface UpdateInvoiceGroupDto {
  name?: string;
  code?: string;
  metadata?: Record<string, any>;
}

export interface CreateSubInvoiceDto {
  invoiceGroupId?: string;
  contractId?: string;
  issueDate?: string;
  dueDate?: string;
  periodStart?: string;
  periodEnd?: string;
  subtotal: number;
  tax?: number;
  discount?: number;
  total: number;
  currency?: string;
  status?: string;
  notes?: string;
  items?: any[];
  metadata?: Record<string, any>;
}

// ============================================================================
// INVOICE TYPES
// ============================================================================

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  periodStart?: string | null;
  periodEnd?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  accountId: string;
  account?: Account;
  contractId?: string;
  contract?: Contract;

  // Dates
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  periodStart?: string;
  periodEnd?: string;

  // Amounts
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paidAmount: number;
  currency: string;

  // Status
  status: InvoiceStatus;
  billingType: BillingType;

  // Purchase order
  purchaseOrderNumber?: string;

  // Consolidated billing (Phase 3)
  consolidated: boolean;
  parentInvoiceId?: string;

  // Invoice Groups & Sub-Invoices
  invoiceGroupId?: string;
  invoiceGroup?: Pick<InvoiceGroup, 'id' | 'name' | 'groupType' | 'code'>;
  subInvoiceCount?: number;
  subInvoiceTotals?: { total: string; paid: string; outstanding: string } | null;

  // Notes
  notes?: string;
  internalNotes?: string;

  // Metadata
  metadata?: Record<string, any>;

  // Relations
  items?: InvoiceItem[];
  _count?: {
    items: number;
  };

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// BILLING JOB TYPES
// ============================================================================

export interface BillingJob {
  id: string;
  type?: string;
  data?: any;
  status: "queued" | "active" | "completed" | "failed";
  progress?: number;
  result?: any;
  error?: string;
  attemptsMade?: number;
  maxAttempts?: number;
  createdAt: string;
  processedAt?: string;
  finishedAt?: string;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

// ============================================================================
// FORM DTOs (Create/Update operations)
// ============================================================================

export interface CreateAccountDto {
  accountName: string;
  primaryContactEmail: string;
  accountType: AccountType;
  parentAccountId?: string;

  billingContactName?: string;
  billingContactEmail?: string;
  billingContactPhone?: string;

  billingAddressLine1?: string;
  billingAddressLine2?: string;
  billingCity?: string;
  billingState?: string;
  billingPostalCode?: string;
  billingCountry?: string;

  paymentTerms?: PaymentTerms;
  currency?: string;
  taxId?: string;
  creditLimit?: number;

  metadata?: Record<string, any>;
}

export interface UpdateAccountDto extends Partial<CreateAccountDto> {
  status?: AccountStatus;
}

export interface CreateContractDto {
  contractNumber: string;
  accountId: string;
  startDate: string;
  endDate: string;
  contractValue: number;
  billingFrequency?: BillingFrequency;
  paymentTerms?: PaymentTerms;
  billingInAdvance?: boolean;
  seatCount?: number;
  committedSeats?: number;
  seatPrice?: number;
  autoRenew?: boolean;
  renewalNoticeDays?: number;
  notes?: string;
  metadata?: Record<string, any>;
  products: CreateContractProductDto[];
}

export interface UpdateContractDto extends Partial<CreateContractDto> {
  status?: ContractStatus;
}

export interface CreateProductDto {
  name: string;
  description?: string;
  sku?: string;
  pricingModel: PricingModel;
  basePrice?: number;
  currency?: string;
  chargeType?: ChargeType;
  category?: ProductCategory;
  setupFee?: number;
  trialPeriodDays?: number;
  minCommitmentMonths?: number;
  minSeats?: number;
  maxSeats?: number;
  seatIncrement?: number;
  volumeTiers?: VolumeTier[];
  billingInterval?: BillingInterval;
  active?: boolean;
  isAddon?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateProductDto extends Partial<CreateProductDto> {}

export interface CreateInvoiceDto {
  invoiceNumber: string;
  accountId: string;
  contractId: string;
  issueDate: string;
  dueDate: string;
  tax?: number;
  discount?: number;
  currency?: string;
  status?: InvoiceStatus;
  billingType?: BillingType;
  invoiceGroupId?: string;
  parentInvoiceId?: string;
  notes?: string;
  internalNotes?: string;
  metadata?: Record<string, any>;
}

export interface UpdateInvoiceDto {
  contractId?: string;
  issueDate?: string;
  dueDate?: string;
  status?: InvoiceStatus;
  currency?: string;
  notes?: string;
  internalNotes?: string;
  subtotal?: number;
  tax?: number;
  discount?: number;
  total?: number;
  paidAmount?: number;
  paidDate?: string;
  metadata?: Record<string, any>;
}

export interface CreateInvoiceItemDto {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  metadata?: Record<string, any>;
}

export interface GenerateInvoiceDto {
  contractId: string;
  periodStart?: string;
  periodEnd?: string;
  billingPeriod?: BillingFrequency;
}

export interface BatchGenerateInvoicesDto {
  billingDate?: string;
  billingPeriod?: BillingFrequency;
}

export interface GenerateConsolidatedInvoiceDto {
  parentAccountId: string;
  periodStart: string;
  periodEnd: string;
  includeChildren?: boolean;
}

export interface ShareContractDto {
  accountId: string;
  notes?: string;
}

// ── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string | null;
  actorType: string;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// ── Webhooks ─────────────────────────────────────────────────────────────────

export interface WebhookEndpoint {
  id: string;
  accountId: string;
  account?: { accountName: string };
  url: string;
  events: string[];
  active: boolean;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  status: string;
  responseStatus: number | null;
  responseBody: string | null;
  attemptCount: number;
  lastAttemptAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface CreateWebhookDto {
  accountId: string;
  url: string;
  events: string[];
  description?: string;
}
