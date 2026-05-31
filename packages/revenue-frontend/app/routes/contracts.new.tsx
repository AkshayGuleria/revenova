/**
 * Create Contract Route
 */

import { useNavigate } from "react-router";
import { toast } from "sonner";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { Card, CardContent } from "~/components/ui/card";
import { ContractForm } from "~/components/contracts/contract-form";
import { useCreateContract } from "~/lib/api/hooks/use-contracts";
import type { CreateContractDto, UpdateContractDto } from "~/types/models";

export default function CreateContractRoute() {
  const navigate = useNavigate();
  const createMutation = useCreateContract();

  const handleSubmit = async (data: CreateContractDto | UpdateContractDto) => {
    try {
      await createMutation.mutateAsync(data as CreateContractDto);
      toast.success("Contract created successfully");
      navigate("/contracts");
    } catch (error: any) {
      toast.error(error.message || "Failed to create contract");
    }
  };

  const handleCancel = () => {
    navigate("/contracts");
  };

  return (
    <AppShell>
      <PageHeader
        title="Create Contract"
        description="Create a new contract with billing configuration"
      />

      <Card className="mt-6">
        <CardContent className="pt-6">
          <ContractForm
            mode="create"
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={createMutation.isPending}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
