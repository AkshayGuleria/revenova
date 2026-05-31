/**
 * Consolidated Billing Route (Phase 3)
 */

import { useState } from "react";
import { useNavigate } from "react-router";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "~/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { toast } from "sonner";
import { useAccounts } from "~/lib/api/hooks/use-accounts";
import {
  useGenerateConsolidatedInvoice,
  useQueueConsolidatedInvoice,
} from "~/lib/api/hooks/use-billing";
import { Layers } from "lucide-react";

const consolidatedFormSchema = z.object({
  parentAccountId: z.string().min(1, "Parent account is required"),
  periodStart: z.string().min(1, "Billing period start is required"),
  periodEnd: z.string().min(1, "Billing period end is required"),
  includeChildren: z.boolean(),
});

type ConsolidatedFormData = z.infer<typeof consolidatedFormSchema>;

export default function ConsolidatedBillingRoute() {
  const navigate = useNavigate();
  const [isAsync, setIsAsync] = useState(false);

  const { data: accountsData } = useAccounts({
    "limit[eq]": 100,
  });
  const accounts = Array.isArray(accountsData?.data) ? accountsData.data : [];

  // Filter root accounts (no parent = potential parent accounts for consolidated billing)
  const parentAccounts = accounts.filter(
    (account) => !account.parentAccountId
  );

  const generateConsolidated = useGenerateConsolidatedInvoice();
  const queueConsolidated = useQueueConsolidatedInvoice();

  const form = useForm<ConsolidatedFormData>({
    resolver: zodResolver(consolidatedFormSchema),
    defaultValues: {
      parentAccountId: "",
      periodStart: new Date().toISOString().split("T")[0],
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      includeChildren: true,
    },
  });

  const handleSubmit = async (data: ConsolidatedFormData) => {
    try {
      if (isAsync) {
        // Queue consolidated invoice generation (asynchronous)
        const response = await queueConsolidated.mutateAsync(data);
        toast.success("Consolidated invoice generation queued");
        navigate(`/billing/jobs/${response.data.jobId}`);
      } else {
        // Generate consolidated invoice synchronously
        const response = await generateConsolidated.mutateAsync(data);
        toast.success("Consolidated invoice generated successfully");
        navigate(`/invoices/${response.data.id}`);
      }
    } catch (error) {
      toast.error("Failed to generate consolidated invoice");
      console.error(error);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Consolidated Billing"
        description="Generate consolidated invoice for parent account and subsidiaries"
      />

      <div className="mt-6 max-w-2xl">
        <Card className="p-6">
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3">
            <Layers className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Phase 3 Feature</p>
              <p>
                Consolidated billing aggregates all subsidiary contracts into a
                single invoice billed to the parent account.
              </p>
            </div>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="parentAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Account *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select parent account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {parentAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.accountName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the parent account to consolidate billing for
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="periodStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing Period Start *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>
                      Start date of the billing period
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="periodEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing Period End *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>
                      End date of the billing period
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="includeChildren"
                  checked={form.watch("includeChildren")}
                  onChange={(e) => form.setValue("includeChildren", e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="includeChildren" className="text-sm font-medium">
                  Include subsidiary accounts
                  <p className="text-xs text-gray-600 font-normal mt-1">
                    Include all child accounts in the consolidated invoice
                  </p>
                </label>
              </div>

              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="async"
                  checked={isAsync}
                  onChange={(e) => setIsAsync(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="async" className="text-sm font-medium">
                  Queue for asynchronous processing
                  <p className="text-xs text-gray-600 font-normal mt-1">
                    Recommended for accounts with many subsidiaries
                  </p>
                </label>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/billing")}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    generateConsolidated.isPending ||
                    queueConsolidated.isPending
                  }
                >
                  {generateConsolidated.isPending ||
                  queueConsolidated.isPending
                    ? "Generating..."
                    : isAsync
                      ? "Queue Invoice"
                      : "Generate Invoice"}
                </Button>
              </div>
            </form>
          </Form>
        </Card>
      </div>
    </AppShell>
  );
}
