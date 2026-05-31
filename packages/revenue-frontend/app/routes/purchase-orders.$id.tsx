/**
 * Purchase Order Detail Route
 * Shows all PO details, status timeline, and approve/reject/cancel actions
 */

import { useParams, Link } from "react-router";
import { toast } from "sonner";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { PageLoader } from "~/components/page-loader";
import { StatusBadge } from "~/components/status-badge";
import { DateDisplay } from "~/components/date-display";
import { CurrencyDisplay } from "~/components/currency-display";
import {
  usePurchaseOrder,
  useApprovePurchaseOrder,
  useRejectPurchaseOrder,
  useCancelPurchaseOrder,
  type POStatus,
} from "~/lib/api/hooks/use-purchase-orders";
import {
  ShoppingCart,
  Building2,
  FileText,
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  ArrowLeft,
  StickyNote,
} from "lucide-react";

const STATUS_COLOR_MAP: Record<
  POStatus,
  "green" | "gray" | "yellow" | "red" | "blue"
> = {
  pending_approval: "yellow",
  approved: "green",
  rejected: "red",
  fulfilled: "blue",
  cancelled: "gray",
};

// A simple timeline entry component
function TimelineEntry({
  icon: Icon,
  label,
  value,
  gradientFrom,
  gradientTo,
  iconBg,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
  gradientFrom: string;
  gradientTo: string;
  iconBg: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div
        className={`h-8 w-8 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}
      >
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export default function PurchaseOrderDetailRoute() {
  const { id } = useParams();
  const { data, isLoading } = usePurchaseOrder(id!);
  const approve = useApprovePurchaseOrder();
  const reject = useRejectPurchaseOrder();
  const cancel = useCancelPurchaseOrder();

  const po = data?.data as any;

  if (isLoading) {
    return (
      <AppShell>
        <PageLoader message="Loading purchase order..." />
      </AppShell>
    );
  }

  if (!po) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-gray-900">
            Purchase order not found
          </h2>
          <Link to="/purchase-orders">
            <Button className="mt-4">Back to Purchase Orders</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const handleApprove = async () => {
    try {
      await approve.mutateAsync(po.id);
      toast.success("Purchase order approved");
    } catch {
      toast.error("Failed to approve purchase order");
    }
  };

  const handleReject = async () => {
    try {
      await reject.mutateAsync({ id: po.id });
      toast.error("Purchase order rejected");
    } catch {
      toast.error("Failed to reject purchase order");
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this purchase order?")) return;
    try {
      await cancel.mutateAsync(po.id);
      toast.success("Purchase order cancelled");
      window.location.href = "/purchase-orders";
    } catch {
      toast.error("Failed to cancel purchase order");
    }
  };

  const isPending = po.status === "pending_approval";

  return (
    <AppShell>
      <PageHeader
        title={po.poNumber}
        description={`Purchase order for ${po.account?.accountName || po.accountId}`}
        actions={
          <div className="flex items-center gap-2">
            {isPending && (
              <>
                <Button
                  onClick={handleApprove}
                  disabled={approve.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white hover:scale-105 active:scale-95 transition-transform duration-200"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReject}
                  disabled={reject.isPending}
                  className="border-red-300 text-red-700 hover:bg-red-50 hover:scale-105 active:scale-95 transition-transform duration-200"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </>
            )}
            {po.status !== "cancelled" && po.status !== "fulfilled" && (
              <Button
                variant="ghost"
                onClick={handleCancel}
                disabled={cancel.isPending}
                className="text-gray-500 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            )}
            <Link to="/purchase-orders">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
          </div>
        }
      />

      {/* Status badge */}
      <div className="flex items-center gap-3 mt-6 mb-8">
        <StatusBadge
          status={po.status}
          color={STATUS_COLOR_MAP[po.status as POStatus] ?? "gray"}
        />
        <span className="text-gray-400">•</span>
        <span className="text-sm text-gray-600 flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          Issued <DateDisplay date={po.issueDate} />
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Main Details Card */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="h-2 bg-gradient-to-r from-violet-500 to-purple-600" />
          <CardHeader className="bg-gradient-to-br from-violet-50 to-purple-50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-violet-500 flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-gray-900">
                Purchase Order Details
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            {/* Account */}
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Building2 className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Account
                </p>
                <Link
                  to={`/accounts/${po.accountId}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {po.account?.accountName || po.accountId}
                </Link>
              </div>
            </div>

            {/* Contract */}
            {po.contractId && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FileText className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Linked Contract
                  </p>
                  <Link
                    to={`/contracts/${po.contractId}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {po.contract?.contractNumber || po.contractId}
                  </Link>
                </div>
              </div>
            )}

            {/* Amount */}
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Amount
                </p>
                <p className="text-lg font-bold text-gray-900">
                  <CurrencyDisplay amount={po.amount} currency={po.currency} />
                </p>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Calendar className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Issue Date
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    <DateDisplay date={po.issueDate} />
                  </p>
                </div>
              </div>
              {po.expiryDate && (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Expiry Date
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      <DateDisplay date={po.expiryDate} />
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            {po.description && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <StickyNote className="h-4 w-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Description
                  </p>
                  <p className="text-sm text-gray-700">{po.description}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Timeline Card */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="h-2 bg-gradient-to-r from-indigo-500 to-blue-600" />
          <CardHeader className="bg-gradient-to-br from-indigo-50 to-blue-50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-500 flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-gray-900">
                Status Timeline
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            {/* Created */}
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <ShoppingCart className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Created
                </p>
                <p className="text-sm font-medium text-gray-900">
                  <DateDisplay date={po.createdAt} />
                </p>
              </div>
            </div>

            {/* Approved */}
            {po.approvedAt && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Approved
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    <DateDisplay date={po.approvedAt} />
                    {po.approvedBy && (
                      <span className="ml-2 text-gray-500">
                        by {po.approvedBy}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Rejected */}
            {po.rejectedAt && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <XCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Rejected
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    <DateDisplay date={po.rejectedAt} />
                    {po.rejectedBy && (
                      <span className="ml-2 text-gray-500">
                        by {po.rejectedBy}
                      </span>
                    )}
                  </p>
                  {po.rejectionReason && (
                    <p className="text-sm text-red-600 mt-1">
                      Reason: {po.rejectionReason}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Pending state */}
            {po.status === "pending_approval" && (
              <div className="mt-4 p-4 rounded-lg border-2 border-dashed border-yellow-200 bg-yellow-50">
                <p className="text-sm font-semibold text-yellow-800">
                  Awaiting approval
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  Use the Approve or Reject buttons above to take action
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {po.notes && (
        <Card className="mt-6 overflow-hidden border-0 shadow-lg">
          <div className="h-2 bg-gradient-to-r from-gray-400 to-gray-600" />
          <CardHeader className="bg-gradient-to-br from-gray-50 to-slate-50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gray-500 flex items-center justify-center">
                <StickyNote className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-gray-900">Notes</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-base text-gray-700 whitespace-pre-wrap leading-relaxed">
              {po.notes}
            </p>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
