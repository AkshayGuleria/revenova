import { useState } from "react";
import { useParams, Link } from "react-router";
import { format } from "date-fns";
import { ArrowLeft, Power } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "~/components/ui/alert-dialog";
import { useWebhook, useWebhookDeliveries, useDeactivateWebhook } from "~/lib/api/hooks/use-webhooks";
import type { WebhookDelivery, WebhookEndpoint } from "~/types/models";

export default function WebhookDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const [showDeactivate, setShowDeactivate] = useState(false);

  const { data: webhookData, isLoading } = useWebhook(id!);
  const { data: deliveriesData, isLoading: deliveriesLoading } = useWebhookDeliveries(id!);
  const deactivateWebhook = useDeactivateWebhook();

  const webhook = webhookData?.data as WebhookEndpoint | undefined;
  const deliveries = (deliveriesData?.data as WebhookDelivery[]) ?? [];

  async function handleDeactivate() {
    try {
      await deactivateWebhook.mutateAsync(id!);
      toast.success("Webhook deactivated");
    } catch {
      toast.error("Failed to deactivate webhook");
    } finally {
      setShowDeactivate(false);
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppShell>
    );
  }

  if (!webhook) {
    return (
      <AppShell>
        <div className="text-center py-16 text-gray-400">Webhook not found.</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-4">
        <Link to="/webhooks" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <PageHeader
            title={webhook.url}
            description={`${webhook.account?.accountName ?? webhook.accountId} · Created ${format(new Date(webhook.createdAt), "yyyy-MM-dd")}`}
          />
        </div>
        {webhook.active ? (
          <Button
            variant="outline"
            size="sm"
            className="border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => setShowDeactivate(true)}
          >
            <Power className="h-4 w-4 mr-1" /> Deactivate
          </Button>
        ) : (
          <span className="bg-red-50 text-red-700 border border-red-200 rounded-full px-3 py-1 text-xs font-semibold">
            Inactive
          </span>
        )}
      </div>

      {/* Config cards */}
      <div className="grid grid-cols-2 gap-4 mt-2">
        <Card className="shadow-sm border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-gray-500">Subscribed Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {webhook.events.map((e) => (
                <span key={e} className="bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-0.5 text-xs">
                  {e}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-gray-500">Description</CardTitle>
          </CardHeader>
          <CardContent>
            {webhook.description ? (
              <p className="text-sm text-gray-700">{webhook.description}</p>
            ) : (
              <p className="text-sm text-gray-400">No description.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delivery history */}
      <Card className="mt-6 shadow-sm border-0 overflow-hidden">
        <CardHeader className="border-b bg-gray-50 py-3 px-4">
          <CardTitle className="text-sm font-semibold text-gray-700">
            Delivery History <span className="text-gray-400 font-normal">(last 50)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {deliveriesLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500 tracking-wide">
                  <th className="text-left px-4 py-3">Event</th>
                  <th className="text-left px-3 py-3">Status</th>
                  <th className="text-left px-3 py-3">HTTP</th>
                  <th className="text-left px-3 py-3">Attempts</th>
                  <th className="text-left px-3 py-3">Delivered At</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-gray-400 text-sm">
                      No delivery attempts yet.
                    </td>
                  </tr>
                )}
                {deliveries.map((d) => (
                  <tr key={d.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-gray-700">{d.event}</td>
                    <td className="px-3 py-3">
                      {d.status === "delivered" ? (
                        <span className="bg-green-50 text-green-700 border border-green-200 rounded px-2 py-0.5 text-xs">delivered</span>
                      ) : d.status === "failed" ? (
                        <span className="bg-red-50 text-red-700 border border-red-200 rounded px-2 py-0.5 text-xs">failed</span>
                      ) : (
                        <span className="bg-gray-100 text-gray-600 rounded px-2 py-0.5 text-xs">{d.status}</span>
                      )}
                    </td>
                    <td className={`px-3 py-3 text-xs font-semibold ${d.responseStatus && d.responseStatus >= 200 && d.responseStatus < 300 ? "text-green-600" : "text-red-600"}`}>
                      {d.responseStatus ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600">{d.attemptCount}</td>
                    <td className="px-3 py-3 text-xs text-gray-500">
                      {d.deliveredAt ? format(new Date(d.deliveredAt), "yyyy-MM-dd HH:mm") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Deactivate confirmation */}
      <AlertDialog open={showDeactivate} onOpenChange={setShowDeactivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop all future deliveries. The webhook and its delivery history will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              className="bg-red-600 hover:bg-red-700"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
