/**
 * Batch Billing Route
 */

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
import { useBatchBilling } from "~/lib/api/hooks/use-billing";
import { BillingFrequency } from "~/types/models";
import { AlertCircle } from "lucide-react";

const batchFormSchema = z.object({
  billingDate: z.string().optional(),
  billingPeriod: z.nativeEnum(BillingFrequency).optional(),
});

type BatchFormData = z.infer<typeof batchFormSchema>;

export default function BatchBillingRoute() {
  const navigate = useNavigate();
  const batchBilling = useBatchBilling();

  const form = useForm<BatchFormData>({
    resolver: zodResolver(batchFormSchema),
    defaultValues: {
      billingDate: new Date().toISOString().split("T")[0],
      billingPeriod: undefined,
    },
  });

  const handleSubmit = async (data: BatchFormData) => {
    try {
      const response = await batchBilling.mutateAsync(data);
      toast.success("Batch billing job queued");
      navigate(`/billing/jobs/${response.data.jobId}`);
    } catch (error) {
      toast.error("Failed to queue batch billing");
      console.error(error);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Batch Billing"
        description="Generate invoices for multiple contracts"
      />

      <div className="mt-6 max-w-2xl">
        <Card className="p-6">
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Asynchronous Processing</p>
              <p>
                Batch billing is always processed asynchronously. You'll be
                redirected to the job status page to track progress.
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
                name="billingDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing Date (Optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>
                      Date to use for billing (defaults to today)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="billingPeriod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing Period (Optional)</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "all" ? undefined : value)}
                      defaultValue={field.value || "all"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="All periods" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">All periods</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Filter contracts by billing period (default: all)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/billing")}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={batchBilling.isPending}>
                  {batchBilling.isPending
                    ? "Queueing..."
                    : "Queue Batch Billing"}
                </Button>
              </div>
            </form>
          </Form>
        </Card>
      </div>
    </AppShell>
  );
}
