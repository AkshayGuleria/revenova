/**
 * Create Sub-Invoice Route
 * Creates a sub-invoice under a parent invoice
 */

import { useParams, useNavigate, Link } from "react-router";
import { toast } from "sonner";
import { ChevronRight, FileText } from "lucide-react";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { PageLoader } from "~/components/page-loader";
import { SubInvoiceForm } from "~/components/invoices/sub-invoice-form";
import {
  useInvoice,
  useCreateSubInvoice,
} from "~/lib/api/hooks/use-invoices";
import { ApiError } from "~/lib/api/client";
import type { CreateSubInvoiceDto, Invoice } from "~/types/models";

export default function NewSubInvoiceRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useInvoice(id!);
  const createSubInvoice = useCreateSubInvoice(id!);

  const parentInvoice = data?.data as Invoice | undefined;

  const handleSubmit = async (subInvoiceData: CreateSubInvoiceDto) => {
    try {
      const response = await createSubInvoice.mutateAsync(subInvoiceData);
      toast.success("Sub-invoice created successfully");
      navigate(`/invoices/${id}`);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.details?.validationErrors) {
          const fieldErrors = Object.entries(error.details.validationErrors)
            .map(([field, msg]) => `${field}: ${msg}`)
            .join(", ");
          toast.error(`Validation failed: ${fieldErrors}`);
        } else {
          toast.error(`Failed to create sub-invoice: ${error.message}`);
        }
      } else {
        toast.error(
          "Failed to create sub-invoice: An unexpected error occurred"
        );
      }
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <PageLoader message="Loading parent invoice..." />
      </AppShell>
    );
  }

  if (!parentInvoice) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold">Invoice not found</h2>
          <p className="text-muted-foreground mt-2">
            The parent invoice you're trying to attach to doesn't exist.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Context breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5">
        <FileText className="h-4 w-4 text-blue-500" />
        <span>Creating sub-invoice for</span>
        <Link
          to={`/invoices/${id}`}
          className="text-blue-700 font-semibold hover:underline flex items-center gap-1"
        >
          {parentInvoice.invoiceNumber}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
        <span className="font-medium text-gray-700">
          {parentInvoice.account?.accountName || parentInvoice.accountId}
        </span>
      </div>

      <PageHeader
        title="Create Sub-Invoice"
        description={`Sub-invoice under ${parentInvoice.invoiceNumber}`}
      />

      <div className="mt-6">
        <SubInvoiceForm
          parentInvoice={parentInvoice}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/invoices/${id}`)}
          isLoading={createSubInvoice.isPending}
        />
      </div>
    </AppShell>
  );
}
