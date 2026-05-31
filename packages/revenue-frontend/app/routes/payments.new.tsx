/**
 * Record Payment Route
 * Form to record a new payment with optional invoice linking
 */

import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ApiError } from "~/lib/api/client";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useCreatePayment } from "~/lib/api/hooks/use-payments";
import { useAccounts } from "~/lib/api/hooks/use-accounts";
import { useInvoices } from "~/lib/api/hooks/use-invoices";
import type { Account, Invoice } from "~/types/models";
import { CreditCard, ArrowLeft } from "lucide-react";

const schema = z.object({
  paymentNumber: z.string().min(1, "Payment number is required"),
  accountId: z.string().min(1, "Account is required"),
  invoiceId: z.string().optional(),
  amount: z.coerce.number().positive("Amount must be positive"),
  currency: z.string().default("USD"),
  method: z.enum([
    "bank_transfer",
    "ach",
    "wire",
    "check",
    "credit_card",
    "other",
  ]),
  referenceNumber: z.string().optional(),
  paymentDate: z.string().min(1, "Payment date is required"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NewPaymentRoute() {
  const navigate = useNavigate();
  const createPayment = useCreatePayment();
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currency: "USD",
      method: "bank_transfer",
      paymentDate: new Date().toISOString().split("T")[0],
    },
  });

  // Load accounts
  const { data: accountsData } = useAccounts({ "limit[eq]": 100 });
  const accounts = Array.isArray(accountsData?.data)
    ? (accountsData.data as Account[])
    : [];

  // Load open invoices for selected account
  const { data: invoicesData } = useInvoices(
    selectedAccountId
      ? {
          "accountId[eq]": selectedAccountId,
          "status[in]": "sent,overdue",
          "limit[eq]": 100,
        }
      : undefined
  );
  const invoices = Array.isArray(invoicesData?.data)
    ? (invoicesData.data as Invoice[])
    : [];

  const onSubmit = async (values: FormValues) => {
    try {
      const payload = {
        ...values,
        invoiceId: values.invoiceId || undefined,
      };
      const response = await createPayment.mutateAsync(payload);
      toast.success("Payment recorded successfully");
      navigate("/payments");
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(`Failed to record payment: ${error.message}`);
      } else {
        toast.error("Failed to record payment");
      }
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Record Payment"
        description="Record a new customer payment"
        actions={
          <Link to="/payments">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Payments
            </Button>
          </Link>
        }
      />

      <div className="mt-6 max-w-2xl">
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-600" />
          <CardHeader className="bg-gradient-to-br from-emerald-50 to-teal-50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">
                  Payment Details
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Enter the payment information below
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Payment Number */}
              <div className="space-y-1.5">
                <Label htmlFor="paymentNumber">
                  Payment Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="paymentNumber"
                  placeholder="e.g. PAY-2026-0001"
                  {...register("paymentNumber")}
                />
                {errors.paymentNumber && (
                  <p className="text-sm text-red-600">
                    {errors.paymentNumber.message}
                  </p>
                )}
              </div>

              {/* Account */}
              <div className="space-y-1.5">
                <Label>
                  Account <span className="text-red-500">*</span>
                </Label>
                <Select
                  onValueChange={(val) => {
                    setValue("accountId", val);
                    setSelectedAccountId(val);
                    setValue("invoiceId", "");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.accountName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.accountId && (
                  <p className="text-sm text-red-600">
                    {errors.accountId.message}
                  </p>
                )}
              </div>

              {/* Invoice (optional) */}
              <div className="space-y-1.5">
                <Label>Apply to Invoice (optional)</Label>
                <Select
                  onValueChange={(val) =>
                    setValue("invoiceId", val === "none" ? "" : val)
                  }
                  disabled={!selectedAccountId || invoices.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !selectedAccountId
                          ? "Select an account first"
                          : invoices.length === 0
                          ? "No open invoices"
                          : "Select an invoice to apply payment to"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No invoice (unallocated)</SelectItem>
                    {invoices.map((invoice) => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoice.invoiceNumber} —{" "}
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: invoice.currency,
                        }).format(Number(invoice.total))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount + Currency */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="amount">
                    Amount <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    {...register("amount")}
                  />
                  {errors.amount && (
                    <p className="text-sm text-red-600">
                      {errors.amount.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select
                    defaultValue="USD"
                    onValueChange={(val) => setValue("currency", val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="CAD">CAD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <Label>
                  Payment Method <span className="text-red-500">*</span>
                </Label>
                <Select
                  defaultValue="bank_transfer"
                  onValueChange={(val) => setValue("method", val as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="ach">ACH</SelectItem>
                    <SelectItem value="wire">Wire Transfer</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {errors.method && (
                  <p className="text-sm text-red-600">{errors.method.message}</p>
                )}
              </div>

              {/* Reference Number + Payment Date */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="referenceNumber">Reference Number</Label>
                  <Input
                    id="referenceNumber"
                    placeholder="e.g. TXN-123456"
                    {...register("referenceNumber")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="paymentDate">
                    Payment Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    {...register("paymentDate")}
                  />
                  {errors.paymentDate && (
                    <p className="text-sm text-red-600">
                      {errors.paymentDate.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes"
                  rows={3}
                  {...register("notes")}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={createPayment.isPending}
                  className="hover:scale-105 active:scale-95 transition-transform duration-200"
                >
                  {createPayment.isPending ? "Recording..." : "Record Payment"}
                </Button>
                <Link to="/payments">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
