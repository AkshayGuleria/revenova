/**
 * Sub-Invoice Form Component
 * Simplified form for creating sub-invoices under a parent invoice
 */

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
import { Separator } from "~/components/ui/separator";
import { Plus, Trash2 } from "lucide-react";
import { useInvoiceGroups } from "~/lib/api/hooks/use-invoice-groups";
import { CurrencyDisplay } from "~/components/currency-display";
import { useConfigStore } from "~/lib/stores/config-store";
import type { CreateSubInvoiceDto, Invoice } from "~/types/models";
import { InvoiceGroupType } from "~/types/models";

const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  unitPrice: z.coerce.number().min(0, "Unit price cannot be negative"),
});

const subInvoiceFormSchema = z.object({
  invoiceGroupId: z.string().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  notes: z.string().optional(),
  tax: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  items: z.array(lineItemSchema).min(1, "At least one line item is required"),
});

type SubInvoiceFormData = z.infer<typeof subInvoiceFormSchema>;

const GROUP_TYPE_LABELS: Record<InvoiceGroupType, string> = {
  [InvoiceGroupType.DEPARTMENT]: "Department",
  [InvoiceGroupType.COST_CENTER]: "Cost Center",
  [InvoiceGroupType.LOCATION]: "Location",
  [InvoiceGroupType.CUSTOM]: "Custom",
};

interface SubInvoiceFormProps {
  parentInvoice: Invoice;
  onSubmit: (data: CreateSubInvoiceDto) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function SubInvoiceForm({
  parentInvoice,
  onSubmit,
  onCancel,
  isLoading,
}: SubInvoiceFormProps) {
  const { defaultCurrency } = useConfigStore();

  // Load invoice groups filtered by parent's account
  const { data: groupsData } = useInvoiceGroups({
    "accountId[eq]": parentInvoice.accountId,
    "limit[eq]": 100,
  });

  const groups = Array.isArray(groupsData?.data)
    ? (groupsData.data as import("~/types/models").InvoiceGroup[])
    : [];

  const form = useForm<SubInvoiceFormData>({
    resolver: zodResolver(subInvoiceFormSchema) as Resolver<SubInvoiceFormData>,
    defaultValues: {
      invoiceGroupId: undefined,
      issueDate: new Date(parentInvoice.issueDate).toISOString().split("T")[0],
      dueDate: new Date(parentInvoice.dueDate).toISOString().split("T")[0],
      periodStart: parentInvoice.periodStart
        ? new Date(parentInvoice.periodStart).toISOString().split("T")[0]
        : "",
      periodEnd: parentInvoice.periodEnd
        ? new Date(parentInvoice.periodEnd).toISOString().split("T")[0]
        : "",
      notes: "",
      tax: 0,
      discount: 0,
      items: [{ description: "", quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const currency = parentInvoice.currency || defaultCurrency;

  const calculateLineTotal = (index: number) => {
    const item = form.watch(`items.${index}`);
    const qty = Number(item.quantity);
    const price = Number(item.unitPrice);
    return isNaN(qty) || isNaN(price) ? 0 : qty * price;
  };

  const calculateTotals = () => {
    const items = form.watch("items");
    const tax = Number(form.watch("tax")) || 0;
    const discount = Number(form.watch("discount")) || 0;
    const subtotal = items.reduce((sum, item) => {
      const lineTotal = Number(item.quantity) * Number(item.unitPrice);
      return sum + (isNaN(lineTotal) ? 0 : lineTotal);
    }, 0);
    const total = subtotal - discount + tax;
    return { subtotal, discount, tax, total };
  };

  const totals = calculateTotals();

  const handleSubmit = (formData: SubInvoiceFormData) => {
    const items = formData.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.quantity * item.unitPrice,
    }));

    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const tax = formData.tax || 0;
    const discount = formData.discount || 0;
    const total = subtotal - discount + tax;

    const payload: CreateSubInvoiceDto = {
      invoiceGroupId: formData.invoiceGroupId || undefined,
      issueDate: formData.issueDate || undefined,
      dueDate: formData.dueDate || undefined,
      periodStart: formData.periodStart || undefined,
      periodEnd: formData.periodEnd || undefined,
      notes: formData.notes || undefined,
      subtotal,
      tax,
      discount,
      total,
      currency,
      items,
    };

    onSubmit(payload);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-6"
        noValidate
      >
        {/* Group & Dates */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Sub-Invoice Details</h3>
          <div className="grid grid-cols-2 gap-6">
            {/* Invoice Group — optional */}
            <FormField
              control={form.control}
              name="invoiceGroupId"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Invoice Group (Optional)</FormLabel>
                  <Select
                    onValueChange={(value) =>
                      field.onChange(value === "none" ? undefined : value)
                    }
                    defaultValue={field.value ?? "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="No group" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No group</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          <span className="font-medium">{group.name}</span>
                          <span className="ml-2 text-gray-500 text-xs">
                            {GROUP_TYPE_LABELS[group.groupType]}
                            {group.code ? ` · ${group.code}` : ""}
                          </span>
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
              name="issueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Issue Date</FormLabel>
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
                  <FormLabel>Due Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="periodStart"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Period Start (Optional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="periodEnd"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Period End (Optional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder="Any additional notes for this sub-invoice..."
                    />
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
            <Button
              type="button"
              size="sm"
              onClick={() =>
                append({ description: "", quantity: 1, unitPrice: 0 })
              }
              className="hover:scale-105 active:scale-95 transition-transform duration-200"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="p-4 border rounded-lg bg-gray-50 space-y-4"
              >
                <div className="flex justify-between items-start">
                  <h4 className="font-medium text-sm">Item {index + 1}</h4>
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

                <div className="grid grid-cols-3 gap-4">
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
                          <Input type="number" min="1" {...field} />
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
                            min="0"
                            step="0.01"
                            {...field}
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
                        <CurrencyDisplay
                          amount={calculateLineTotal(index)}
                          currency={currency}
                        />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Totals */}
        <Card className="p-6">
          <div className="grid grid-cols-2 gap-6 mb-4">
            <FormField
              control={form.control}
              name="tax"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
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
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="max-w-md ml-auto space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <CurrencyDisplay
                amount={totals.subtotal}
                currency={currency}
                className="font-medium"
              />
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Discount:</span>
                <span className="text-green-600 font-medium">
                  -{" "}
                  <CurrencyDisplay
                    amount={totals.discount}
                    currency={currency}
                  />
                </span>
              </div>
            )}
            {totals.tax > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax:</span>
                <CurrencyDisplay
                  amount={totals.tax}
                  currency={currency}
                  className="font-medium"
                />
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-lg font-semibold">
              <span>Total:</span>
              <CurrencyDisplay amount={totals.total} currency={currency} />
            </div>
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
            {isLoading ? "Creating..." : "Create Sub-Invoice"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
