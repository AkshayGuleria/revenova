/**
 * Invoice Form Component
 * Create and edit invoices with line items
 */

import { useEffect, useState } from "react";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
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
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAccounts } from "~/lib/api/hooks/use-accounts";
import { useContracts } from "~/lib/api/hooks/use-contracts";
import type {
  Invoice,
  CreateInvoiceDto,
  UpdateInvoiceDto,
} from "~/types/models";
import { CurrencySelect } from "~/components/ui/currency-select";
import { CurrencyDisplay } from "~/components/currency-display";
import { useConfigStore } from "~/lib/stores/config-store";

const invoiceItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  unitPrice: z.coerce.number().min(0, "Unit price cannot be negative"),
  productId: z.string().optional(),
});

const invoiceFormSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  contractId: z.string().optional(),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  issueDate: z.string().min(1, "Issue date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled", "void"]),
  currency: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, "At least one line item is required"),
  // Invoice-level tax and discount
  tax: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
}).refine((data) => {
  return new Date(data.dueDate) > new Date(data.issueDate);
}, {
  message: "Due date must be after the issue date",
  path: ["dueDate"],
}).refine((data) => {
  const subtotal = data.items.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
    0
  );
  return data.discount <= subtotal;
}, {
  message: "Discount cannot exceed the subtotal",
  path: ["discount"],
});

type InvoiceFormData = z.infer<typeof invoiceFormSchema>;

interface InvoiceFormProps {
  invoice?: Invoice;
  onSubmit: (data: CreateInvoiceDto | UpdateInvoiceDto) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function InvoiceForm({
  invoice,
  onSubmit,
  onCancel,
  isLoading,
}: InvoiceFormProps) {
  const { defaultCurrency } = useConfigStore();

  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    invoice?.accountId || ""
  );

  const {
    data: accountsData,
    error: accountsError,
    isLoading: accountsLoading
  } = useAccounts({ "limit[eq]": 100 });

  const {
    data: contractsData,
    error: contractsError,
    isLoading: contractsLoading
  } = useContracts(
    selectedAccountId
      ? { "accountId[eq]": selectedAccountId, "limit[eq]": 100 }
      : undefined
  );

