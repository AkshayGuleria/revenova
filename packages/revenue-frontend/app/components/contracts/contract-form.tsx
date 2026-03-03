/**
 * Contract Form Component
 * Form for creating and editing contracts with validation
 */

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { FileText, CreditCard, Users, RefreshCw } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { Contract, CreateContractDto, UpdateContractDto } from "~/types/models";
import { ContractStatus, BillingFrequency, PaymentTerms } from "~/types/models";
import { useAccounts } from "~/lib/api/hooks/use-accounts";
import { useConfigStore } from "~/lib/stores/config-store";

// Validation schema
const contractFormSchema = z.object({
  contractNumber: z.string().min(1, "Contract number is required"),
  accountId: z.string().min(1, "Account is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  contractValue: z.coerce.number().positive("Contract value must be positive"),
  billingFrequency: z.nativeEnum(BillingFrequency).optional(),
  paymentTerms: z.nativeEnum(PaymentTerms).optional(),
  billingInAdvance: z.boolean().optional(),
  seatCount: z.coerce.number().int().positive().optional(),
  committedSeats: z.coerce.number().int().positive().optional(),
  seatPrice: z.coerce.number().positive().optional(),
  autoRenew: z.boolean().optional(),
  renewalNoticeDays: z.coerce.number().int().positive().optional(),
  status: z.nativeEnum(ContractStatus).optional(),
  notes: z.string().optional(),
});

type ContractFormValues = z.infer<typeof contractFormSchema>;

interface ContractFormProps {
  contract?: Contract;
  onSubmit: (data: CreateContractDto | UpdateContractDto) => void;
  onCancel: () => void;
  isLoading?: boolean;
  mode: "create" | "edit";
}

export function ContractForm({
  contract,
  onSubmit,
  onCancel,
  isLoading,
  mode,
}: ContractFormProps) {
  const { defaultCurrency } = useConfigStore();

  // Fetch accounts for selection
  const { data: accountsData } = useAccounts({ "limit[eq]": 100 });
  const accounts = Array.isArray(accountsData?.data) ? accountsData.data : [];

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema) as Resolver<ContractFormValues>,
    defaultValues: {
      contractNumber: contract?.contractNumber || "",
      accountId: contract?.accountId || "",
      startDate: contract?.startDate ? format(new Date(contract.startDate), "yyyy-MM-dd") : "",
      endDate: contract?.endDate ? format(new Date(contract.endDate), "yyyy-MM-dd") : "",
      contractValue: contract?.contractValue || 0,
      billingFrequency: contract?.billingFrequency || BillingFrequency.ANNUAL,
      paymentTerms: contract?.paymentTerms || PaymentTerms.NET_30,
      billingInAdvance: contract?.billingInAdvance ?? true,
      seatCount: contract?.seatCount,
      committedSeats: contract?.committedSeats,
      seatPrice: contract?.seatPrice,
      autoRenew: contract?.autoRenew ?? false,
      renewalNoticeDays: contract?.renewalNoticeDays || 90,
      status: contract?.status || ContractStatus.DRAFT,
      notes: contract?.notes || "",
    },
  });

  const handleSubmit = (values: ContractFormValues) => {
    if (mode === "create") {
      const { status, ...createData } = values;
      onSubmit(createData as CreateContractDto);
    } else {
      onSubmit(values as UpdateContractDto);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        {/* Basic Information */}
        <div className="space-y-6 p-6 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="contractNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contract Number *</FormLabel>
                  <FormControl>
                    <Input placeholder="CON-2024-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.accountName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="contractValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contract Value *</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="100000" {...field} />
                  </FormControl>
                  <FormDescription>Total contract value in {defaultCurrency}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mode === "edit" && (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={ContractStatus.DRAFT}>Draft</SelectItem>
                        <SelectItem value={ContractStatus.ACTIVE}>Active</SelectItem>
                        <SelectItem value={ContractStatus.EXPIRED}>Expired</SelectItem>
                        <SelectItem value={ContractStatus.CANCELLED}>Cancelled</SelectItem>
                        <SelectItem value={ContractStatus.RENEWED}>Renewed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        </div>

        {/* Billing Configuration */}
        <div className="space-y-6 p-6 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-green-500 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Billing Configuration</h3>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <FormField
              control={form.control}
              name="billingFrequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Billing Frequency</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={BillingFrequency.MONTHLY}>Monthly</SelectItem>
                      <SelectItem value={BillingFrequency.QUARTERLY}>Quarterly</SelectItem>
                      <SelectItem value={BillingFrequency.SEMI_ANNUAL}>Semi-Annual</SelectItem>
                      <SelectItem value={BillingFrequency.ANNUAL}>Annual</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="paymentTerms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Terms</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select terms" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={PaymentTerms.NET_30}>Net 30</SelectItem>
                      <SelectItem value={PaymentTerms.NET_60}>Net 60</SelectItem>
                      <SelectItem value={PaymentTerms.NET_90}>Net 90</SelectItem>
                      <SelectItem value={PaymentTerms.DUE_ON_RECEIPT}>Due on Receipt</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="billingInAdvance"
              render={({ field }) => (
                <FormItem className="flex flex-col justify-end">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-4 w-4"
                    />
                    <FormLabel className="!mt-0">Bill in Advance</FormLabel>
                  </div>
                  <FormDescription>
                    Charge at the beginning of each period
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Seat-Based Pricing */}
        <div className="space-y-6 p-6 rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-purple-500 flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Seat-Based Pricing (Optional)</h3>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <FormField
              control={form.control}
              name="seatCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Seat Count</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="50" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="committedSeats"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Committed Seats</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="100" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormDescription>Minimum committed seats</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="seatPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price Per Seat</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="100" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Renewal Configuration */}
        <div className="space-y-6 p-6 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <RefreshCw className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Renewal Configuration</h3>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="autoRenew"
              render={({ field }) => (
                <FormItem className="flex flex-col justify-center">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-4 w-4"
                    />
                    <FormLabel className="!mt-0">Auto-Renew</FormLabel>
                  </div>
                  <FormDescription>
                    Automatically renew at the end of the term
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="renewalNoticeDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Renewal Notice Days</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="90" {...field} />
                  </FormControl>
                  <FormDescription>
                    Days before expiration to send renewal notice
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-6">
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <textarea
                    className="w-full min-h-[100px] p-2 border rounded-md"
                    placeholder="Additional contract notes..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="hover:scale-105 active:scale-95 transition-transform duration-200">
            {isLoading ? "Saving..." : mode === "create" ? "Create Contract" : "Update Contract"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
