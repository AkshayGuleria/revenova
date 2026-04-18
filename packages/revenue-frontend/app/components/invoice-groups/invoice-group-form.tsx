/**
 * Invoice Group Form Component
 * Create and edit invoice groups
 */

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
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
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useAccounts } from "~/lib/api/hooks/use-accounts";
import type {
  InvoiceGroup,
  CreateInvoiceGroupDto,
  UpdateInvoiceGroupDto,
} from "~/types/models";
import { InvoiceGroupType } from "~/types/models";

const invoiceGroupFormSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  name: z.string().min(1, "Name is required"),
  groupType: z.nativeEnum(InvoiceGroupType),
  code: z.string().optional(),
});

type InvoiceGroupFormData = z.infer<typeof invoiceGroupFormSchema>;

const GROUP_TYPE_LABELS: Record<InvoiceGroupType, string> = {
  [InvoiceGroupType.DEPARTMENT]: "Department",
  [InvoiceGroupType.COST_CENTER]: "Cost Center",
  [InvoiceGroupType.LOCATION]: "Location",
  [InvoiceGroupType.CUSTOM]: "Custom",
};

interface InvoiceGroupFormProps {
  group?: InvoiceGroup;
  onSubmit: (data: CreateInvoiceGroupDto | UpdateInvoiceGroupDto) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function InvoiceGroupForm({
  group,
  onSubmit,
  onCancel,
  isLoading,
}: InvoiceGroupFormProps) {
  const {
    data: accountsData,
    error: accountsError,
    isLoading: accountsLoading,
  } = useAccounts({ "limit[eq]": 100 });

  const form = useForm<InvoiceGroupFormData>({
    resolver: zodResolver(invoiceGroupFormSchema) as Resolver<InvoiceGroupFormData>,
    defaultValues: group
      ? {
          accountId: group.accountId,
          name: group.name,
          groupType: group.groupType,
          code: group.code || "",
        }
      : {
          accountId: "",
          name: "",
          groupType: undefined,
          code: "",
        },
  });

  if (accountsError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to load accounts</AlertTitle>
        <AlertDescription>
          Unable to fetch accounts: {accountsError.message}. Please refresh the page.
        </AlertDescription>
      </Alert>
    );
  }

  if (accountsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-2 text-sm text-gray-600">Loading accounts...</p>
        </div>
      </div>
    );
  }

  const accounts = Array.isArray(accountsData?.data)
    ? (accountsData.data as import("~/types/models").Account[])
    : [];

  const handleSubmit = (data: InvoiceGroupFormData) => {
    if (group) {
      // Edit mode — only send mutable fields
      onSubmit({
        name: data.name,
        code: data.code || undefined,
      } as UpdateInvoiceGroupDto);
    } else {
      onSubmit({
        accountId: data.accountId,
        name: data.name,
        groupType: data.groupType,
        code: data.code || undefined,
      } as CreateInvoiceGroupDto);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-6"
        noValidate
      >
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Group Information</h3>
          <div className="grid grid-cols-2 gap-6">
            {/* Account — read-only in edit mode */}
            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={!!group}
                  >
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
                  {group && (
                    <p className="text-xs text-gray-500 mt-1">
                      Account cannot be changed after creation.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Group Type — read-only in edit mode */}
            <FormField
              control={form.control}
              name="groupType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Type *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={!!group}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(InvoiceGroupType).map((type) => (
                        <SelectItem key={type} value={type}>
                          {GROUP_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {group && (
                    <p className="text-xs text-gray-500 mt-1">
                      Type cannot be changed after creation.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Engineering, HQ Office" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. ENG-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="hover:scale-105 active:scale-95 transition-transform duration-200"
          >
            {isLoading
              ? "Saving..."
              : group
              ? "Update Group"
              : "Create Group"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