  // IMPORTANT: All hooks must be called before any conditional returns
  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema) as Resolver<InvoiceFormData>,
    defaultValues: invoice
      ? {
          accountId: invoice.accountId,
          contractId: invoice.contractId || undefined,
          invoiceNumber: invoice.invoiceNumber,
          issueDate: new Date(invoice.issueDate).toISOString().split("T")[0],
          dueDate: new Date(invoice.dueDate).toISOString().split("T")[0],
          status: invoice.status,
          currency: invoice.currency,
          notes: invoice.notes || "",
          items: invoice.items || [],
          tax: invoice.tax || 0,
          discount: invoice.discount || 0,
        }
      : {
          accountId: "",
          contractId: undefined,
          invoiceNumber: `INV-${Date.now()}`,
          issueDate: new Date().toISOString().split("T")[0],
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          status: "draft",
          currency: defaultCurrency,
          notes: "",
          items: [
            {
              description: "",
              quantity: 1,
              unitPrice: 0,
            },
          ],
          tax: 0,
          discount: 0,
        },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const selectedCurrency = form.watch("currency") || defaultCurrency;

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "accountId") {
        setSelectedAccountId(value.accountId || "");
        form.setValue("contractId", undefined);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Now handle conditional rendering AFTER all hooks are called
  // Validate accounts data structure
  const accounts = accountsData?.data;
  if (accounts && !Array.isArray(accounts)) {
    console.error("[Invoice Form] Accounts API returned invalid data format", {
      receivedType: typeof accounts,
      receivedData: accounts,
    });
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Data Format Error</AlertTitle>
        <AlertDescription>
          The accounts data is in an unexpected format. Please contact support.
        </AlertDescription>
      </Alert>
    );
  }

  // Validate contracts data structure
  const contracts = contractsData?.data;
  if (contracts && !Array.isArray(contracts)) {
    console.error("[Invoice Form] Contracts API returned invalid data format", {
      receivedType: typeof contracts,
      receivedData: contracts,
    });
    toast.warning("Unable to load contracts - data format error");
  }

  // Handle account loading error
  if (accountsError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to load accounts</AlertTitle>
        <AlertDescription>
          Unable to fetch accounts: {accountsError.message}. Please refresh the page or contact support if the problem persists.
        </AlertDescription>
      </Alert>
    );
  }

  // Show loading state for accounts
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

  const handleSubmit = (data: InvoiceFormData) => {
    // Calculate totals and add required amount field for each item
    const items = data.items.map((item) => {
      const amount = item.quantity * item.unitPrice;
      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount, // Backend requires this field
        productId: item.productId,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const total = subtotal - data.discount + data.tax;

    // On update (edit mode), omit read-only fields like invoiceNumber and accountId
    // that the backend accepts but should not be changed after creation.
    // The backend PATCH endpoint ignores items array updates; line item changes
    // are managed separately via /invoices/:id/items endpoints.
    if (invoice) {
      const updatePayload = {
        contractId: data.contractId || undefined,
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        status: data.status,
        currency: data.currency || defaultCurrency,
        notes: data.notes,
        subtotal,
        tax: data.tax,
        discount: data.discount,
        total,
      };
      onSubmit(updatePayload);
      return;
    }

    const invoiceData = {
      invoiceNumber: data.invoiceNumber,
      accountId: data.accountId,
      contractId: data.contractId || undefined,
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      status: data.status,
      currency: data.currency || defaultCurrency,
      notes: data.notes,
      items,
      subtotal,
      tax: data.tax,
      discount: data.discount,
      total,
      billingType: "one_time" as const,
      consolidated: false,
    };

    onSubmit(invoiceData);
  };

  const addLineItem = () => {
    append({
      description: "",
      quantity: 1,
      unitPrice: 0,
    });
  };

  const calculateLineTotal = (index: number) => {
    const item = form.watch(`items.${index}`);
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);

    if (isNaN(quantity) || isNaN(unitPrice)) {
      console.warn(`[Invoice Form] Invalid number in line item ${index}`, {
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      });
      return 0;
    }

    return quantity * unitPrice;
  };

  const calculateTotals = () => {
    const items = form.watch("items");
    const tax = Number(form.watch("tax"));
    const discount = Number(form.watch("discount"));

    // Validate tax and discount
    if (isNaN(tax)) {
      console.error("[Invoice Form] Invalid tax value", form.watch("tax"));
      toast.error("Tax amount is invalid");
    }

    if (isNaN(discount)) {
      console.error("[Invoice Form] Invalid discount value", form.watch("discount"));
      toast.error("Discount amount is invalid");
    }

    const subtotal = items.reduce(
      (sum, item) => {
        const lineTotal = Number(item.quantity) * Number(item.unitPrice);
        if (isNaN(lineTotal)) {
          console.warn("[Invoice Form] NaN in line item calculation", item);
          return sum;
        }
        return sum + lineTotal;
      },
      0
    );

    const total = subtotal - (isNaN(discount) ? 0 : discount) + (isNaN(tax) ? 0 : tax);

    return {
      subtotal,
      discount: isNaN(discount) ? 0 : discount,
      tax: isNaN(tax) ? 0 : tax,
      total,
    };
  };

  const totals = calculateTotals();

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6" noValidate>
        {/* Invoice Header */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Invoice Information</h3>
          <div className="grid grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts?.map((account) => (
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

            <FormField
              control={form.control}
              name="contractId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contract (Optional)</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                    defaultValue={field.value || "none"}
                    disabled={!selectedAccountId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select contract" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {contracts?.map((contract) => (
                        <SelectItem key={contract.id} value={contract.id}>
                          {contract.contractName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="invoiceNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Number *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="void">Void</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="issueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Issue Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency *</FormLabel>
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

            <FormField
              control={form.control}
              name="tax"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="discount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Discount Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-6">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Card>

        {/* Line Items */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Line Items</h3>
            <Button type="button" onClick={addLineItem} size="sm" className="hover:scale-105 active:scale-95 transition-transform duration-200">
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </div>

          <div className="space-y-6">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="p-4 border rounded-lg bg-gray-50 space-y-6"
              >
                <div className="flex justify-between items-start">
                  <h4 className="font-medium">Item {index + 1}</h4>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name={`items.${index}.description`}
                    render={({ field }) => (
                      <FormItem className="col-span-3">
                        <FormLabel>Description *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`items.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity *</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} min="1" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`items.${index}.unitPrice`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Price *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            min="0"
                            step="0.01"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-end">
                    <div className="text-sm">
                      <span className="text-gray-600">Amount: </span>
                      <span className="font-semibold">
                        <CurrencyDisplay amount={calculateLineTotal(index)} currency={selectedCurrency} />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Invoice Totals */}
        <Card className="p-6">
          <div className="max-w-md ml-auto space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <CurrencyDisplay amount={totals.subtotal} currency={selectedCurrency} className="font-medium" />
            </div>

            {totals.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Discount:</span>
                <span className="text-green-600 font-medium">
                  -<CurrencyDisplay amount={totals.discount} currency={selectedCurrency} />
                </span>
              </div>
            )}

            {totals.tax > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax:</span>
                <CurrencyDisplay amount={totals.tax} currency={selectedCurrency} className="font-medium" />
              </div>
            )}

            <div className="border-t pt-3 flex justify-between text-lg font-semibold">
              <span>Total:</span>
              <CurrencyDisplay amount={totals.total} currency={selectedCurrency} />
            </div>
          </div>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="hover:scale-105 active:scale-95 transition-transform duration-200">
            {isLoading ? "Saving..." : invoice ? "Update Invoice" : "Create Invoice"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
