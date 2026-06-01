/**
 * Account Details Route
 * Displays account details, contracts, and invoices
 */

import { useParams, Link } from "react-router";
import { Edit, Building, CreditCard, Mail, Phone, MapPin, DollarSign, Calendar, User, FileText, Zap } from "lucide-react";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { PageLoader } from "~/components/page-loader";
import { StatusBadge } from "~/components/status-badge";
import { useAccount } from "~/lib/api/hooks/use-accounts";
import { useContracts } from "~/lib/api/hooks/use-contracts";
import { useWebhooks } from "~/lib/api/hooks/use-webhooks";
import type { WebhookEndpoint } from "~/types/models";
import { Skeleton } from "~/components/ui/skeleton";
import { CurrencyDisplay } from "~/components/currency-display";

export default function AccountDetailsRoute() {
  const params = useParams();
  const accountId = params.id!;

  const { data, isLoading } = useAccount(accountId);
  const account = data?.data as any;

  // Fetch contracts for this account
  const { data: contractsData, isLoading: contractsLoading } = useContracts({
    "accountId[eq]": accountId,
  });

  const { data: webhooksData } = useWebhooks({ "accountId[eq]": accountId });
  const accountWebhooks = (webhooksData?.data as WebhookEndpoint[]) ?? [];

  if (isLoading) {
    return (
      <AppShell>
        <PageLoader message="Loading account details..." />
      </AppShell>
    );
  }

  if (!account) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold">Account not found</h2>
          <p className="text-muted-foreground mt-2">
            The account you're looking for doesn't exist.
          </p>
          <Link to="/accounts">
            <Button className="mt-4">Back to Accounts</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const colorMap: Record<string, "green" | "gray" | "red"> = {
    active: "green",
    inactive: "gray",
    suspended: "red",
  };

  return (
    <AppShell>
      <PageHeader
        title={account.accountName}
        description={`Account ID: ${account.id}`}
        actions={
          <Link to={`/accounts/${accountId}/edit`}>
            <Button className="hover:scale-105 active:scale-95 transition-transform duration-200">
              <Edit className="mr-2 h-4 w-4" />
              Edit Account
            </Button>
          </Link>
        }
      />

      <Tabs defaultValue="details" className="mt-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="webhooks">
            <Zap className="h-4 w-4 mr-1" />Webhooks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          {/* Basic Information */}
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-600" />
            <CardHeader className="bg-gradient-to-br from-blue-50 to-indigo-50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500 flex items-center justify-center">
                  <Building className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl font-bold text-gray-900">Basic Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-6 p-6">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Building className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">
                    Account Type
                  </p>
                  <p className="text-base font-medium text-gray-900 capitalize">{account.accountType}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Calendar className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">
                    Status
                  </p>
                  <StatusBadge
                    status={account.status}
                    color={colorMap[account.status]}
                  />
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Mail className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">
                    Primary Contact
                  </p>
                  <p className="text-base font-medium text-gray-900">{account.primaryContactEmail}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <DollarSign className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">
                    Currency
                  </p>
                  <p className="text-base font-medium text-gray-900">{account.currency}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Terms */}
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="h-2 bg-gradient-to-r from-green-500 to-emerald-600" />
            <CardHeader className="bg-gradient-to-br from-green-50 to-emerald-50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl font-bold text-gray-900">Financial Terms</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-6 p-6">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Calendar className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">
                    Payment Terms
                  </p>
                  <p className="text-base font-medium text-gray-900">
                    {account.paymentTerms.replace(/_/g, " ").toUpperCase()}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">
                    Credit Limit
                  </p>
                  <p className="text-base font-medium text-gray-900">
                    {account.creditLimit
                      ? <CurrencyDisplay amount={account.creditLimit} currency={account.currency} />
                      : "Not set"}
                  </p>
                </div>
              </div>
              {account.taxId && (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <CreditCard className="h-4 w-4 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600 mb-1">
                      Tax ID
                    </p>
                    <p className="text-base font-medium text-gray-900">{account.taxId}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Billing Information */}
          {(account.billingContactName || account.billingAddressLine1) && (
            <Card className="overflow-hidden border-0 shadow-lg">
              <div className="h-2 bg-gradient-to-r from-purple-500 to-pink-600" />
              <CardHeader className="bg-gradient-to-br from-purple-50 to-pink-50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-500 flex items-center justify-center">
                    <CreditCard className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-900">Billing Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                {account.billingContactName && (
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-600">
                        Billing Contact
                      </p>
                      <p className="text-base font-medium text-gray-900">{account.billingContactName}</p>
                      {account.billingContactEmail && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="h-4 w-4" />
                          <span>{account.billingContactEmail}</span>
                        </div>
                      )}
                      {account.billingContactPhone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="h-4 w-4" />
                          <span>{account.billingContactPhone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {account.billingAddressLine1 && (
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-pink-100 flex items-center justify-center flex-shrink-0 mt-1">
                      <MapPin className="h-4 w-4 text-pink-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-600 mb-2">
                        Billing Address
                      </p>
                      <div className="text-base text-gray-900 space-y-1">
                        <p>{account.billingAddressLine1}</p>
                        {account.billingAddressLine2 && (
                          <p>{account.billingAddressLine2}</p>
                        )}
                        <p>
                          {[
                            account.billingCity,
                            account.billingState,
                            account.billingPostalCode,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                        {account.billingCountry && (
                          <p>{account.billingCountry}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="hierarchy">
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="h-2 bg-gradient-to-r from-amber-500 to-orange-600" />
            <CardHeader className="bg-gradient-to-br from-amber-50 to-orange-50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-500 flex items-center justify-center">
                  <Building className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-gray-900">Account Hierarchy</CardTitle>
                  <CardDescription className="text-gray-600">
                    Parent and child account relationships
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {account.parentAccountId ? (
                <div className="mb-6 p-4 rounded-lg bg-blue-50 border-2 border-blue-200">
                  <p className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Parent Account
                  </p>
                  <Link
                    to={`/accounts/${account.parentAccountId}`}
                    className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                  >
                    View Parent Account →
                  </Link>
                </div>
              ) : (
                <div className="mb-6 p-4 rounded-lg bg-gray-50 border-2 border-gray-200">
                  <p className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    This is a root account (no parent)
                  </p>
                </div>
              )}

              {account.children && account.children.length > 0 ? (
                <div>
                  <p className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Building className="h-5 w-5 text-amber-600" />
                    Child Accounts ({account.children.length})
                  </p>
                  <div className="space-y-3">
                    {account.children.map((child: any) => (
                      <Link
                        key={child.id}
                        to={`/accounts/${child.id}`}
                        className="block p-4 border-2 rounded-lg hover:border-amber-300 hover:bg-amber-50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                      >
                        <p className="text-base font-bold text-gray-900 mb-1">
                          {child.accountName}
                        </p>
                        <p className="text-sm text-gray-600 capitalize flex items-center gap-2">
                          <Building className="h-3 w-3" />
                          {child.accountType}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-gray-50 border-2 border-dashed border-gray-200">
                  <p className="text-sm text-gray-600">
                    No child accounts
                  </p>
                </div>
              )}

              <Link to={`/accounts/${accountId}/hierarchy`}>
                <Button variant="outline" className="mt-6 hover:scale-105 active:scale-95 transition-transform duration-200 w-full sm:w-auto">
                  <Building className="mr-2 h-4 w-4" />
                  View Full Hierarchy Tree
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts">
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="h-2 bg-gradient-to-r from-green-500 to-emerald-600" />
            <CardHeader className="bg-gradient-to-br from-green-50 to-emerald-50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl font-bold text-gray-900">Contracts</CardTitle>
                  <CardDescription className="text-gray-600">Active and historical contracts</CardDescription>
                </div>
                {!contractsLoading && contractsData?.data && contractsData.data.length > 0 && (
                  <Link to="/contracts/new">
                    <Button size="sm" className="hover:scale-105 active:scale-95 transition-transform duration-200">
                      New Contract
                    </Button>
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {contractsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-lg border">
                      <Skeleton className="h-12 w-12 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                      <Skeleton className="h-9 w-20" />
                    </div>
                  ))}
                </div>
              ) : contractsData?.data && contractsData.data.length > 0 ? (
                <div className="space-y-3">
                  {contractsData.data.map((contract: any) => (
                    <Link
                      key={contract.id}
                      to={`/contracts/${contract.id}`}
                      className="block p-4 rounded-lg border-2 border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all duration-200 hover:shadow-md"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                          <FileText className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <p className="font-bold text-gray-900">{contract.contractNumber}</p>
                            <StatusBadge status={contract.status || "active"} />
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4" />
                              <CurrencyDisplay amount={contract.contractValue} currency={account.currency} />
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              {contract.seatCount} seats
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {contract.billingFrequency}
                            </span>
                          </div>
                        </div>
                        <div className="text-right text-sm text-gray-600">
                          <div>
                            {new Date(contract.startDate).toLocaleDateString()} - {new Date(contract.endDate).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    <FileText className="h-10 w-10 text-gray-400" />
                  </div>
                  <p className="text-lg font-semibold text-gray-900 mb-2">No Contracts Yet</p>
                  <p className="text-sm text-gray-600 mb-6">
                    Create a contract to start tracking billing and revenue
                  </p>
                  <Link to="/contracts/new">
                    <Button className="hover:scale-105 active:scale-95 transition-transform duration-200">
                      Create First Contract
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-600" />
            <CardHeader className="bg-gradient-to-br from-blue-50 to-indigo-50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-gray-900">Invoices</CardTitle>
                  <CardDescription className="text-gray-600">All invoices for this account</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <CreditCard className="h-10 w-10 text-gray-400" />
                </div>
                <p className="text-lg font-semibold text-gray-900 mb-2">No Invoices Yet</p>
                <p className="text-sm text-gray-600 mb-6">
                  Invoice list will be displayed here once generated
                </p>
                <Link to="/invoices/new">
                  <Button className="hover:scale-105 active:scale-95 transition-transform duration-200">
                    Create First Invoice
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {accountWebhooks.length} webhook{accountWebhooks.length !== 1 ? "s" : ""} registered for this account
              </p>
              <Link to={`/webhooks?accountId=${accountId}`}>
                <Button variant="outline" size="sm">
                  <Zap className="h-4 w-4 mr-1" /> Manage Webhooks
                </Button>
              </Link>
            </div>
            {accountWebhooks.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                No webhooks registered for this account.
              </div>
            ) : (
              <div className="space-y-2">
                {accountWebhooks.map((wh) => (
                  <Link key={wh.id} to={`/webhooks/${wh.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-blue-600">{wh.url}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {wh.events.slice(0, 3).join(", ")}
                          {wh.events.length > 3 && ` +${wh.events.length - 3} more`}
                        </p>
                      </div>
                      {wh.active ? (
                        <span className="bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5 text-xs font-semibold">
                          Active
                        </span>
                      ) : (
                        <span className="bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5 text-xs font-semibold">
                          Inactive
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
