/**
 * Analytics Dashboard Route
 * MRR, ARR, churn, and bookings metrics from the analytics API
 */

import { useState } from "react";
import { TrendingUp, TrendingDown, FileText, Building2, Calendar } from "lucide-react";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import {
  useAnalyticsSummary,
  useAnalyticsChurn,
  useAnalyticsBookings,
} from "~/lib/api/hooks/use-analytics";
import { useConfigStore } from "~/lib/stores/config-store";

function MetricCard({
  title,
  value,
  description,
  gradient,
  icon: Icon,
  isLoading,
}: {
  title: string;
  value: string;
  description: string;
  gradient: string;
  icon: React.ComponentType<{ className?: string }>;
  isLoading?: boolean;
}) {
  return (
    <Card className="overflow-hidden border-0 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className={`h-2 bg-gradient-to-r ${gradient}`} />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className="h-10 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </>
        ) : (
          <>
            <div className="text-4xl font-bold text-gray-900 tracking-tight mb-2">
              {value}
            </div>
            <p className="text-sm text-gray-500">{description}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function AnalyticsDashboardRoute() {
  const { defaultCurrency } = useConfigStore();
  const { data: summaryData, isLoading: summaryLoading } = useAnalyticsSummary();

  // Date range state for churn
  const [churnStart, setChurnStart] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth() - 3, 1)
      .toISOString()
      .split("T")[0]
  );
  const [churnEnd, setChurnEnd] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [churnParams, setChurnParams] = useState<Record<string, string>>({
    "startDate[gte]": churnStart,
    "endDate[lte]": churnEnd,
  });

  // Date range state for bookings
  const [bookingsStart, setBookingsStart] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]
  );
  const [bookingsEnd, setBookingsEnd] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [bookingsParams, setBookingsParams] = useState<Record<string, string>>({
    "startDate[gte]": bookingsStart,
    "endDate[lte]": bookingsEnd,
  });

  const { data: churnData, isLoading: churnLoading } =
    useAnalyticsChurn(churnParams);
  const { data: bookingsData, isLoading: bookingsLoading } =
    useAnalyticsBookings(bookingsParams);

  const summary = summaryData?.data as any;
  const churn = churnData?.data as any;
  const bookings = bookingsData?.data as any;

  const formatCurrency = (value: number, currency?: string) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || defaultCurrency,
      maximumFractionDigits: 0,
    }).format(value);

  const applyChurnFilter = () => {
    setChurnParams({
      "startDate[gte]": churnStart,
      "endDate[lte]": churnEnd,
    });
  };

  const applyBookingsFilter = () => {
    setBookingsParams({
      "startDate[gte]": bookingsStart,
      "endDate[lte]": bookingsEnd,
    });
  };

  return (
    <AppShell>
      <PageHeader
        title="Analytics"
        description="Revenue metrics, churn analysis, and bookings"
      />

      {/* Key Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mt-6">
        <MetricCard
          title="Monthly Recurring Revenue"
          value={summary ? formatCurrency(summary.mrr, summary.currency) : "—"}
          description="Current MRR from active contracts"
          gradient="from-blue-500 to-indigo-600"
          icon={TrendingUp}
          isLoading={summaryLoading}
        />
        <MetricCard
          title="Annual Recurring Revenue"
          value={summary ? formatCurrency(summary.arr, summary.currency) : "—"}
          description="Annualized revenue from active contracts"
          gradient="from-emerald-500 to-green-600"
          icon={TrendingUp}
          isLoading={summaryLoading}
        />
        <MetricCard
          title="Active Contracts"
          value={summary ? String(summary.activeContracts) : "—"}
          description="Currently active contract count"
          gradient="from-violet-500 to-purple-600"
          icon={FileText}
          isLoading={summaryLoading}
        />
        <MetricCard
          title="Total Accounts"
          value={summary ? String(summary.totalAccounts) : "—"}
          description="Total enterprise accounts"
          gradient="from-amber-500 to-orange-600"
          icon={Building2}
          isLoading={summaryLoading}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 mt-8">
        {/* Churn Analysis */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="h-2 bg-gradient-to-r from-red-500 to-rose-600" />
          <CardHeader className="bg-gradient-to-br from-red-50 to-rose-50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">
                  Churn Analysis
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Contracts lost in a date range
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            {/* Date Filters */}
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label className="flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  <Calendar className="h-3 w-3" />
                  From
                </Label>
                <Input
                  type="date"
                  value={churnStart}
                  onChange={(e) => setChurnStart(e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label className="flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  <Calendar className="h-3 w-3" />
                  To
                </Label>
                <Input
                  type="date"
                  value={churnEnd}
                  onChange={(e) => setChurnEnd(e.target.value)}
                />
              </div>
              <Button
                onClick={applyChurnFilter}
                variant="outline"
                className="border-red-200 text-red-700 hover:bg-red-50"
              >
                Apply
              </Button>
            </div>

            {/* Churn Metrics */}
            {churnLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : churn ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-red-50 border border-red-100">
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">
                    Churned Contracts
                  </p>
                  <p className="text-3xl font-bold text-red-800">
                    {churn.churnedContracts ?? "—"}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-rose-50 border border-rose-100">
                  <p className="text-xs font-semibold text-rose-600 uppercase tracking-wide mb-1">
                    Churned ARR
                  </p>
                  <p className="text-3xl font-bold text-rose-800">
                    {churn.churnedARR != null
                      ? formatCurrency(churn.churnedARR, churn.currency)
                      : "—"}
                  </p>
                </div>
                {churn.churnRate != null && (
                  <div className="col-span-2 p-4 rounded-lg bg-gray-50 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                      Churn Rate
                    </p>
                    <p className="text-3xl font-bold text-gray-800">
                      {(churn.churnRate * 100).toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                No churn data available for this period
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bookings */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="h-2 bg-gradient-to-r from-teal-500 to-cyan-600" />
          <CardHeader className="bg-gradient-to-br from-teal-50 to-cyan-50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-teal-500 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">
                  Bookings
                </CardTitle>
                <CardDescription className="text-gray-600">
                  New contracts and total bookings value
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            {/* Date Filters */}
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label className="flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  <Calendar className="h-3 w-3" />
                  From
                </Label>
                <Input
                  type="date"
                  value={bookingsStart}
                  onChange={(e) => setBookingsStart(e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label className="flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  <Calendar className="h-3 w-3" />
                  To
                </Label>
                <Input
                  type="date"
                  value={bookingsEnd}
                  onChange={(e) => setBookingsEnd(e.target.value)}
                />
              </div>
              <Button
                onClick={applyBookingsFilter}
                variant="outline"
                className="border-teal-200 text-teal-700 hover:bg-teal-50"
              >
                Apply
              </Button>
            </div>

            {/* Bookings Metrics */}
            {bookingsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : bookings ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-teal-50 border border-teal-100">
                  <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1">
                    New Contracts
                  </p>
                  <p className="text-3xl font-bold text-teal-800">
                    {bookings.newContracts ?? "—"}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-cyan-50 border border-cyan-100">
                  <p className="text-xs font-semibold text-cyan-600 uppercase tracking-wide mb-1">
                    Total Bookings
                  </p>
                  <p className="text-3xl font-bold text-cyan-800">
                    {bookings.totalBookings != null
                      ? formatCurrency(bookings.totalBookings, bookings.currency)
                      : "—"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                No bookings data available for this period
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
