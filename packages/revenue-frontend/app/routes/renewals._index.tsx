/**
 * Renewals Route
 * Two-section page: expiring soon + overdue contracts with renew actions
 */

import { Link } from "react-router";
import { toast } from "sonner";
import { RefreshCw, AlertCircle, Clock } from "lucide-react";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import { CurrencyDisplay } from "~/components/currency-display";
import { DateDisplay } from "~/components/date-display";
import {
  useUpcomingRenewals,
  useOverdueRenewals,
  useRenewContract,
} from "~/lib/api/hooks/use-renewals";

function RenewButton({
  contractId,
  onSuccess,
}: {
  contractId: string;
  onSuccess?: () => void;
}) {
  const renew = useRenewContract();

  const handleRenew = async () => {
    if (!confirm("Renew this contract now?")) return;
    try {
      await renew.mutateAsync({ contractId });
      toast.success("Contract renewed successfully");
      onSuccess?.();
    } catch {
      toast.error("Failed to renew contract");
    }
  };

  return (
    <Button
      size="sm"
      onClick={handleRenew}
      disabled={renew.isPending}
      className="hover:scale-105 active:scale-95 transition-transform duration-200 whitespace-nowrap"
    >
      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
      Renew Now
    </Button>
  );
}

export default function RenewalsRoute() {
  const { data: upcomingData, isLoading: upcomingLoading } =
    useUpcomingRenewals();
  const { data: overdueData, isLoading: overdueLoading } = useOverdueRenewals();

  const upcoming = Array.isArray(upcomingData?.data)
    ? upcomingData.data
    : [];
  const overdue = Array.isArray(overdueData?.data)
    ? overdueData.data
    : [];

  return (
    <AppShell>
      <PageHeader
        title="Renewals"
        description="Track upcoming and overdue contract renewals"
      />

      <div className="mt-6 space-y-8">
        {/* Expiring Soon Section */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="h-2 bg-gradient-to-r from-amber-500 to-orange-600" />
          <CardHeader className="bg-gradient-to-br from-amber-50 to-orange-50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500 flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  Expiring Soon
                  {!upcomingLoading && upcoming.length > 0 && (
                    <Badge
                      variant="outline"
                      className="ml-1 bg-amber-50 text-amber-700 border-amber-200"
                    >
                      {upcoming.length}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Contracts expiring in the next 90 days
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {upcomingLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : upcoming.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-amber-100 flex items-center justify-center">
                  <Clock className="h-8 w-8 text-amber-300" />
                </div>
                <p className="text-sm font-semibold text-gray-700">
                  No upcoming renewals
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  All contracts are in good standing
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left text-gray-500">
                      <th className="px-6 py-3 font-medium">Contract</th>
                      <th className="px-6 py-3 font-medium">Account</th>
                      <th className="px-6 py-3 font-medium">End Date</th>
                      <th className="px-6 py-3 font-medium">Days Until Expiry</th>
                      <th className="px-6 py-3 font-medium">Value</th>
                      <th className="px-6 py-3 font-medium">Auto-Renew</th>
                      <th className="px-6 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(upcoming as any[]).map((renewal) => {
                      const daysLeft = renewal.daysUntilExpiry;
                      const urgency =
                        daysLeft <= 14
                          ? "urgent"
                          : daysLeft <= 30
                          ? "soon"
                          : "watch";
                      const urgencyStyles = {
                        urgent: "text-red-700 font-bold",
                        soon: "text-amber-700 font-semibold",
                        watch: "text-yellow-700",
                      };

                      return (
                        <tr
                          key={renewal.contractId}
                          className="hover:bg-amber-50/30 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <Link
                              to={`/contracts/${renewal.contractId}`}
                              className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {renewal.contractNumber}
                            </Link>
                          </td>
                          <td className="px-6 py-4">
                            <Link
                              to={`/accounts/${renewal.accountId}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {renewal.accountName}
                            </Link>
                          </td>
                          <td className="px-6 py-4 text-gray-700">
                            <DateDisplay date={renewal.endDate} />
                          </td>
                          <td className="px-6 py-4">
                            <span className={urgencyStyles[urgency]}>
                              {daysLeft} days
                            </span>
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-900">
                            <CurrencyDisplay
                              amount={renewal.contractValue}
                              currency={renewal.currency}
                            />
                          </td>
                          <td className="px-6 py-4">
                            <Badge
                              variant="outline"
                              className={
                                renewal.autoRenew
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : "bg-gray-50 text-gray-600 border-gray-200"
                              }
                            >
                              {renewal.autoRenew ? "Yes" : "No"}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <RenewButton contractId={renewal.contractId} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overdue Section */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="h-2 bg-gradient-to-r from-red-500 to-rose-600" />
          <CardHeader className="bg-gradient-to-br from-red-50 to-rose-50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  Overdue Renewals
                  {!overdueLoading && overdue.length > 0 && (
                    <Badge
                      variant="outline"
                      className="ml-1 bg-red-50 text-red-700 border-red-200"
                    >
                      {overdue.length}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Contracts that have already expired
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {overdueLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : overdue.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-green-300" />
                </div>
                <p className="text-sm font-semibold text-gray-700">
                  No overdue renewals
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  No contracts have expired without renewal
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left text-gray-500">
                      <th className="px-6 py-3 font-medium">Contract</th>
                      <th className="px-6 py-3 font-medium">Account</th>
                      <th className="px-6 py-3 font-medium">Expired On</th>
                      <th className="px-6 py-3 font-medium">Days Overdue</th>
                      <th className="px-6 py-3 font-medium">Value</th>
                      <th className="px-6 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(overdue as any[]).map((renewal) => (
                      <tr
                        key={renewal.contractId}
                        className="hover:bg-red-50/30 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <Link
                            to={`/contracts/${renewal.contractId}`}
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {renewal.contractNumber}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            to={`/accounts/${renewal.accountId}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {renewal.accountName}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          <DateDisplay date={renewal.endDate} />
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-red-700 font-bold">
                            {renewal.daysOverdue} days
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">
                          <CurrencyDisplay
                            amount={renewal.contractValue}
                            currency={renewal.currency}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <RenewButton contractId={renewal.contractId} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
