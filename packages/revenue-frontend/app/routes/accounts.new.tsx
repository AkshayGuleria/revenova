/**
 * Create Account Route
 * Form for creating a new account
 */

import { useNavigate } from "react-router";
import { toast } from "sonner";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { Card, CardContent } from "~/components/ui/card";
import { AccountForm } from "~/components/accounts/account-form";
import { useCreateAccount } from "~/lib/api/hooks/use-accounts";
import type { CreateAccountDto, UpdateAccountDto } from "~/types/models";

export default function CreateAccountRoute() {
  const navigate = useNavigate();
  const createMutation = useCreateAccount();

  const handleSubmit = async (data: CreateAccountDto | UpdateAccountDto) => {
    try {
      await createMutation.mutateAsync(data as CreateAccountDto);
      toast.success("Account created successfully");
      navigate("/accounts");
    } catch (error: any) {
      toast.error(error.message || "Failed to create account");
    }
  };

  const handleCancel = () => {
    navigate("/accounts");
  };

  return (
    <AppShell>
      <PageHeader title="Create Account" description="Add a new enterprise account to your system" />

      <Card className="mt-6">
        <CardContent className="pt-6">
          <AccountForm
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
