/**
 * Create Invoice Route
 */

import { useNavigate } from "react-router";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { InvoiceForm } from "~/components/invoices/invoice-form";
import { useCreateInvoice } from "~/lib/api/hooks/use-invoices";
import { ApiError } from "~/lib/api/client";
import { toast } from "sonner";
import type { CreateInvoiceDto, UpdateInvoiceDto } from "~/types/models";

export default function NewInvoiceRoute() {
  const navigate = useNavigate();
  const createInvoice = useCreateInvoice();

  const handleSubmit = async (data: CreateInvoiceDto | UpdateInvoiceDto) => {
    try {
      const response = await createInvoice.mutateAsync(data as CreateInvoiceDto);
      toast.success("Invoice created successfully");
      navigate(`/invoices/${response.data.id}`);
    } catch (error) {
      // Extract specific error information from ApiError
      if (error instanceof ApiError) {
        // Show specific validation errors if present
        if (error.details?.validationErrors) {
          const fieldErrors = Object.entries(error.details.validationErrors)
            .map(([field, msg]) => `${field}: ${msg}`)
            .join(", ");
          toast.error(`Validation failed: ${fieldErrors}`);
        } else {
          toast.error(`Failed to create invoice: ${error.message}`);
        }

        // Log with full context for debugging
        console.error("[Invoice Creation Failed]", {
          statusCode: error.statusCode,
          code: error.code,
          message: error.message,
          details: error.details,
        });
      } else {
        toast.error("Failed to create invoice: An unexpected error occurred");
        console.error("[Invoice Creation - Unexpected Error]", error);
      }
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Create Invoice"
        description="Create a new invoice manually"
      />

      <div className="mt-6">
        <InvoiceForm
          onSubmit={handleSubmit}
          onCancel={() => navigate("/invoices")}
          isLoading={createInvoice.isPending}
        />
      </div>
    </AppShell>
  );
}
