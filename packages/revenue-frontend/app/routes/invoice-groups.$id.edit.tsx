/**
 * Edit Invoice Group Route
 */

import { useParams, useNavigate } from "react-router";
import { toast } from "sonner";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { PageLoader } from "~/components/page-loader";
import { InvoiceGroupForm } from "~/components/invoice-groups/invoice-group-form";
import {
  useInvoiceGroup,
  useUpdateInvoiceGroup,
} from "~/lib/api/hooks/use-invoice-groups";
import { ApiError } from "~/lib/api/client";
import type { UpdateInvoiceGroupDto, InvoiceGroup } from "~/types/models";

export default function EditInvoiceGroupRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useInvoiceGroup(id!);
  const updateGroup = useUpdateInvoiceGroup(id!);

  const group = data?.data as InvoiceGroup | undefined;

  const handleSubmit = async (data: UpdateInvoiceGroupDto) => {
    try {
      await updateGroup.mutateAsync(data);
      toast.success("Invoice group updated successfully");
      navigate("/invoice-groups");
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(`Failed to update group: ${error.message}`);
      } else {
        toast.error("Failed to update group: An unexpected error occurred");
      }
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <PageLoader message="Loading group..." />
      </AppShell>
    );
  }

  if (!group) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold">Group not found</h2>
          <p className="text-muted-foreground mt-2">
            The invoice group you're trying to edit doesn't exist.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Edit Invoice Group"
        description={`Editing "${group.name}"`}
      />

      <div className="mt-6">
        <InvoiceGroupForm
          group={group}
          onSubmit={handleSubmit as any}
          onCancel={() => navigate("/invoice-groups")}
          isLoading={updateGroup.isPending}
        />
      </div>
    </AppShell>
  );
}
