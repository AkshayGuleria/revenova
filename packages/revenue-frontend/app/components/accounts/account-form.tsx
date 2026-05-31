/**
 * Account Form Component
 * Form for creating and editing accounts with validation
 */

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Info, CreditCard, DollarSign, MapPin } from "lucide-react";
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
import type { Account, CreateAccountDto, UpdateAccountDto } from "~/types/models";
import { AccountType, AccountStatus, PaymentTerms } from "~/types/models";
import { useAccounts } from "~/lib/api/hooks/use-accounts";
import { CurrencySelect } from "~/components/ui/currency-select";
import { useConfigStore } from "~/lib/stores/config-store";

// Validation schema
const accountFormSchema = z.object({
  accountName: z.string().min(1, "Account name is required"),
  primaryContactEmail: z.string().email("Invalid email address"),
  accountType: z.nativeEnum(AccountType),
  status: z.nativeEnum(AccountStatus).optional(),
  parentAccountId: z.string().optional().or(z.literal("")),

  // Billing contact
  billingContactName: z.string().optional(),
  billingContactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  billingContactPhone: z.string().optional(),

  // Billing address
  billingAddressLine1: z.string().optional(),
  billingAddressLine2: z.string().optional(),
  billingCity: z.string().optional(),
  billingState: z.string().optional(),
  billingPostalCode: z.string().optional(),
  billingCountry: z.string().optional(),

  // Financial terms
  paymentTerms: z.nativeEnum(PaymentTerms).optional(),
  currency: z.string().optional(),
  taxId: z.string().optional(),
  creditLimit: z.coerce.number().positive().optional(),
});

type AccountFormValues = z.infer<typeof accountFormSchema>;

interface AccountFormProps {
  account?: Account;
  onSubmit: (data: CreateAccountDto | UpdateAccountDto) => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  mode: "create" | "edit";
}

export function AccountForm({
  account,
  onSubmit,
  onCancel,
  isLoading,
  mode,
}: AccountFormProps) {
  const { defaultCurrency } = useConfigStore();

  // Fetch parent accounts for hierarchy selection
  const { data: accountsData } = useAccounts();
  const parentAccounts = Array.isArray(accountsData?.data)
    ? accountsData.data.filter((a) => a.id !== account?.id)
    : [];

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema) as Resolver<AccountFormValues>,
    defaultValues: {
      accountName: account?.accountName || "",
      primaryContactEmail: account?.primaryContactEmail || "",
      accountType: account?.accountType || AccountType.ENTERPRISE,
      status: account?.status || AccountStatus.ACTIVE,
      parentAccountId: account?.parentAccountId || undefined,
      billingContactName: account?.billingContactName || "",
      billingContactEmail: account?.billingContactEmail || "",
      billingContactPhone: account?.billingContactPhone || "",
      billingAddressLine1: account?.billingAddressLine1 || "",
      billingAddressLine2: account?.billingAddressLine2 || "",
      billingCity: account?.billingCity || "",
      billingState: account?.billingState || "",
      billingPostalCode: account?.billingPostalCode || "",
      billingCountry: account?.billingCountry || "USA",
      paymentTerms: account?.paymentTerms || PaymentTerms.NET_30,
      currency: account?.currency || defaultCurrency,
      taxId: account?.taxId || "",
      creditLimit: account?.creditLimit,
    },
  });

  const handleSubmit = (values: AccountFormValues) => {
    const data: CreateAccountDto | UpdateAccountDto = {
      ...values,
      parentAccountId: values.parentAccountId || undefined,
      billingContactEmail: values.billingContactEmail || undefined,
    };
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        {/* Basic Information */}
        <div className="space-y-6 p-6 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <Info className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
          </div>

          <FormField
            control={form.control}
            name="accountName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Acme Corporation" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="primaryContactEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Primary Contact Email *</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="contact@acme.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="accountType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Type *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={AccountType.ENTERPRISE}>
                        Enterprise
                      </SelectItem>
                      <SelectItem value={AccountType.SMB}>SMB</SelectItem>
                      <SelectItem value={AccountType.STARTUP}>
                        Startup
                      </SelectItem>
                    </SelectContent>
                  </Select>
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
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={AccountStatus.ACTIVE}>
                          Active
                        </SelectItem>
                        <SelectItem value={AccountStatus.INACTIVE}>
                          Inactive
                        </SelectItem>
                        <SelectItem value={AccountStatus.SUSPENDED}>
                          Suspended
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

          <FormField
            control={form.control}
            name="parentAccountId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Parent Account (Hierarchy)</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                  defaultValue={field.value || "none"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="None (Root Account)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None (Root Account)</SelectItem>
                    {parentAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.accountName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Set parent for hierarchical account structure
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Financial Terms */}
        <div className="space-y-6 p-6 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-green-500 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Financial Terms</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="paymentTerms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Terms</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select terms" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={PaymentTerms.NET_30}>
                        Net 30
                      </SelectItem>
                      <SelectItem value={PaymentTerms.NET_60}>
                        Net 60
                      </SelectItem>
                      <SelectItem value={PaymentTerms.NET_90}>
                        Net 90
                      </SelectItem>
                      <SelectItem value={PaymentTerms.DUE_ON_RECEIPT}>
                        Due on Receipt
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <FormControl>
                    <CurrencySelect
                      value={field.value}
                      onValueChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="taxId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax ID</FormLabel>
                  <FormControl>
                    <Input placeholder="12-3456789" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="creditLimit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Credit Limit</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="50000"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Billing Contact */}
        <div className="space-y-6 p-6 rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-purple-500 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Billing Contact</h3>
          </div>

          <FormField
            control={form.control}
            name="billingContactName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Name</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="billingContactEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="billing@acme.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="billingContactPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+1 (555) 123-4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Billing Address */}
        <div className="space-y-6 p-6 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Billing Address</h3>
          </div>

          <FormField
            control={form.control}
            name="billingAddressLine1"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address Line 1</FormLabel>
                <FormControl>
                  <Input placeholder="123 Main Street" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="billingAddressLine2"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address Line 2</FormLabel>
                <FormControl>
                  <Input placeholder="Suite 100" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="billingCity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input placeholder="San Francisco" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="billingState"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State / Province</FormLabel>
                  <FormControl>
                    <Input placeholder="CA" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="billingPostalCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Postal Code</FormLabel>
                  <FormControl>
                    <Input placeholder="94102" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="billingCountry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl>
                    <Input placeholder="USA" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="hover:scale-105 active:scale-95 transition-transform duration-200">
            {isLoading ? "Saving..." : mode === "create" ? "Create Account" : "Update Account"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
