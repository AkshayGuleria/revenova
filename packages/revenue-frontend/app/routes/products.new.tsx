/**
 * Create Product Route
 */

import { useNavigate } from "react-router";
import { toast } from "sonner";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { Card, CardContent } from "~/components/ui/card";
import { ProductForm } from "~/components/products/product-form";
import { useCreateProduct } from "~/lib/api/hooks/use-products";
import type { CreateProductDto, UpdateProductDto } from "~/types/models";

export default function CreateProductRoute() {
  const navigate = useNavigate();
  const createMutation = useCreateProduct();

  const handleSubmit = async (data: CreateProductDto | UpdateProductDto) => {
    try {
      await createMutation.mutateAsync(data as CreateProductDto);
      toast.success("Product created successfully");
      navigate("/products");
    } catch (error: any) {
      toast.error(error.message || "Failed to create product");
    }
  };

  return (
    <AppShell>
      <PageHeader title="Create Product" description="Add a new product to your catalog" />
      <Card className="mt-6">
        <CardContent className="pt-6">
          <ProductForm
            mode="create"
            onSubmit={handleSubmit}
            onCancel={() => navigate("/products")}
            isLoading={createMutation.isPending}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
