/**
 * Create Purchase Order Route
 * Form to create a new purchase order with account and contract linking
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
import { useCreatePurchaseOrder } from "~/lib/api/hooks/use-purchase-orders";
import { useAccounts } from "~/lib/api/hooks/use-accounts";
import { useContracts } from "~/lib/api/hooks/use-contracts";
import type { Account, Contract } from "~/types/models";
import { ShoppingCart, ArrowLeft } from "lucide-react";

const schema = z.object({
  poNumber: z.string().min(1, "PO number is required"),
  accountId: z.string().min(1, "Account is required"),
  contractId: z.string().optional(),
  description: z.string().optional(),
  amount: z.coerce.number().positive("Amount must be positive"),
  currency: z.string().default("USD"),
  issueDate: z.string().min(1, "Issue date is required"),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NewPurchaseOrderRoute() {
  const navigate = useNavigate();
  const createPO = useCreatePurchaseOrder();
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
      issueDate: new Date().toISOString().split("T")[0],
    },
  });

  // Load accounts for selector
  const { data: accountsData } = useAccounts({ "limit[eq]": 100 });
  const accounts = Array.isArray(accountsData?.data)
    ? (accountsData.data as Account[])
    : [];

  // Load contracts for selected account
  const { data: contractsData } = useContracts(
    selectedAccountId
      ? { "accountId[eq]": selectedAccountId, "status[eq]": "active", "limit[eq]": 100 }
      : undefined
  );
  const contracts = Array.isArray(contractsData?.data)
    ? (contractsData.data as Contract[])
    : [];

  const onSubmit = async (values: FormValues) => {
    try {
      const payload = {
        ...values,
        contractId: values.contractId || undefined,
        expiryDate: values.expiryDate || undefined,
      };
      const response = await createPO.mutateAsync(payload);
      toast.success("Purchase order created successfully");
      navigate(`/purchase-orders/${(response.data as any).id}`);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(`Failed to create purchase order: ${error.message}`);
      } else {
        toast.error("Failed to create purchase order");
      }
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="New Purchase Order"
        description="Create a new enterprise purchase order"
        actions={
          <Link to="/purchase-orders">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to POs
            </Button>
          </Link>
        }
      />

      <div className="mt-6 max-w-2xl">
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="h-2 bg-gradient-to-r from-violet-500 to-purple-600" />
          <CardHeader className="bg-gradient-to-br from-violet-50 to-purple-50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-violet-500 flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">
                  Purchase Order Details
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Fill in the details for the new purchase order
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* PO Number */}
              <div className="space-y-1.5">
                <Label htmlFor="poNumber">
                  PO Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="poNumber"
                  placeholder="e.g. PO-2026-0001"
                  {...register("poNumber")}
                />
                {errors.poNumber && (
                  <p className="text-sm text-red-600">{errors.poNumber.message}</p>
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
                    setValue("contractId", "");
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
                  <p className="text-sm text-red-600">{errors.accountId.message}</p>
                )}
              </div>

              {/* Contract (optional) */}
              <div className="space-y-1.5">
                <Label>Contract (optional)</Label>
                <Select
                  onValueChange={(val) =>
                    setValue("contractId", val === "none" ? "" : val)
                  }
                  disabled={!selectedAccountId || contracts.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !selectedAccountId
                          ? "Select an account first"
                          : contracts.length === 0
                          ? "No active contracts"
                          : "Select a contract"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No contract</SelectItem>
                    {contracts.map((contract) => (
                      <SelectItem key={contract.id} value={contract.id}>
                        {contract.contractNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Brief description of this purchase order"
                  {...register("description")}
                />
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
                    <p className="text-sm text-red-600">{errors.amount.message}</p>
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

              {/* Issue Date + Expiry Date */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="issueDate">
                    Issue Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="issueDate"
                    type="date"
                    {...register("issueDate")}
                  />
                  {errors.issueDate && (
                    <p className="text-sm text-red-600">{errors.issueDate.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expiryDate">Expiry Date</Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    {...register("expiryDate")}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes for this purchase order"
                  rows={3}
                  {...register("notes")}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={createPO.isPending}
                  className="hover:scale-105 active:scale-95 transition-transform duration-200"
                >
                  {createPO.isPending ? "Creating..." : "Create Purchase Order"}
                </Button>
                <Link to="/purchase-orders">
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
