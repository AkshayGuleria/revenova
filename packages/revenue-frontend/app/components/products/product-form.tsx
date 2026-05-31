/**
 * Product Form Component
 */

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { Product, CreateProductDto, UpdateProductDto } from "~/types/models";
import {
  PricingModel,
  BillingInterval,
  ChargeType,
  ProductCategory,
} from "~/types/models";
import { CurrencySelect } from "~/components/ui/currency-select";
import { useConfigStore } from "~/lib/stores/config-store";

const productFormSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  sku: z.string().optional(),
  pricingModel: z.nativeEnum(PricingModel),
  basePrice: z.coerce.number().min(0).optional(),
  currency: z.string().optional(),
  chargeType: z.nativeEnum(ChargeType),
  category: z.nativeEnum(ProductCategory),
  setupFee: z.coerce.number().min(0).optional(),
  trialPeriodDays: z.coerce.number().int().min(0).optional(),
  minCommitmentMonths: z.coerce.number().int().min(1).optional(),
  minSeats: z.coerce.number().int().positive().optional(),
  maxSeats: z.coerce.number().int().positive().optional(),
  seatIncrement: z.coerce.number().int().positive().optional(),
  billingInterval: z.nativeEnum(BillingInterval).optional(),
  active: z.boolean().optional(),
  isAddon: z.boolean().optional(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

interface ProductFormProps {
  product?: Product;
  onSubmit: (data: CreateProductDto | UpdateProductDto) => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  mode: "create" | "edit";
}

export function ProductForm({
  product,
  onSubmit,
  onCancel,
  isLoading,
  mode,
}: ProductFormProps) {
  const { defaultCurrency } = useConfigStore();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema) as Resolver<ProductFormValues>,
    defaultValues: {
      name: product?.name || "",
      description: product?.description || "",
      sku: product?.sku || "",
      pricingModel: product?.pricingModel || PricingModel.SEAT_BASED,
      basePrice: product?.basePrice,
      currency: product?.currency || defaultCurrency,
      chargeType: product?.chargeType || ChargeType.RECURRING,
      category: product?.category || ProductCategory.PLATFORM,
      setupFee: product?.setupFee,
      trialPeriodDays: product?.trialPeriodDays,
      minCommitmentMonths: product?.minCommitmentMonths,
      minSeats: product?.minSeats || 1,
      maxSeats: product?.maxSeats,
      seatIncrement: product?.seatIncrement || 1,
      billingInterval: product?.billingInterval || BillingInterval.MONTHLY,
      active: product?.active ?? true,
      isAddon: product?.isAddon ?? false,
    },
  });

  const chargeType = form.watch("chargeType");
  const pricingModel = form.watch("pricingModel");

  const isOneTime = chargeType === ChargeType.ONE_TIME;
  const isUsageBased = chargeType === ChargeType.USAGE_BASED;
  const isSeatBased = pricingModel === PricingModel.SEAT_BASED;

  const handleSubmit = (values: ProductFormValues) => {
    // Strip billingInterval for one_time products
    if (values.chargeType === ChargeType.ONE_TIME) {
      values.billingInterval = undefined;
    }
    onSubmit(values as CreateProductDto | UpdateProductDto);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        {/* ── Basic Information ─────────────────────────────────────────── */}
        <div className="space-y-6">
          <h3 className="text-lg font-medium">Basic Information</h3>

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Product Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Enterprise Plan" {...field} />
                </FormControl>
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
                  <textarea
                    className="w-full min-h-[80px] p-2 border rounded-md"
                    placeholder="Product description..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU</FormLabel>
                  <FormControl>
                    <Input placeholder="PLAN-PRO-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <FormControl>
                    <CurrencySelect
                      value={field.value}
                      onValueChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* ── Charge Type & Category ────────────────────────────────────── */}
        <div className="space-y-6">
          <h3 className="text-lg font-medium">Charge Type &amp; Category</h3>

          <div className="grid grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="chargeType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Charge Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select charge type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={ChargeType.RECURRING}>Recurring</SelectItem>
                      <SelectItem value={ChargeType.ONE_TIME}>One-Time</SelectItem>
                      <SelectItem value={ChargeType.USAGE_BASED}>Usage-Based (Phase 6)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {isOneTime
                      ? "Billed once on the first invoice."
                      : isUsageBased
                        ? "Billing deferred to Phase 6."
                        : "Auto-billed each billing interval."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={ProductCategory.PLATFORM}>Platform</SelectItem>
                      <SelectItem value={ProductCategory.SEATS}>Seats</SelectItem>
                      <SelectItem value={ProductCategory.ADDON}>Add-on</SelectItem>
                      <SelectItem value={ProductCategory.SUPPORT}>Support</SelectItem>
                      <SelectItem value={ProductCategory.PROFESSIONAL_SERVICES}>
                        Professional Services
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Used for invoice line item grouping and reporting.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {isUsageBased && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <p className="font-medium">Usage-Based Billing — Phase 6</p>
              <p className="mt-1">
                This product will be stored in the catalog but no invoices will be generated
                until usage-based billing is activated in Phase 6.
              </p>
            </div>
          )}
        </div>

        {/* ── Pricing Configuration ─────────────────────────────────────── */}
        <div className="space-y-6">
          <h3 className="text-lg font-medium">Pricing Configuration</h3>

          <div className="grid grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="pricingModel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pricing Model *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={PricingModel.SEAT_BASED}>Seat Based</SelectItem>
                      <SelectItem value={PricingModel.FLAT_FEE}>Flat Fee</SelectItem>
                      <SelectItem value={PricingModel.VOLUME_TIERED}>Volume Tiered</SelectItem>
                      <SelectItem value={PricingModel.CUSTOM}>Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* billingInterval hidden for one_time products */}
            {!isOneTime && (
              <FormField
                control={form.control}
                name="billingInterval"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Billing Interval{chargeType === ChargeType.RECURRING ? " *" : ""}
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select interval" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={BillingInterval.MONTHLY}>Monthly</SelectItem>
                        <SelectItem value={BillingInterval.QUARTERLY}>Quarterly</SelectItem>
                        <SelectItem value={BillingInterval.SEMI_ANNUAL}>Semi-Annual</SelectItem>
                        <SelectItem value={BillingInterval.ANNUAL}>Annual</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

          <FormField
            control={form.control}
            name="basePrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Base Price</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="99.00"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormDescription>
                  {isOneTime
                    ? "Total one-time charge amount."
                    : "Price per billing interval."}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* ── Subscription & Commitment ─────────────────────────────────── */}
        <div className="space-y-6">
          <h3 className="text-lg font-medium">Subscription &amp; Commitment</h3>

          <div className="grid grid-cols-3 gap-6">
            <FormField
              control={form.control}
              name="setupFee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Setup Fee</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="500.00"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormDescription>One-time fee added to first invoice.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="trialPeriodDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trial Period (days)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="14"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormDescription>Days before billing begins.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="minCommitmentMonths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Min. Commitment (months)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="12"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormDescription>Minimum contract length.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* ── Seat Configuration (seat_based only) ──────────────────────── */}
        {isSeatBased && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Seat Configuration</h3>

            <div className="grid grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="minSeats"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Seats</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="1"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxSeats"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum Seats</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="1000"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="seatIncrement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seat Increment</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="1"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        {/* ── Options ───────────────────────────────────────────────────── */}
        <div className="space-y-6">
          <h3 className="text-lg font-medium">Options</h3>

          <div className="flex items-center space-x-8">
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                    className="h-4 w-4"
                  />
                  <FormLabel className="!mt-0">Active</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isAddon"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                    className="h-4 w-4"
                  />
                  <FormLabel className="!mt-0">Is Add-on</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="hover:scale-105 active:scale-95 transition-transform duration-200"
          >
            {isLoading
              ? "Saving..."
              : mode === "create"
                ? "Create Product"
                : "Update Product"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
