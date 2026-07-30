"use client"

import { EllipsisVertical, Eye, EyeOff, Pencil, Trash2 } from "lucide-react"

import { ProductImage } from "@/components/product-image"
import type { DbProduct } from "@/components/product-management"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { sellerProductCategoryLabel } from "@/lib/company-select-options"
import { useI18n } from "@/components/i18n-provider"

export function SellerProductsTable({
  products,
  pendingId,
  emptyText,
  onEdit,
  onSetPreparing,
  onPublish,
  onDelete,
}: {
  products: DbProduct[]
  pendingId: string | null
  emptyText: string
  onEdit: (product: DbProduct) => void
  onSetPreparing: (product: DbProduct) => void
  onPublish: (product: DbProduct) => void
  onDelete: (product: DbProduct) => void
}) {
  const { locale, t } = useI18n()

  if (!products.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-[260px] px-4">{t("dashboard.productTableHeader")}</TableHead>
            <TableHead className="min-w-[170px]">{t("dashboard.productTableSectionType")}</TableHead>
            <TableHead className="min-w-[120px]">{t("dashboard.productTableStatus")}</TableHead>
            <TableHead className="min-w-[130px]">{t("dashboard.productTableTarget")}</TableHead>
            <TableHead className="min-w-[150px]">{t("dashboard.productTableLimit")}</TableHead>
            <TableHead className="min-w-[90px] text-right">{t("dashboard.productTableViews")}</TableHead>
            <TableHead className="w-12 px-2 text-right">
              <span className="sr-only">{t("dashboard.productTableActions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const pending = pendingId === product.id
            const isPublic = product.status === "active" && product.sellerCompany.verificationStatus === "verified"
            const isActive = product.status === "active"
            const category = sellerProductCategoryLabel(product.category, locale)

            return (
              <TableRow key={product.id} className="group">
                <TableCell className="whitespace-normal px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <ProductImage
                      urls={[product.images[0]?.cardUrl, product.imageUrl]}
                      alt={product.name}
                      sizes="40px"
                      className="size-10 shrink-0 rounded-md border"
                      imageClassName="bg-card object-contain p-1"
                      placeholderClassName="p-1"
                      showLabel={false}
                    />
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-medium leading-5 text-foreground">
                        {product.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {product.shortDescription || category}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="max-w-[170px] truncate font-normal">
                    {category || product.category}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={isPublic ? "theme-success-badge" : "theme-surface-muted theme-muted"}
                  >
                    {isPublic ? t("dashboard.statusActive") : t("dashboard.statusInactive")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <MoqValue product={product} />
                </TableCell>
                <TableCell className="max-w-[180px] truncate font-medium text-foreground">
                  {formatDashboardProductPrice(product, t("dashboard.priceOnRequest"))}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "en-US").format(Number(product.viewCount ?? 0))}
                </TableCell>
                <TableCell className="px-2 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground aria-expanded:bg-muted"
                          disabled={pending}
                          aria-label={`${t("dashboard.productTableActions")}: ${product.name}`}
                        />
                      }
                    >
                      <EllipsisVertical />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => onEdit(product)}>
                        <Pencil />
                        {t("settings.editProduct")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={pending}
                        onClick={() => (isActive ? onSetPreparing(product) : onPublish(product))}
                      >
                        {isActive ? <EyeOff /> : <Eye />}
                        {isActive ? t("dashboard.setPreparing") : t("listing.publishProduct")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={pending}
                        onClick={() => onDelete(product)}
                      >
                        <Trash2 />
                        {t("settings.deleteProduct")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function MoqValue({ product }: { product: Pick<DbProduct, "moq" | "moqQuantity" | "moqUnit"> }) {
  const { t } = useI18n()
  const quantity = product.moqQuantity?.trim()
  const unit = product.moqUnit?.trim()
  const value = quantity && unit ? `${quantity} ${unit}` : product.moq?.trim()

  if (!value) {
    return <Badge variant="outline" className="theme-warning-badge">{t("dashboard.productTermsRequired")}</Badge>
  }

  return <span className="font-medium text-foreground">{value}</span>
}

export function formatDashboardProductPrice(
  product: Pick<DbProduct, "priceMin" | "priceMax" | "currency">,
  fallback: string,
) {
  if (!product.priceMin && !product.priceMax) return fallback
  if (product.priceMin === product.priceMax || !product.priceMax) {
    return `${product.currency} ${product.priceMin}`
  }
  return `${product.currency} ${product.priceMin}-${product.priceMax}`
}
