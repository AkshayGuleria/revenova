import { useEffect, useState } from "react";
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
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { AlertCircle, Package } from "lucide-react";
import { useAccounts } from "~/lib/api/hooks/use-accounts";
import { useContracts, useContractProducts } from "~/lib/api/hooks/use-contracts";
import type {
  Account,
  Contract,
  ContractProduct,
  Invoice,
  CreateInvoiceDto,
  UpdateInvoiceDto,
} from "~/types/models";
import { CurrencySelect } from "~/components/ui/currency-select";
import { CurrencyDisplay } from "~/components/currency-display";
import { useConfigStore } from "~/lib/stores/config-store";

const invoiceFormSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  contractId: z.string().min(1, "Contract is required"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  issueDate: z.string().min(1, "Issue date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled", "void"]),
  currency: z.string().optional(),
  notes: z.string().optional(),
  tax: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
}).refine((data) => {
  return new Date(data.dueDate) > new Date(data.issueDate);
}, {
  message: "Due date must be after the issue date",
  path: ["dueDate"],
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
  const [selectedContractId, setSelectedContractId] = useState<string>(
    invoice?.contractId || ""
  );

  const {
    data: accountsData,
    error: accountsError,
    isLoading: accountsLoading,
  } = useAccounts({ "limit[eq]": 100 });

  const { data: contractsData } = useContracts(
    selectedAccountId
      ? { "accountId[eq]": selectedAccountId, "limit[eq]": 100 }
      : undefined
  );

  const { data: contractProductsData } = useContractProducts(selectedContractId);

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema) as Resolver<InvoiceFormData>,
    defaultValues: invoice
      ? {
          accountId: invoice.accountId,
          contractId: invoice.contractId || "",
          invoiceNumber: invoice.invoiceNumber,
          issueDate: new Date(invoice.issueDate).toISOString().split("T")[0],
          dueDate: new Date(invoice.dueDate).toISOString().split("T")[0],
          status: invoice.status,
          currency: invoice.currency,
          notes: invoice.notes || "",
          tax: invoice.tax || 0,
          discount: invoice.discount || 0,
        }
      : {
          accountId: "",
          contractId: "",
          invoiceNumber: `INV-${Date.now()}`,
          issueDate: new Date().toISOString().split("T")[0],
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          status: "draft",
          currency: defaultCurrency,
          notes: "",
          tax: 0,
          discount: 0,
        },
  });

  const selectedCurrency = form.watch("currency") || defaultCurrency;

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "accountId") {
        setSelectedAccountId(value.accountId || "");
        form.setValue("contractId", "");
        setSelectedContractId("");
      }
      if (name === "contractId") {
        setSelectedContractId(value.contractId || "");
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const accounts = (accountsData?.data ?? []) as Account[];

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

  const contracts = (contractsData?.data ?? []) as Contract[];
  const contractProducts = (contractProductsData?.data ?? []) as ContractProduct[];

  const previewSubtotal = contractProducts.reduce((sum, cp) => {
    const unitPrice = cp.unitPrice ?? cp.product?.basePrice ?? 0;
    const discount = cp.discount ?? 0;
    return sum + Number(unitPrice) * cp.quantity * (1 - Number(discount));
  }, 0);

  const handleSubmit = (data: InvoiceFormData) => {
    if (invoice) {
      onSubmit({
        accountId: data.accountId,
        ...(data.contractId ? { contractId: data.contractId } : {}),
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        status: data.status,
        currency: data.currency || defaultCurrency,
        notes: data.notes,
        tax: data.tax,
        discount: data.discount,
      } as UpdateInvoiceDto);
      return;
    }

    onSubmit({
      invoiceNumber: data.invoiceNumber,
      accountId: data.accountId,
      contractId: data.contractId,
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      status: data.status,
      currency: data.currency || defaultCurrency,
      notes: data.notes,
      tax: data.tax,
      discount: data.discount,
      billingType: "one_time" as const,
    } as CreateInvoiceDto);
  };

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
                  <FormLabel>Contract *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={!selectedAccountId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={
                          !selectedAccountId
                            ? "Select an account first"
                            : "Select contract"
                        } />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {contracts.map((contract) => (
                        <SelectItem key={contract.id} value={contract.id}>
                          {contract.contractNumber}
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

          <div className="mt-4">
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
        {invoice ? (
          /* Edit mode: show the stored invoice items (locked at creation) */
          invoice.items && invoice.items.length > 0 && (
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-5 w-5 text-teal-600" />
                <h3 className="text-lg font-semibold">Line Items</h3>
                <span className="text-xs text-gray-500 ml-1">(locked at invoice creation)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 font-medium">Description</th>
                      <th className="pb-2 font-medium text-right">Qty</th>
                      <th className="pb-2 font-medium text-right">Unit Price</th>
                      <th className="pb-2 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoice.items.map((item) => (
                      <tr key={item.id} className="py-2">
                        <td className="py-2">{item.description}</td>
                        <td className="py-2 text-right">{item.quantity}</td>
                        <td className="py-2 text-right">
                          <CurrencyDisplay amount={Number(item.unitPrice)} currency={selectedCurrency} />
                        </td>
                        <td className="py-2 text-right font-medium">
                          <CurrencyDisplay amount={Number(item.amount)} currency={selectedCurrency} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 border-t pt-3 flex justify-end">
                <div className="text-sm text-gray-500 mr-4">Subtotal:</div>
                <div className="font-semibold">
                  <CurrencyDisplay amount={Number(invoice.subtotal)} currency={selectedCurrency} />
                </div>
              </div>
            </Card>
          )
        ) : (
          /* Create mode: preview items that will be generated from contract products */
          selectedContractId && (
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-5 w-5 text-teal-600" />
                <h3 className="text-lg font-semibold">Line Items Preview</h3>
                <span className="text-xs text-gray-500 ml-1">(auto-generated from contract products)</span>
              </div>

              {contractProducts.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No products found on the selected contract.
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-500">
                          <th className="pb-2 font-medium">Product</th>
                          <th className="pb-2 font-medium text-right">Qty</th>
                          <th className="pb-2 font-medium text-right">Unit Price</th>
                          <th className="pb-2 font-medium text-right">Discount</th>
                          <th className="pb-2 font-medium text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {contractProducts.map((cp) => {
                          const unitPrice = cp.unitPrice ?? cp.product?.basePrice ?? 0;
                          const discount = cp.discount ?? 0;
                          const amount = Number(unitPrice) * cp.quantity * (1 - Number(discount));
                          return (
                            <tr key={cp.id} className="py-2">
                              <td className="py-2">{cp.product?.name ?? cp.productId}</td>
                              <td className="py-2 text-right">{cp.quantity}</td>
                              <td className="py-2 text-right">
                                <CurrencyDisplay amount={Number(unitPrice)} currency={selectedCurrency} />
                              </td>
                              <td className="py-2 text-right">
                                {Number(discount) > 0 ? `${(Number(discount) * 100).toFixed(0)}%` : "—"}
                              </td>
                              <td className="py-2 text-right font-medium">
                                <CurrencyDisplay amount={amount} currency={selectedCurrency} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 border-t pt-3 flex justify-end">
                    <div className="text-sm text-gray-500 mr-4">Estimated subtotal:</div>
                    <div className="font-semibold">
                      <CurrencyDisplay amount={previewSubtotal} currency={selectedCurrency} />
                    </div>
                  </div>
                </>
              )}
            </Card>
          )
        )}

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
