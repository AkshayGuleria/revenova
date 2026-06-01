import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // Dashboard
  index("routes/_index.tsx"),

  // Accounts
  route("accounts", "routes/accounts._index.tsx"),
  route("accounts/new", "routes/accounts.new.tsx"),
  route("accounts/:id", "routes/accounts.$id.tsx"),
  route("accounts/:id/edit", "routes/accounts.$id.edit.tsx"),

  // Contracts
  route("contracts", "routes/contracts._index.tsx"),
  route("contracts/new", "routes/contracts.new.tsx"),
  route("contracts/:id", "routes/contracts.$id.tsx"),
  route("contracts/:id/edit", "routes/contracts.$id.edit.tsx"),

  // Products
  route("products", "routes/products._index.tsx"),
  route("products/new", "routes/products.new.tsx"),
  route("products/:id", "routes/products.$id.tsx"),
  route("products/:id/edit", "routes/products.$id.edit.tsx"),

  // Invoices
  route("invoices", "routes/invoices._index.tsx"),
  route("invoices/new", "routes/invoices.new.tsx"),
  route("invoices/:id", "routes/invoices.$id.tsx"),
  route("invoices/:id/edit", "routes/invoices.$id.edit.tsx"),
  route("invoices/:id/sub-invoices/new", "routes/invoices.$id.sub-invoices.new.tsx"),

  // Invoice Groups
  route("invoice-groups", "routes/invoice-groups._index.tsx"),
  route("invoice-groups/new", "routes/invoice-groups.new.tsx"),
  route("invoice-groups/:id/edit", "routes/invoice-groups.$id.edit.tsx"),

  // Billing
  route("billing", "routes/billing._index.tsx"),
  route("billing/generate", "routes/billing.generate.tsx"),
  route("billing/batch", "routes/billing.batch.tsx"),
  route("billing/consolidated", "routes/billing.consolidated.tsx"),
  route("billing/jobs/:jobId", "routes/billing.jobs.$jobId.tsx"),

  // Purchase Orders (Phase 4)
  route("purchase-orders", "routes/purchase-orders._index.tsx"),
  route("purchase-orders/new", "routes/purchase-orders.new.tsx"),
  route("purchase-orders/:id", "routes/purchase-orders.$id.tsx"),

  // Payments (Phase 4)
  route("payments", "routes/payments._index.tsx"),
  route("payments/new", "routes/payments.new.tsx"),

  // Analytics (Phase 5)
  route("analytics", "routes/analytics._index.tsx"),

  // Renewals (Phase 5)
  route("renewals", "routes/renewals._index.tsx"),
] satisfies RouteConfig;
