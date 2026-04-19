/**
 * Contract Details Route
 * Enhanced UX inline with account details view
 */

import { useParams, Link } from "react-router";
import { useState } from "react";
import {
  Edit,
  FileText,
  Building,
  DollarSign,
  Calendar,
  User,
  CreditCard,
  RefreshCw,
  Clock,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Receipt,
  Package,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { PageLoader } from "~/components/page-loader";
import { StatusBadge } from "~/components/status-badge";
import { DateDisplay } from "~/components/date-display";
import { CurrencyDisplay } from "~/components/currency-display";
import { useContract, useContractProducts, useAddContractProduct, useRemoveContractProduct } from "~/lib/api/hooks/use-contracts";
import { useProducts } from "~/lib/api/hooks/use-products";
import { useInvoices } from "~/lib/api/hooks/use-invoices";
import type { ContractProduct, Invoice, Product } from "~/types/models";

function ContractInvoicesTab({ contractId }: { contractId: string }) {
  const { data, isLoading } = useInvoices({
    "contractId[eq]": contractId,
    "limit[eq]": 100,
  });
  const invoices = (data?.data ?? []) as Invoice[];
  const total = data?.paging?.total ?? invoices.length;

  const statusColorMap: Record<string, "green" | "gray" | "yellow" | "red" | "blue"> = {
    draft: "gray",
    sent: "blue",
    paid: "green",
    overdue: "red",
    cancelled: "gray",
    void: "gray",
  };

  return (
    <Card className="overflow-hidden border-0 shadow-lg">
      <div className="h-2 bg-gradient-to-r from-purple-500 to-pink-600" />
      <CardHeader className="bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-purple-500 flex items-center justify-center">
            <Receipt className="h-6 w-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold text-gray-900">Contract Invoices</CardTitle>
            <CardDescription className="text-gray-600">
              {isLoading ? "Loading…" : `${total} invoice${total !== 1 ? "s" : ""} for this contract`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading invoices…</div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-100 to-pink-200 flex items-center justify-center">
              <Receipt className="h-10 w-10 text-purple-400" />
            </div>
            <p className="text-lg font-semibold text-gray-900 mb-2">No Invoices Yet</p>
            <p className="text-sm text-gray-600 mb-6">
              Invoices will appear here once generated from this contract
            </p>
            <Link to="/billing/generate">
              <Button className="hover:scale-105 active:scale-95 transition-transform duration-200">
                Generate Invoice
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 font-medium">Invoice #</th>
                  <th className="pb-3 font-medium">Issue Date</th>
                  <th className="pb-3 font-medium">Billing Period</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="py-3 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 pr-4">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="font-medium text-purple-700 hover:text-purple-900 hover:underline"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-gray-700">
                      <DateDisplay date={inv.issueDate} />
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {inv.periodStart && inv.periodEnd ? (
                        <span className="tabular-nums">
                          <DateDisplay date={inv.periodStart} /> – <DateDisplay date={inv.periodEnd} />
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge
                        status={inv.status}
                        color={statusColorMap[inv.status] ?? "gray"}
                      />
                    </td>
                    <td className="py-3 text-right font-semibold">
                      <CurrencyDisplay amount={inv.total} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContractProductsTab({ contractId }: { contractId: string }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProductId, setNewProductId] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [newUnitPrice, setNewUnitPrice] = useState("");
  const [newDiscount, setNewDiscount] = useState("");

  const { data: cpData, isLoading: cpLoading } = useContractProducts(contractId);
  const contractProducts = (cpData?.data ?? []) as ContractProduct[];

  const { data: productsData } = useProducts({ "limit[eq]": 100, "active[eq]": "true" });
  const allProducts = (productsData?.data ?? []) as Product[];

  const addProduct = useAddContractProduct(contractId);
  const removeProduct = useRemoveContractProduct(contractId);

  const attachedProductIds = new Set(contractProducts.map((cp) => cp.productId));
  const availableProducts = allProducts.filter((p) => !attachedProductIds.has(p.id));

  const handleAdd = async () => {
    if (!newProductId) return;
    try {
      await addProduct.mutateAsync({
        productId: newProductId,
        quantity: parseInt(newQuantity) || 1,
        ...(newUnitPrice ? { unitPrice: parseFloat(newUnitPrice) } : {}),
        ...(newDiscount ? { discount: parseFloat(newDiscount) } : {}),
      });
      toast.success("Product added to contract");
      setShowAddForm(false);
      setNewProductId("");
      setNewQuantity("1");
      setNewUnitPrice("");
      setNewDiscount("");
    } catch {
      toast.error("Failed to add product");
    }
  };

  const handleRemove = async (productId: string) => {
    try {
      await removeProduct.mutateAsync(productId);
      toast.success("Product removed from contract");
    } catch {
      toast.error("Failed to remove product");
    }
  };

  if (cpLoading) {
    return <div className="text-center py-8 text-gray-500">Loading products...</div>;
  }

  return (
    <Card className="overflow-hidden border-0 shadow-lg">
      <div className="h-2 bg-gradient-to-r from-teal-500 to-cyan-600" />
      <CardHeader className="bg-gradient-to-br from-teal-50 to-cyan-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-teal-500 flex items-center justify-center">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-gray-900">Contract Products</CardTitle>
              <CardDescription className="text-gray-600">
                {contractProducts.length} product(s) — invoice items are auto-generated from these
              </CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-teal-300 text-teal-700 hover:bg-teal-50"
            onClick={() => setShowAddForm((v) => !v)}
            disabled={availableProducts.length === 0}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Product
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {/* Inline add form */}
        {showAddForm && (
          <div className="p-4 rounded-lg border-2 border-dashed border-teal-200 bg-teal-50/50 space-y-3">
            <p className="text-sm font-semibold text-teal-800">Add product to contract</p>
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-5">
                <Select value={newProductId} onValueChange={setNewProductId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}{p.basePrice ? ` — ${p.currency} ${p.basePrice}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  min="1"
                  placeholder="Qty"
                  className="h-9"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Price override"
                  className="h-9"
                  value={newUnitPrice}
                  onChange={(e) => setNewUnitPrice(e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  placeholder="Discount (0–1)"
                  className="h-9"
                  value={newDiscount}
                  onChange={(e) => setNewDiscount(e.target.value)}
                />
              </div>
              <div className="col-span-1 flex gap-1">
                <Button
                  size="sm"
                  className="h-9 w-9 p-0 bg-teal-600 hover:bg-teal-700"
                  onClick={handleAdd}
                  disabled={!newProductId || addProduct.isPending}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {contractProducts.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-teal-100 flex items-center justify-center">
              <Package className="h-8 w-8 text-teal-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700">No products attached</p>
            <p className="text-xs text-gray-500 mt-1">Add products to enable invoice auto-generation</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 font-medium">Product</th>
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 font-medium text-right">Qty</th>
                  <th className="pb-3 font-medium text-right">Unit Price</th>
                  <th className="pb-3 font-medium text-right">Discount</th>
                  <th className="pb-3 font-medium text-right">Line Total</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {contractProducts.map((cp) => {
                  const unitPrice = cp.unitPrice ?? cp.product?.basePrice ?? 0;
                  const discount = Number(cp.discount ?? 0);
                  const lineTotal = Number(unitPrice) * cp.quantity * (1 - discount);
                  return (
                    <tr key={cp.id} className="py-3 hover:bg-gray-50/50">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-gray-900">{cp.product?.name ?? cp.productId}</p>
                        {cp.unitPrice != null && (
                          <p className="text-xs text-teal-600">Custom price</p>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-gray-500 capitalize text-xs">
                        {cp.product?.category?.replace(/_/g, " ") ?? "—"}
                      </td>
                      <td className="py-3 pr-4 text-right font-medium">{cp.quantity}</td>
                      <td className="py-3 pr-4 text-right">
                        <CurrencyDisplay amount={Number(unitPrice)} />
                        {cp.unitPrice == null && (
                          <span className="text-xs text-gray-400 block">base price</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {discount > 0 ? (
                          <span className="text-green-600 font-medium">{(discount * 100).toFixed(0)}%</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold">
                        <CurrencyDisplay amount={lineTotal} />
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleRemove(cp.productId)}
                          disabled={removeProduct.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-gray-50/50">
                  <td colSpan={5} className="pt-3 pl-1 text-sm font-semibold text-gray-600">Estimated subtotal</td>
                  <td className="pt-3 pr-4 text-right font-bold text-gray-900">
                    <CurrencyDisplay
                      amount={contractProducts.reduce((sum, cp) => {
                        const up = Number(cp.unitPrice ?? cp.product?.basePrice ?? 0);
                        return sum + up * cp.quantity * (1 - Number(cp.discount ?? 0));
                      }, 0)}
                    />
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ContractDetailsRoute() {
  const params = useParams();
  const contractId = params.id!;

  const { data, isLoading } = useContract(contractId);
  const contract = data?.data as any;

  if (isLoading) {
    return (
      <AppShell>
        <PageLoader message="Loading contract details..." />
      </AppShell>
    );
  }

  if (!contract) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold">Contract not found</h2>
          <Link to="/contracts">
            <Button className="mt-4">Back to Contracts</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const colorMap: Record<string, "green" | "gray" | "yellow" | "red" | "blue"> = {
    draft: "gray",
    active: "green",
    expired: "yellow",
    cancelled: "red",
    renewed: "blue",
  };

  return (
    <AppShell>
      <PageHeader
        title={contract.contractNumber}
        description={`${contract.billingFrequency.replace(/_/g, " ")} contract • ${contract.account?.accountName || contract.accountId}`}
        actions={
          <Link to={`/contracts/${contractId}/edit`}>
            <Button className="hover:scale-105 active:scale-95 transition-transform duration-200">
              <Edit className="mr-2 h-4 w-4" />
              Edit Contract
            </Button>
          </Link>
        }
      />

      <div className="flex items-center gap-3 mt-6 mb-8">
        <StatusBadge status={contract.status} color={colorMap[contract.status]} />
        <span className="text-gray-400">•</span>
        <span className="text-sm text-gray-600 flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <DateDisplay date={contract.startDate} /> - <DateDisplay date={contract.endDate} />
        </span>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-white border shadow-sm">
          <TabsTrigger value="overview" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
            Overview
          </TabsTrigger>
          <TabsTrigger value="billing" className="data-[state=active]:bg-green-50 data-[state=active]:text-green-700">
            Billing
          </TabsTrigger>
          <TabsTrigger value="invoices" className="data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700">
            Invoices
          </TabsTrigger>
          <TabsTrigger value="products" className="data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700">
            Products
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Basic Information Card */}
            <Card className="overflow-hidden border-0 shadow-lg">
              <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-600" />
              <CardHeader className="bg-gradient-to-br from-blue-50 to-indigo-50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-900">Contract Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-6 p-6">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <Building className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 mb-1">Account</p>
                    <Link
                      to={`/accounts/${contract.accountId}`}
                      className="text-base font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {contract.account?.accountName || contract.accountId}
                    </Link>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 mb-1">Contract Value</p>
                    <p className="text-lg font-bold text-gray-900">
                      <CurrencyDisplay amount={contract.contractValue} />
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <Calendar className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 mb-1">Start Date</p>
                    <p className="text-base font-medium text-gray-900">
                      <DateDisplay date={contract.startDate} />
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <Calendar className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 mb-1">End Date</p>
                    <p className="text-base font-medium text-gray-900">
                      <DateDisplay date={contract.endDate} />
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Seat-Based Pricing Card */}
            {(contract.seatCount || contract.committedSeats || contract.seatPrice) && (
              <Card className="overflow-hidden border-0 shadow-lg">
                <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-600" />
                <CardHeader className="bg-gradient-to-br from-emerald-50 to-teal-50">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                      <User className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-xl font-bold text-gray-900">Seat Licensing</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  {contract.seatCount && (
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-1">
                        <User className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-600 mb-1">Current Seats</p>
                        <p className="text-lg font-bold text-gray-900">{contract.seatCount} users</p>
                      </div>
                    </div>
                  )}
                  {contract.committedSeats && (
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0 mt-1">
                        <CheckCircle className="h-4 w-4 text-teal-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-600 mb-1">Committed Seats</p>
                        <p className="text-lg font-bold text-gray-900">{contract.committedSeats} users</p>
                      </div>
                    </div>
                  )}
                  {contract.seatPrice && (
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0 mt-1">
                        <DollarSign className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-600 mb-1">Price Per Seat</p>
                        <p className="text-lg font-bold text-gray-900">
                          <CurrencyDisplay amount={contract.seatPrice} />
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Renewal Configuration Card */}
            <Card className="overflow-hidden border-0 shadow-lg">
              <div className="h-2 bg-gradient-to-r from-amber-500 to-orange-600" />
              <CardHeader className="bg-gradient-to-br from-amber-50 to-orange-50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-500 flex items-center justify-center">
                    <RefreshCw className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-900">Renewal Settings</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-1">
                    {contract.autoRenew ? (
                      <CheckCircle className="h-4 w-4 text-amber-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 mb-1">Auto-Renewal</p>
                    <p className="text-base font-medium text-gray-900">
                      {contract.autoRenew ? "Enabled" : "Disabled"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <Clock className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 mb-1">Notice Period</p>
                    <p className="text-base font-medium text-gray-900">{contract.renewalNoticeDays} days before expiration</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Notes Section */}
          {contract.notes && (
            <Card className="mt-6 overflow-hidden border-0 shadow-lg">
              <div className="h-2 bg-gradient-to-r from-gray-400 to-gray-600" />
              <CardHeader className="bg-gradient-to-br from-gray-50 to-slate-50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gray-500 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-900">Contract Notes</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-base text-gray-700 whitespace-pre-wrap leading-relaxed">{contract.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="billing">
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="h-2 bg-gradient-to-r from-green-500 to-emerald-600" />
            <CardHeader className="bg-gradient-to-br from-green-50 to-emerald-50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-gray-900">Billing Configuration</CardTitle>
                  <CardDescription className="text-gray-600">Payment and billing settings for this contract</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Calendar className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Billing Frequency</p>
                  <p className="text-base font-medium text-gray-900 capitalize">
                    {contract.billingFrequency.replace(/_/g, " ")}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Payment Terms</p>
                  <p className="text-base font-medium text-gray-900">
                    {contract.paymentTerms.replace(/_/g, " ").toUpperCase()}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <TrendingUp className="h-4 w-4 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Billing Timing</p>
                  <p className="text-base font-medium text-gray-900">
                    {contract.billingInAdvance ? "In Advance" : "In Arrears"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <ContractInvoicesTab contractId={contractId} />
        </TabsContent>

        <TabsContent value="products">
          <ContractProductsTab contractId={contractId} />
        </TabsContent>

        <TabsContent value="products">
          <ContractProductsTab contractId={contractId} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
