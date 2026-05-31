/**
 * Generate Invoice Route
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
import { useContracts } from "~/lib/api/hooks/use-contracts";
import {
  useGenerateInvoice,
  useQueueInvoice,
} from "~/lib/api/hooks/use-billing";

const generateFormSchema = z.object({
  contractId: z.string().min(1, "Contract is required"),
  periodStart: z.string().min(1, "Billing period start is required"),
  periodEnd: z.string().min(1, "Billing period end is required"),
});

type GenerateFormData = z.infer<typeof generateFormSchema>;

export default function GenerateInvoiceRoute() {
  const navigate = useNavigate();
  const [isAsync, setIsAsync] = useState(false);

  const { data: contractsData } = useContracts({ "limit[eq]": 100 });
  const contracts = Array.isArray(contractsData?.data)
    ? contractsData.data
    : [];

  const generateInvoice = useGenerateInvoice();
  const queueInvoice = useQueueInvoice();

  const form = useForm<GenerateFormData>({
    resolver: zodResolver(generateFormSchema),
    defaultValues: {
      contractId: "",
      periodStart: new Date().toISOString().split("T")[0],
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
    },
  });

  const handleSubmit = async (data: GenerateFormData) => {
    try {
      if (isAsync) {
        // Queue invoice generation (asynchronous)
        const response = await queueInvoice.mutateAsync(data);
        toast.success("Invoice generation queued");
        navigate(`/billing/jobs/${response.data.jobId}`);
      } else {
        // Generate invoice synchronously
        const response = await generateInvoice.mutateAsync(data);
        toast.success("Invoice generated successfully");
        navigate(`/invoices/${response.data.id}`);
      }
    } catch (error) {
      toast.error("Failed to generate invoice");
      console.error(error);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Generate Invoice"
        description="Generate invoice from contract"
      />

      <div className="mt-6 max-w-2xl">
        <Card className="p-6">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="contractId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select contract" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contracts.map((contract) => (
                          <SelectItem key={contract.id} value={contract.id}>
                            {contract.contractNumber} -{" "}
                            {contract.account?.accountName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the contract to generate invoice from
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

              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
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
                    Use this for large invoices or when you don't need
                    immediate results
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
                    generateInvoice.isPending || queueInvoice.isPending
                  }
                >
                  {generateInvoice.isPending || queueInvoice.isPending
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
