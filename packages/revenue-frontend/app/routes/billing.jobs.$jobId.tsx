/**
 * Billing Job Status Route
 */

import { useParams, useNavigate } from "react-router";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { useBillingJob } from "~/lib/api/hooks/use-billing";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  ArrowLeft,
  FileText,
} from "lucide-react";
import { Link } from "react-router";

export default function BillingJobStatusRoute() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useBillingJob(jobId!);

  const job = data?.data;

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading job status...</div>
        </div>
      </AppShell>
    );
  }

  if (!job) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Job not found</div>
        </div>
      </AppShell>
    );
  }

  const statusConfig = {
    queued: {
      icon: Clock,
      color: "bg-yellow-100 text-yellow-700",
      badge: "bg-yellow-500",
      title: "Queued",
      description: "Job is waiting to be processed",
    },
    active: {
      icon: TrendingUp,
      color: "bg-blue-100 text-blue-700",
      badge: "bg-blue-500",
      title: "Processing",
      description: "Job is currently being processed",
    },
    completed: {
      icon: CheckCircle,
      color: "bg-green-100 text-green-700",
      badge: "bg-green-500",
      title: "Completed",
      description: "Job completed successfully",
    },
    failed: {
      icon: AlertCircle,
      color: "bg-red-100 text-red-700",
      badge: "bg-red-500",
      title: "Failed",
      description: "Job failed to complete",
    },
  };

  const config = statusConfig[job.status as keyof typeof statusConfig];
  const Icon = config.icon;

  return (
    <AppShell>
      <PageHeader
        title="Billing Job Status"
        description={`Job ID: ${jobId}`}
        actions={
          <Link to="/billing">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Billing
            </Button>
          </Link>
        }
      />

      <div className="mt-6 max-w-3xl space-y-6">
        {/* Status Card */}
        <Card className="p-6">
          <div className="flex items-start gap-6">
            <div className={`p-4 rounded-full ${config.color}`}>
              <Icon className="h-8 w-8" />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-2xl font-bold">{config.title}</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${config.badge}`}>
                  {job.status.toUpperCase()}
                </span>
              </div>
              <p className="text-gray-600 mb-4">{config.description}</p>

              {job.status === "active" && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium">
                      {job.progress || 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${job.progress || 0}%` }}
                    />
                  </div>
                </div>
              )}

              {job.status === "completed" && job.result && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-800">
                        Invoice Generated
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        Invoice ID: {job.result.invoiceId}
                      </p>
                    </div>
                    <Link to={`/invoices/${job.result.invoiceId}`}>
                      <Button size="sm">
                        <FileText className="mr-2 h-4 w-4" />
                        View Invoice
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {job.status === "failed" && job.error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-800 mb-2">
                    Error Details
                  </p>
                  <p className="text-xs text-red-600 font-mono">
                    {job.error}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Job Details */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Job Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium text-gray-500">Job ID:</span>
              <p className="text-sm font-mono mt-1">{job.id}</p>
            </div>

            <div>
              <span className="text-sm font-medium text-gray-500">Type:</span>
              <p className="text-sm mt-1">{job.type || "Contract Billing"}</p>
            </div>

            <div>
              <span className="text-sm font-medium text-gray-500">
                Created At:
              </span>
              <p className="text-sm mt-1">
                {new Date(job.createdAt).toLocaleString()}
              </p>
            </div>

            {job.processedAt && (
              <div>
                <span className="text-sm font-medium text-gray-500">
                  Processed At:
                </span>
                <p className="text-sm mt-1">
                  {new Date(job.processedAt).toLocaleString()}
                </p>
              </div>
            )}

            {job.finishedAt && (
              <div>
                <span className="text-sm font-medium text-gray-500">
                  Finished At:
                </span>
                <p className="text-sm mt-1">
                  {new Date(job.finishedAt).toLocaleString()}
                </p>
              </div>
            )}

            {job.attemptsMade !== undefined && (
              <div>
                <span className="text-sm font-medium text-gray-500">
                  Attempts:
                </span>
                <p className="text-sm mt-1">
                  {job.attemptsMade} / {job.maxAttempts ?? 3}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Job Data */}
        {job.data && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Job Input Data</h3>
            <pre className="text-xs bg-gray-50 p-4 rounded-lg overflow-auto">
              {JSON.stringify(job.data, null, 2)}
            </pre>
          </Card>
        )}

        {/* Auto-refresh indicator */}
        {(job.status === "active" || job.status === "queued") && (
          <div className="text-center text-sm text-gray-500">
            <Clock className="inline-block h-4 w-4 mr-2 animate-spin" />
            Auto-refreshing every 2 seconds...
          </div>
        )}
      </div>
    </AppShell>
  );
}
