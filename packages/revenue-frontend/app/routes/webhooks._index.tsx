/**
 * Webhooks Route
 * Webhook configurations and integrations (Phase 5)
 */

import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";

export default function WebhooksPage() {
  return (
    <AppShell>
      <PageHeader
        title="Webhooks"
        description="Manage webhook configurations and integrations."
      />
    </AppShell>
  );
}
