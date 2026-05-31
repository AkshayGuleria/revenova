import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { FileText, CreditCard, Users, RefreshCw, Package, Plus, Trash2 } from "lucide-react";
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
import type { Account, Contract, CreateContractDto, Product, UpdateContractDto } from "~/types/models";
import { ContractStatus, BillingFrequency, PaymentTerms } from "~/types/models";
import { useAccounts } from "~/lib/api/hooks/use-accounts";
import { useProducts } from "~/lib/api/hooks/use-products";
import { useConfigStore } from "~/lib/stores/config-store";

const contractProductSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").default(1),
  unitPrice: z.coerce.number().min(0).optional(),
  discount: z.coerce.number().min(0).max(1).optional(),
});

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
  products: z.array(contractProductSchema).optional(),
});

type ContractFormValues = z.infer<typeof contractFormSchema>;

interface ContractFormProps {
  contract?: Contract;
  onSubmit: (data: CreateContractDto | UpdateContractDto) => void | Promise<void>;
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

  const { data: accountsData } = useAccounts({ "limit[eq]": 100 });
  const accounts = (accountsData?.data ?? []) as Account[];

  const { data: productsData } = useProducts({ "limit[eq]": 100, "active[eq]": "true" });
  const products = (productsData?.data ?? []) as Product[];

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
      products: mode === "create" ? [{ productId: "", quantity: 1 }] : [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "products",
  });

  const handleSubmit = (values: ContractFormValues) => {
    if (mode === "create") {
      const { status, products: productFields, ...rest } = values;
      if (!productFields || productFields.length === 0) {
        form.setError("products", { message: "At least one product is required" });
        return;
      }
      const validProducts = productFields.filter((p) => p.productId);
      if (validProducts.length === 0) {
        form.setError("products", { message: "At least one product is required" });
        return;
      }
      onSubmit({
        ...rest,
        products: validProducts.map((p) => ({
          productId: p.productId,
          quantity: p.quantity,
          ...(p.unitPrice !== undefined && p.unitPrice > 0 ? { unitPrice: p.unitPrice } : {}),
          ...(p.discount !== undefined && p.discount > 0 ? { discount: p.discount } : {}),
        })),
      } as CreateContractDto);
    } else {
      const { products: _products, ...updateData } = values;
      onSubmit(updateData as UpdateContractDto);
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

        {/* Products — create mode only */}
        {mode === "create" && (
          <div className="space-y-4 p-6 rounded-lg bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-teal-500 flex items-center justify-center">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Products *</h3>
                  <p className="text-xs text-gray-500">Invoice line items will be auto-generated from these products</p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => append({ productId: "", quantity: 1 })}
                className="border-teal-300 text-teal-700 hover:bg-teal-50"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Product
              </Button>
            </div>

            {fields.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No products added. Click "Add Product" to include at least one product.
              </p>
            )}

            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-3 items-end p-3 bg-white rounded-lg border border-teal-100">
                  <div className="col-span-5">
                    <FormField
                      control={form.control}
                      name={`products.${index}.productId`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Product *</FormLabel>
                          <Select onValueChange={f.onChange} value={f.value}>
                            <FormControl>
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                  {p.basePrice ? ` — ${p.currency} ${p.basePrice}` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name={`products.${index}.quantity`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Qty *</FormLabel>
                          <FormControl>
                            <Input type="number" min="1" className="h-9" {...f} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name={`products.${index}.unitPrice`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Price Override</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Base price"
                              className="h-9"
                              {...f}
                              value={f.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name={`products.${index}.discount`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Discount (0–1)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="1"
                              step="0.01"
                              placeholder="e.g. 0.1"
                              className="h-9"
                              {...f}
                              value={f.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="col-span-1 flex justify-center pb-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      className="h-9 w-9 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {form.formState.errors.products && (
              <p className="text-sm text-red-500">
                {form.formState.errors.products.message ||
                  form.formState.errors.products.root?.message}
              </p>
            )}
          </div>
        )}

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
