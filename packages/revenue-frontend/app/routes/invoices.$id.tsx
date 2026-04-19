/**
 * Invoice Details Route
 */

import { useParams, useNavigate, Link } from "react-router";
import { format } from "date-fns";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { StatusBadge } from "~/components/status-badge";
import { DateDisplay } from "~/components/date-display";
import { CurrencyDisplay } from "~/components/currency-display";
import { DataTable, type Column } from "~/components/data-table";
import {
  useInvoice,
  useSubInvoices,
} from "~/lib/api/hooks/use-invoices";
import {
  Edit,
  FileText,
  Send,
  ChevronRight,
  Plus,
  Layers,
} from "lucide-react";
import type { InvoiceItem, Invoice } from "~/types/models";
import { InvoiceGroupType } from "~/types/models";
import { useConfigStore } from "~/lib/stores/config-store";

const STATUS_COLOR_MAP: Record<
  string,
  "green" | "gray" | "yellow" | "red" | "blue"
> = {
  draft: "gray",
  sent: "blue",
  paid: "green",
  overdue: "red",
  cancelled: "gray",
  void: "gray",
};

const GROUP_TYPE_LABELS: Record<InvoiceGroupType, string> = {
  [InvoiceGroupType.DEPARTMENT]: "Department",
  [InvoiceGroupType.COST_CENTER]: "Cost Center",
  [InvoiceGroupType.LOCATION]: "Location",
  [InvoiceGroupType.CUSTOM]: "Custom",
};

