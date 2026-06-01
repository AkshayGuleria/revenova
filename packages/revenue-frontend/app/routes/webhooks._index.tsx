import { useState } from "react";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "~/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Checkbox } from "~/components/ui/checkbox";
import { Textarea } from "~/components/ui/textarea";
import { Input } from "~/components/ui/input";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { useWebhooks, useCreateWebhook, useDeactivateWebhook } from "~/lib/api/hooks/use-webhooks";
import { useAccounts } from "~/lib/api/hooks/use-accounts";
import type { WebhookEndpoint } from "~/types/models";

const VALID_EVENTS = [
  "invoice.created", "invoice.paid", "invoice.overdue",
  "payment.received", "payment.voided",
  "contract.created", "contract.renewed", "contract.expiring",
  "purchase_order.approved", "purchase_order.rejected",
  "account.credit_hold",
] as const;

const registerSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  url: z.string().url("Must be a valid URL"),
  events: z.array(z.string()).min(1, "Select at least one event"),
  description: z.string().optional(),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function WebhooksListRoute({
  preselectedAccountId,
  hideAccountColumn,
}: {
  preselectedAccountId?: string;
  hideAccountColumn?: boolean;
} = {}) {
  const [accountFilter, setAccountFilter] = useState(preselectedAccountId ?? "");
  const [statusFilter, setStatusFilter] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  const params: Record<string, any> = {};
  if (accountFilter) params["accountId[eq]"] = accountFilter;
  if (statusFilter) params["active[eq]"] = statusFilter === "active" ? "true" : "false";

  const { data, isLoading } = useWebhooks(params);
  const { data: accountsData } = useAccounts({ "limit[eq]": 100 });
  const webhooks = (data?.data as WebhookEndpoint[]) ?? [];
  const accounts = (accountsData?.data as any[]) ?? [];

  const createWebhook = useCreateWebhook();
  const deactivateWebhook = useDeactivateWebhook();

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      accountId: preselectedAccountId ?? "",
      url: "",
      events: [],
      description: "",
    },
  });

  async function onSubmit(values: RegisterForm) {
    try {
      const result = await createWebhook.mutateAsync(values);
      const secret = (result as any)?.data?.secret;
      if (secret) {
        setRevealedSecret(secret);
      } else {
        setShowRegister(false);
        toast.success("Webhook registered");
        form.reset();
      }
    } catch {
      toast.error("Failed to register webhook");
    }
  }

  async function handleDeactivate() {
    if (!deactivateId) return;
    try {
      await deactivateWebhook.mutateAsync(deactivateId);
      toast.success("Webhook deactivated");
    } catch {
      toast.error("Failed to deactivate webhook");
    } finally {
      setDeactivateId(null);
    }
  }

  function closeModalAfterSecret() {
    setRevealedSecret(null);
    setShowRegister(false);
    toast.success("Webhook registered");
    form.reset();
  }

  return (
    <AppShell>
      <PageHeader
        title="Webhooks"
        description="Register and manage webhook endpoints across all accounts"
      />

      {/* Filters + action */}
      <div className="flex flex-wrap gap-3 items-center mt-6 mb-4">
        {!hideAccountColumn && (
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a: any) => (
                <SelectItem key={a.id} value={a.id}>{a.accountName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Button className="ml-auto" onClick={() => setShowRegister(true)}>
          <Plus className="h-4 w-4 mr-1" /> Register Webhook
        </Button>
      </div>

      {/* Table */}
      <Card className="shadow-sm border-0 overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500 tracking-wide">
                  <th className="text-left px-4 py-3">URL</th>
                  {!hideAccountColumn && <th className="text-left px-3 py-3">Account</th>}
                  <th className="text-left px-3 py-3">Events</th>
                  <th className="text-left px-3 py-3">Status</th>
                  <th className="text-left px-3 py-3">Created</th>
                  <th className="text-left px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.length === 0 && (
                  <tr>
                    <td colSpan={hideAccountColumn ? 5 : 6} className="py-12 text-center text-gray-400">
                      No webhooks found.
                    </td>
                  </tr>
                )}
                {webhooks.map((wh) => (
                  <tr key={wh.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        to={`/webhooks/${wh.id}`}
                        className="text-blue-600 hover:underline font-medium text-xs"
                      >
                        {wh.url}
                      </Link>
                    </td>
                    {!hideAccountColumn && (
                      <td className="px-3 py-3 text-gray-700 text-xs">
                        {wh.account?.accountName ?? wh.accountId}
                      </td>
                    )}
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 text-xs">
                          {wh.events[0]}
                        </span>
                        {wh.events.length > 1 && (
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 text-xs">
                            +{wh.events.length - 1}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {wh.active ? (
                        <span className="bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5 text-xs font-semibold">
                          Active
                        </span>
                      ) : (
                        <span className="bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5 text-xs font-semibold">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-500 text-xs">
                      {format(new Date(wh.createdAt), "yyyy-MM-dd")}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-3 text-xs">
                        <Link to={`/webhooks/${wh.id}`} className="text-gray-500 hover:text-gray-700">
                          History
                        </Link>
                        {wh.active && (
                          <button
                            onClick={() => setDeactivateId(wh.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Register modal */}
      <Dialog
        open={showRegister}
        onOpenChange={(o) => {
          if (!o && !revealedSecret) {
            setShowRegister(false);
            form.reset();
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register Webhook</DialogTitle>
          </DialogHeader>

          {revealedSecret ? (
            <div className="space-y-4">
              <Alert className="border-amber-200 bg-amber-50">
                <AlertDescription className="text-amber-800 text-sm">
                  <strong>Save this secret — it will never be shown again:</strong>
                  <code className="block mt-2 p-2 bg-white rounded border text-xs break-all">
                    {revealedSecret}
                  </code>
                </AlertDescription>
              </Alert>
              <Button className="w-full" onClick={closeModalAfterSecret}>
                I've saved the secret
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="accountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account *</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!!preselectedAccountId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {accounts.map((a: any) => (
                            <SelectItem key={a.id} value={a.id}>{a.accountName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://your-domain.com/webhooks" aria-label="URL" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="events"
                  render={() => (
                    <FormItem>
                      <FormLabel>Events *</FormLabel>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {VALID_EVENTS.map((event) => (
                          <FormField
                            key={event}
                            control={form.control}
                            name="events"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(event)}
                                    onCheckedChange={(checked: boolean | "indeterminate") => {
                                      const current = field.value ?? [];
                                      field.onChange(
                                        checked
                                          ? [...current, event]
                                          : current.filter((e: string) => e !== event)
                                      );
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal text-xs cursor-pointer">{event}</FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Optional description" rows={2} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setShowRegister(false); form.reset(); }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createWebhook.isPending}>
                    {createWebhook.isPending ? "Registering…" : "Register"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* Deactivate confirmation */}
      <AlertDialog open={!!deactivateId} onOpenChange={(o: boolean) => { if (!o) setDeactivateId(null); }}>
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
