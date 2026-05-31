/**
 * Dashboard Route
 * Main dashboard page with real-time metrics
 */

import { Link } from "react-router";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Building2,
  FileText,
  Receipt,
  TrendingUp,
  Zap,
  FileSpreadsheet,
  BarChart3,
} from "lucide-react";
import {
  useDashboardStats,
  useRecentActivity,
  useExpiringContracts
} from "~/lib/api/hooks/use-dashboard";
import { formatDistanceToNow } from "date-fns";
import { useConfigStore } from "~/lib/stores/config-store";

export default function Dashboard() {
  const { defaultCurrency } = useConfigStore();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: defaultCurrency, maximumFractionDigits: 0 }).format(value);
  const { data: activities, isLoading: activitiesLoading } = useRecentActivity();
  const { data: expiringContracts, isLoading: contractsLoading } = useExpiringContracts();

  // Stats configuration with real data — 5 cards (2+3 grid on large)
  const statsConfig = [
    {
      title: "Total Accounts",
      value: stats?.totalAccounts.toString() || "0",
      description: "Active enterprise accounts",
      gradient: "from-blue-500 to-blue-600",
      icon: Building2,
    },
    {
      title: "Active Contracts",
      value: stats?.activeContracts.toString() || "0",
      description: "Currently active contracts",
      gradient: "from-green-500 to-green-600",
      icon: FileText,
    },
    {
      title: "Pending Invoices",
      value: stats?.pendingInvoices.count.toString() || "0",
      description: `${formatCurrency(stats?.pendingInvoices.totalValue || 0)} total value`,
      gradient: "from-amber-500 to-amber-600",
      icon: Receipt,
    },
    {
      title: "MRR",
      value: stats?.mrr != null ? formatCurrency(stats.mrr) : formatCurrency(stats?.monthlyRevenue || 0),
      description: "Monthly recurring revenue",
      gradient: "from-purple-500 to-purple-600",
      icon: TrendingUp,
    },
    {
      title: "ARR",
      value: stats?.arr != null ? formatCurrency(stats.arr) : "—",
      description: "Annual recurring revenue",
      gradient: "from-indigo-500 to-violet-600",
      icon: BarChart3,
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        description="Overview of your revenue management system"
      />

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 mt-6">
        {statsLoading ? (
          // Loading skeletons
          Array.from({ length: 5 }).map((_, index) => (
            <Card key={index} className="overflow-hidden border-0 shadow-lg">
              <div className={`h-2 bg-gradient-to-r ${statsConfig[index].gradient}`} />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-10 rounded-lg" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-20 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))
        ) : (
          // Real stats
          statsConfig.map((stat, index) => {
            return (
              <Card
                key={stat.title}
                className="overflow-hidden border-0 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <div className={`h-2 bg-gradient-to-r ${stat.gradient}`} />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.gradient} bg-opacity-10`}>
                    <stat.icon className="h-5 w-5 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-gray-900 tracking-tight mb-2">{stat.value}</div>
                  <p className="text-sm text-gray-500">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Quick Actions */}
      <Card className="mt-8 shadow-lg border-0">
        <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-purple-600" />
            <CardTitle className="text-2xl font-bold text-gray-900">Quick Actions</CardTitle>
          </div>
          <CardDescription className="text-base text-gray-600">
            Common tasks to get you started quickly
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link to="/accounts/new">
              <Button
                variant="outline"
                className="w-full h-24 flex flex-col gap-2 hover:bg-blue-50 hover:border-blue-300 hover:scale-105 active:scale-95 transition-all duration-200"
              >
                <Building2 className="h-8 w-8 text-blue-600" />
                <span className="font-semibold text-gray-900">New Account</span>
              </Button>
            </Link>
            <Link to="/contracts/new">
              <Button
                variant="outline"
                className="w-full h-24 flex flex-col gap-2 hover:bg-green-50 hover:border-green-300 hover:scale-105 active:scale-95 transition-all duration-200"
              >
                <FileText className="h-8 w-8 text-green-600" />
                <span className="font-semibold text-gray-900">New Contract</span>
              </Button>
            </Link>
            <Link to="/invoices/new">
              <Button
                variant="outline"
                className="w-full h-24 flex flex-col gap-2 hover:bg-amber-50 hover:border-amber-300 hover:scale-105 active:scale-95 transition-all duration-200"
              >
                <Receipt className="h-8 w-8 text-amber-600" />
                <span className="font-semibold text-gray-900">New Invoice</span>
              </Button>
            </Link>
            <Link to="/billing/generate">
              <Button
                variant="outline"
                className="w-full h-24 flex flex-col gap-2 hover:bg-purple-50 hover:border-purple-300 hover:scale-105 active:scale-95 transition-all duration-200"
              >
                <FileSpreadsheet className="h-8 w-8 text-purple-600" />
                <span className="font-semibold text-gray-900">Generate Billing</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7 mt-8">
        {/* Recent Activity */}
        <Card className="col-span-4 shadow-lg border-0">
          <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardTitle className="text-2xl font-bold text-gray-900">Recent Activity</CardTitle>
            <CardDescription className="text-base text-gray-600">
              Latest updates from your revenue system
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {activitiesLoading ? (
              // Loading skeletons
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-64" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            ) : activities && activities.length > 0 ? (
              // Real activity data
              <div className="space-y-0 relative before:absolute before:left-6 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-green-200 before:via-blue-200 before:to-purple-200">
                {activities.map((activity, index) => {
                  const iconGradients = [
                    "from-green-500 to-emerald-600",
                    "from-blue-500 to-indigo-600",
                    "from-purple-500 to-pink-600",
                    "from-amber-500 to-orange-600",
                    "from-cyan-500 to-blue-600",
                  ];

                  const IconComponent =
                    activity.icon === "receipt" ? Receipt :
                    activity.icon === "file-text" ? FileText :
                    Building2;

                  return (
                    <div
                      key={activity.id}
                      className="flex items-center p-4 rounded-lg hover:bg-blue-50 hover:translate-x-1 transition-all duration-200 cursor-pointer relative"
                    >
                      <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${iconGradients[index % iconGradients.length]} flex items-center justify-center shadow-md relative z-10 ring-4 ring-white`}>
                        <IconComponent className="h-6 w-6 text-white" />
                      </div>
                      <div className="ml-4 space-y-1 flex-1">
                        <p className="text-base font-bold text-gray-900 leading-none">
                          {activity.title}
                        </p>
                        <p className="text-sm text-gray-600">
                          {activity.description}
                        </p>
                      </div>
                      <div className="ml-auto text-xs text-gray-400 font-semibold">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Empty state
              <div className="text-center py-12">
                <p className="text-gray-500">No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contract Expiration Alerts */}
        <Card className="col-span-3 shadow-lg border-0">
          <CardHeader className="border-b bg-gradient-to-r from-amber-50 to-orange-50">
            <CardTitle className="text-2xl font-bold text-gray-900">Contract Expiration Alerts</CardTitle>
            <CardDescription className="text-base text-gray-600">
              Contracts expiring in the next 30 days
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {contractsLoading ? (
              // Loading skeletons
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-4 rounded-lg border-2">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))}
              </div>
            ) : expiringContracts && expiringContracts.length > 0 ? (
              // Real expiring contracts
              <div className="space-y-3">
                {expiringContracts.map((contract) => {
                  const urgencyConfig = {
                    urgent: {
                      border: "border-red-200",
                      bg: "bg-red-50",
                      hoverBg: "hover:bg-red-100",
                      textColor: "text-red-900",
                      subTextColor: "text-red-600",
                      badge: "bg-red-500",
                      label: "URGENT",
                    },
                    soon: {
                      border: "border-amber-200",
                      bg: "bg-amber-50",
                      hoverBg: "hover:bg-amber-100",
                      textColor: "text-amber-900",
                      subTextColor: "text-amber-600",
                      badge: "bg-amber-500",
                      label: "SOON",
                    },
                    watch: {
                      border: "border-yellow-200",
                      bg: "bg-yellow-50",
                      hoverBg: "hover:bg-yellow-100",
                      textColor: "text-yellow-900",
                      subTextColor: "text-yellow-600",
                      badge: "bg-yellow-500",
                      label: "WATCH",
                    },
                  };

                  const config = urgencyConfig[contract.urgency];

                  return (
                    <Link key={contract.id} to={`/contracts/${contract.id}`}>
                      <div className={`flex items-center justify-between p-4 rounded-lg border-2 ${config.border} ${config.bg} ${config.hoverBg} hover:shadow-md transition-all duration-200 cursor-pointer`}>
                        <div className="space-y-1">
                          <p className={`text-base font-bold leading-none ${config.textColor}`}>
                            {contract.accountName}
                          </p>
                          <p className={`text-sm font-medium ${config.subTextColor}`}>
                            Expires in {contract.daysUntilExpiry} days
                          </p>
                        </div>
                        <span className={`px-3 py-1.5 text-xs font-bold ${config.badge} text-white rounded-full shadow-sm`}>
                          {config.label}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              // Empty state
              <div className="text-center py-12">
                <p className="text-gray-500">No contracts expiring soon</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