export default function InvoiceDetailsRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useInvoice(id!);
  const { defaultCurrency } = useConfigStore();

  const invoice = data?.data;

  const isParent = (invoice?.subInvoiceCount ?? 0) > 0;
  const isSubInvoice = !!invoice?.parentInvoiceId;

  // Sub-invoices query — only runs when this is a parent invoice
  const { data: subInvoicesData, isLoading: subInvoicesLoading } =
    useSubInvoices(id!, undefined);

  const lineItemColumns: Column<InvoiceItem>[] = [
    {
      key: "description",
      header: "Description",
      cell: (item) => (
        <div>
          <div className="font-medium">{item.description}</div>
          {(item as any).productId && (
            <div className="text-sm text-gray-500">
              Product ID: {(item as any).productId}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "quantity",
      header: "Quantity",
      cell: (item) => item.quantity,
    },
    {
      key: "unitPrice",
      header: "Unit Price",
      cell: (item) => (
        <CurrencyDisplay
          amount={item.unitPrice}
          currency={invoice?.currency || defaultCurrency}
        />
      ),
    },
    {
      key: "discount",
      header: "Discount",
      cell: (item) =>
        (item as any).discountAmount ? (
          <CurrencyDisplay
            amount={(item as any).discountAmount}
            currency={invoice?.currency || defaultCurrency}
          />
        ) : (
          "-"
        ),
    },
    {
      key: "tax",
      header: "Tax",
      cell: (item) =>
        (item as any).taxAmount ? (
          <CurrencyDisplay
            amount={(item as any).taxAmount}
            currency={invoice?.currency || defaultCurrency}
          />
        ) : (
          "-"
        ),
    },
    {
      key: "billingPeriod",
      header: "Billing Period",
      cell: (item) => {
        const start = item.periodStart;
        const end = item.periodEnd;
        if (!start && !end) return <span className="text-gray-400">—</span>;
        const fmt = (d: string) => format(new Date(d), "MMM d, yyyy");
        return (
          <span className="text-sm tabular-nums">
            {start ? fmt(start) : "?"} – {end ? fmt(end) : "?"}
          </span>
        );
      },
    },
    {
      key: "lineTotal",
      header: "Line Total",
      cell: (item) => (
        <CurrencyDisplay
          amount={(item as any).lineTotal ?? item.amount}
          currency={invoice?.currency || defaultCurrency}
        />
      ),
    },
  ];

  const subInvoiceColumns: Column<Invoice>[] = [
    {
      key: "invoiceNumber",
      header: "Invoice #",
      cell: (sub) => (
        <Link
          to={`/invoices/${sub.id}`}
          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          {sub.invoiceNumber}
        </Link>
      ),
    },
    {
      key: "group",
      header: "Group",
      cell: (sub) =>
        sub.invoiceGroup ? (
          <StatusBadge
            status={
              GROUP_TYPE_LABELS[sub.invoiceGroup.groupType] ??
              sub.invoiceGroup.groupType
            }
            color="blue"
          />
        ) : (
          <span className="text-gray-400 text-sm">—</span>
        ),
    },
    {
      key: "issueDate",
      header: "Issue Date",
      cell: (sub) => <DateDisplay date={sub.issueDate} />,
    },
    {
      key: "total",
      header: "Total",
      cell: (sub) => (
        <CurrencyDisplay amount={sub.total} currency={sub.currency} />
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (sub) => (
        <StatusBadge
          status={sub.status}
          color={STATUS_COLOR_MAP[sub.status] ?? "gray"}
        />
      ),
    },
  ];

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading invoice...</div>
        </div>
      </AppShell>
    );
  }

  if (!invoice) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Invoice not found</div>
        </div>
      </AppShell>
    );
  }

  const subInvoices = Array.isArray(subInvoicesData?.data)
    ? subInvoicesData.data
    : [];

  return (
    <AppShell>
      {/* Parent breadcrumb bar — shown when this is a sub-invoice */}
      {isSubInvoice && (
        <div className="mb-4 flex items-center gap-3 text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5">
          <span className="text-blue-500 font-medium">Sub-invoice of</span>
          <Link
            to={`/invoices/${invoice.parentInvoiceId}`}
            className="text-blue-700 font-semibold hover:underline flex items-center gap-1"
          >
            <FileText className="h-3.5 w-3.5" />
            {invoice.parentInvoiceId}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
          {invoice.invoiceGroup && (
            <>
              <span className="text-gray-400">|</span>
              <span className="text-gray-600">
                Grouped under:
              </span>
              <StatusBadge
                status={`${invoice.invoiceGroup.name} (${
                  GROUP_TYPE_LABELS[invoice.invoiceGroup.groupType] ??
                  invoice.invoiceGroup.groupType
                })`}
                color="blue"
              />
            </>
          )}
        </div>
      )}

      <PageHeader
        title={`Invoice ${invoice.invoiceNumber}`}
        description={`Issued on ${new Date(invoice.issueDate).toLocaleDateString()}`}
        actions={
          <div className="flex gap-3">
            <Link to={`/invoices/${id}/edit`}>
              <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
            <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900">
              <FileText className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
            {invoice.status === "draft" && (
              <Button className="hover:scale-105 active:scale-95 transition-transform duration-200">
                <Send className="mr-2 h-4 w-4" />
                Send Invoice
              </Button>
            )}
          </div>
        }
      />

      <div className="mt-6 space-y-6">
        {/* Invoice Header */}
        <Card className="p-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Bill To
              </h3>
              <div className="space-y-1">
                <Link
                  to={`/accounts/${invoice.accountId}`}
                  className="text-lg font-semibold hover:underline"
                >
                  {invoice.account?.accountName || invoice.accountId}
                </Link>
                {invoice.account?.primaryContactEmail && (
                  <p className="text-sm text-gray-600">
                    {invoice.account.primaryContactEmail}
                  </p>
                )}
                {(invoice as any).billingAddress && (
                  <p className="text-sm text-gray-600 whitespace-pre-line">
                    {(invoice as any).billingAddress}
                  </p>
                )}
              </div>

              {/* Invoice Group badge in header */}
              {invoice.invoiceGroup && (
                <div className="mt-3 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-gray-400" />
                  <StatusBadge
                    status={`${invoice.invoiceGroup.name}${invoice.invoiceGroup.code ? ` · ${invoice.invoiceGroup.code}` : ""}`}
                    color="blue"
                  />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-sm font-medium text-gray-500">
                  Status:
                </span>
                <div className="mt-1">
                  <StatusBadge
                    status={invoice.status}
                    color={STATUS_COLOR_MAP[invoice.status]}
                  />
                </div>
              </div>

              {invoice.contractId && (
                <div>
                  <span className="text-sm font-medium text-gray-500">
                    Contract:
                  </span>
                  <div className="mt-1">
                    <Link
                      to={`/contracts/${invoice.contractId}`}
                      className="text-sm hover:underline"
                    >
                      {invoice.contractId}
                    </Link>
                  </div>
                </div>
              )}

              <div>
                <span className="text-sm font-medium text-gray-500">
                  Issue Date:
                </span>
                <div className="mt-1">
                  <DateDisplay date={invoice.issueDate} />
                </div>
              </div>

              <div>
                <span className="text-sm font-medium text-gray-500">
                  Due Date:
                </span>
                <div className="mt-1">
                  <DateDisplay date={invoice.dueDate} />
                </div>
              </div>

              {invoice.paidDate && (
                <div>
                  <span className="text-sm font-medium text-gray-500">
                    Paid Date:
                  </span>
                  <div className="mt-1">
                    <DateDisplay date={invoice.paidDate} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {invoice.notes && (
            <>
              <Separator className="my-4" />
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  Notes
                </h3>
                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {invoice.notes}
                </p>
              </div>
            </>
          )}
        </Card>

        {/* Line Items */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Line Items</h3>
          <DataTable
            columns={lineItemColumns}
            data={invoice.items || []}
            isLoading={false}
            emptyState={
              <div className="text-center py-8 text-gray-500">
                No line items
              </div>
            }
          />
        </Card>

        {/* Invoice Totals */}
        <Card className="p-6">
          <div className="max-w-md ml-auto space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <CurrencyDisplay
                amount={invoice.subtotal}
                currency={invoice.currency}
              />
            </div>

            {((invoice as any).discountAmount ?? invoice.discount ?? 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Discount:</span>
                <span className="text-green-600">
                  -
                  <CurrencyDisplay
                    amount={
                      (invoice as any).discountAmount ?? invoice.discount ?? 0
                    }
                    currency={invoice.currency}
                  />
                </span>
              </div>
            )}

            {((invoice as any).taxAmount ?? invoice.tax ?? 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax:</span>
                <CurrencyDisplay
                  amount={(invoice as any).taxAmount ?? invoice.tax ?? 0}
                  currency={invoice.currency}
                />
              </div>
            )}

            <Separator />

            <div className="flex justify-between text-lg font-semibold">
              <span>Total:</span>
              <CurrencyDisplay
                amount={invoice.total}
                currency={invoice.currency}
              />
            </div>

            {((invoice as any).amountPaid ?? invoice.paidAmount ?? 0) > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Amount Paid:</span>
                  <span className="text-green-600">
                    <CurrencyDisplay
                      amount={
                        (invoice as any).amountPaid ?? invoice.paidAmount ?? 0
                      }
                      currency={invoice.currency}
                    />
                  </span>
                </div>

                <div className="flex justify-between text-lg font-semibold">
                  <span>Balance Due:</span>
                  <CurrencyDisplay
                    amount={
                      invoice.total -
                      ((invoice as any).amountPaid ?? invoice.paidAmount ?? 0)
                    }
                    currency={invoice.currency}
                  />
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Sub-Invoices card — shown when this is a parent invoice */}
        {isParent && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">
                  Sub-Invoices
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({invoice.subInvoiceCount})
                  </span>
                </h3>
                {invoice.subInvoiceTotals && (
                  <div className="flex gap-6 mt-2 text-sm text-gray-600">
                    <span>
                      Total:{" "}
                      <span className="font-semibold text-gray-900">
                        {invoice.subInvoiceTotals.total}
                      </span>
                    </span>
                    <span>
                      Paid:{" "}
                      <span className="font-semibold text-green-700">
                        {invoice.subInvoiceTotals.paid}
                      </span>
                    </span>
                    <span>
                      Outstanding:{" "}
                      <span className="font-semibold text-orange-700">
                        {invoice.subInvoiceTotals.outstanding}
                      </span>
                    </span>
                  </div>
                )}
              </div>
              <Link to={`/invoices/${id}/sub-invoices/new`}>
                <Button size="sm" className="hover:scale-105 active:scale-95 transition-transform duration-200">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Sub-Invoice
                </Button>
              </Link>
            </div>

            <DataTable
              columns={subInvoiceColumns}
              data={subInvoices}
              isLoading={subInvoicesLoading}
              emptyState={
                <div className="text-center py-8 text-gray-500">
                  No sub-invoices yet
                </div>
              }
            />
          </Card>
        )}

        {/* Payment History */}
        {((invoice as any).amountPaid ?? invoice.paidAmount ?? 0) > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Payment History</h3>
            <div className="text-sm text-gray-500">
              Payment tracking coming in Phase 4
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
