/**
 * Products List Route
 */

import { useState } from "react";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { Button } from "~/components/ui/button";
import { DataTable, type Column } from "~/components/data-table";
import { StatusBadge } from "~/components/status-badge";
import { EmptyState } from "~/components/empty-state";
import { CurrencyDisplay } from "~/components/currency-display";
import { useProducts } from "~/lib/api/hooks/use-products";
import type { Product } from "~/types/models";
import { PAGINATION } from "~/lib/constants";

export default function ProductsListRoute() {
  const [offset, setOffset] = useState<number>(PAGINATION.DEFAULT_OFFSET);
  const [limit] = useState<number>(PAGINATION.DEFAULT_LIMIT);

  const { data, isLoading } = useProducts({
    "offset[eq]": offset,
    "limit[eq]": limit,
  });

  const columns: Column<Product>[] = [
    {
      key: "name",
      header: "Product Name",
      cell: (product) => (
        <Link
          to={`/products/${product.id}`}
          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          {product.name}
        </Link>
      ),
    },
    {
      key: "sku",
      header: "SKU",
      cell: (product) => (
        <span className="text-sm text-muted-foreground">{product.sku || "—"}</span>
      ),
    },
    {
      key: "pricingModel",
      header: "Pricing Model",
      cell: (product) => (
        <span className="text-sm capitalize">
          {product.pricingModel.replace(/_/g, " ")}
        </span>
      ),
    },
    {
      key: "basePrice",
      header: "Base Price",
      cell: (product) =>
        product.basePrice ? (
          <CurrencyDisplay amount={product.basePrice} currency={product.currency} />
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: "billingInterval",
      header: "Billing Interval",
      cell: (product) => (
        <span className="text-sm capitalize">
          {product.billingInterval?.replace(/_/g, " ") || "—"}
        </span>
      ),
    },
    {
      key: "active",
      header: "Status",
      cell: (product) => (
        <StatusBadge
          status={product.active ? "active" : "inactive"}
          color={product.active ? "green" : "gray"}
        />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (product) => (
        <Link to={`/products/${product.id}/edit`}>
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        </Link>
      ),
    },
  ];

  const products = Array.isArray(data?.data) ? data.data : [];

  return (
    <AppShell>
      <PageHeader
        title="Products"
        description="Manage your product catalog and pricing models"
        actions={
          <Link to="/products/new">
            <Button className="hover:scale-105 active:scale-95 transition-transform duration-200">
              <Plus className="mr-2 h-4 w-4" />
              New Product
            </Button>
          </Link>
        }
      />

      <div className="mt-6">
        <DataTable
          columns={columns}
          data={products}
          paging={data?.paging}
          isLoading={isLoading}
          onPageChange={setOffset}
          emptyState={
            <EmptyState
              title="No products found"
              description="Get started by creating your first product"
              action={{
                label: "Create Product",
                onClick: () => (window.location.href = "/products/new"),
              }}
            />
          }
        />
      </div>
    </AppShell>
  );
}
