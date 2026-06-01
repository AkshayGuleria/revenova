/**
 * Audit Log Route
 * System audit trail and compliance logs (Phase 5)
 */

import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";

export default function AuditLogPage() {
  return (
    <AppShell>
      <PageHeader
        title="Audit Log"
        description="View system audit trail and compliance logs."
      />
    </AppShell>
  );
}
