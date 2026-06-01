/**
 * Webhook Details Route
 * View and manage individual webhook (Phase 5)
 */

import { useParams } from "react-router";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";

export default function WebhookDetailsPage() {
  const { id } = useParams();

  return (
    <AppShell>
      <PageHeader
        title={`Webhook: ${id}`}
        description="View and manage webhook configuration."
      />
    </AppShell>
  );
}
