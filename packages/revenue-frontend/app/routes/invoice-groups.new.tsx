/**
 * Create Invoice Group Route
 */

import { useNavigate } from "react-router";
import { toast } from "sonner";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { InvoiceGroupForm } from "~/components/invoice-groups/invoice-group-form";
import { useCreateInvoiceGroup } from "~/lib/api/hooks/use-invoice-groups";
import { ApiError } from "~/lib/api/client";
import type { CreateInvoiceGroupDto } from "~/types/models";

export default function NewInvoiceGroupRoute() {
  const navigate = useNavigate();
  const createGroup = useCreateInvoiceGroup();

  const handleSubmit = async (data: CreateInvoiceGroupDto) => {
    try {
      await createGroup.mutateAsync(data);
      toast.success("Invoice group created successfully");
      navigate("/invoice-groups");
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.details?.validationErrors) {
          const fieldErrors = Object.entries(error.details.validationErrors)
            .map(([field, msg]) => `${field}: ${msg}`)
            .join(", ");
          toast.error(`Validation failed: ${fieldErrors}`);
        } else {
          toast.error(`Failed to create group: ${error.message}`);
        }
      } else {
        toast.error("Failed to create group: An unexpected error occurred");
      }
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Create Invoice Group"
        description="Create a new group to organize invoices"
      />

      <div className="mt-6">
        <InvoiceGroupForm
          onSubmit={handleSubmit as any}
          onCancel={() => navigate("/invoice-groups")}
          isLoading={createGroup.isPending}
        />
      </div>
    </AppShell>
  );
}
