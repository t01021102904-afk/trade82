"use client";

import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  ImagePlus,
  Plus,
  Trash2,
  UploadCloud,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";

import { useI18n } from "@/components/i18n-provider";
import { ProductImage } from "@/components/product-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CometSpinner } from "@/components/ui/comet-spinner";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type BulkCreatedProduct,
  type BulkProductImportResponse,
  type BulkProductPreviewRow,
  type BulkProductValidationResponse,
} from "@/lib/bulk-product-types";
import { validateBulkProductWorkbookFile } from "@/lib/bulk-product-upload";
import { withLocale } from "@/lib/i18n";
import type { UploadedListingImage } from "@/lib/marketplace";
import { cn } from "@/lib/utils";

type Phase = "upload" | "preview" | "images";

const ListingImageUploader = dynamic(
  () =>
    import("@/components/image-uploader").then(
      (module) => module.ListingImageUploader,
    ),
  {
    loading: () => (
      <div className="flex min-h-32 items-center justify-center">
        <CometSpinner size="sm" />
      </div>
    ),
  },
);

export function BulkProductRegistration() {
  const { locale, t } = useI18n();
  const [phase, setPhase] = useState<Phase>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validation, setValidation] =
    useState<BulkProductValidationResponse | null>(null);
  const [createdProducts, setCreatedProducts] = useState<BulkCreatedProduct[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!file || phase === "images") return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [file, phase]);

  const validateFile = useCallback(
    async (nextFile: File) => {
      const fileError = validateBulkProductWorkbookFile(nextFile, locale);
      if (fileError) {
        setError(fileError);
        setFile(null);
        setValidation(null);
        setPhase("upload");
        return;
      }

      setFile(nextFile);
      setValidation(null);
      setCreatedProducts([]);
      setError("");
      setNotice("");
      setValidating(true);
      setIdempotencyKey(crypto.randomUUID());
      try {
        const formData = new FormData();
        formData.set("file", nextFile);
        formData.set("locale", locale);
        const response = await fetch("/api/account/products/bulk/validate", {
          method: "POST",
          body: formData,
        });
        const result = (await response.json().catch(() => null)) as
          | (BulkProductValidationResponse & { error?: string })
          | { error?: string }
          | null;
        if (!response.ok || !result || !("rows" in result)) {
          setError(result?.error ?? t("bulkProducts.validationFailed"));
          setPhase("upload");
          return;
        }
        setValidation(result);
        setPhase("preview");
      } catch {
        setError(t("bulkProducts.validationFailed"));
        setPhase("upload");
      } finally {
        setValidating(false);
      }
    },
    [locale, t],
  );

  function chooseFile(nextFile: File | undefined) {
    if (nextFile) void validateFile(nextFile);
  }

  function removeFile() {
    setFile(null);
    setValidation(null);
    setCreatedProducts([]);
    setError("");
    setNotice("");
    setPhase("upload");
    setIdempotencyKey(crypto.randomUUID());
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function createProducts() {
    if (
      !file ||
      !validation ||
      validation.errorRows > 0 ||
      importing
    ) {
      return;
    }
    setImporting(true);
    setError("");
    setNotice("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("locale", locale);
      formData.set("idempotencyKey", idempotencyKey);
      const response = await fetch("/api/account/products/bulk/import", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json().catch(() => null)) as
        | (BulkProductImportResponse & { error?: string })
        | { error?: string }
        | null;
      if (!response.ok || !result || !("products" in result)) {
        setError(result?.error ?? t("bulkProducts.importFailed"));
        return;
      }
      setCreatedProducts(result.products);
      setNotice(
        result.duplicateRequest ? t("bulkProducts.duplicateRequest") : "",
      );
      setPhase("images");
    } catch {
      setError(t("bulkProducts.importFailed"));
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    removeFile();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const completedImages = createdProducts.filter(
    (product) => product.images.length > 0,
  ).length;
  const step =
    phase === "images"
      ? 5
      : importing
        ? 4
        : phase === "preview"
          ? 3
          : file
            ? 2
            : 1;
  const handleImagesSaved = useCallback(
    (productId: string, images: UploadedListingImage[]) => {
      setCreatedProducts((current) =>
        current.map((item) =>
          item.id === productId ? { ...item, images } : item,
        ),
      );
    },
    [],
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("bulkProducts.title")}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {t("bulkProducts.description")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            render={
              <a
                href={`/api/account/products/bulk/template?locale=${locale}`}
                download
              />
            }
          >
            <Download aria-hidden="true" />
            {t("bulkProducts.downloadTemplate")}
          </Button>
          <Button
            variant="secondary"
            render={<Link href={withLocale("/sell", locale)} />}
          >
            {t("bulkProducts.backToSingle")}
          </Button>
        </div>
      </header>

      <StepList currentStep={step} />

      {phase !== "images" ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {t("bulkProducts.workbookMayBeLost")}
        </p>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}
      {notice ? (
        <div
          role="status"
          className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground"
        >
          {notice}
        </div>
      ) : null}

      {phase === "upload" || phase === "preview" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("bulkProducts.uploadTitle")}</CardTitle>
            <CardDescription>{t("bulkProducts.fileRules")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field>
              <FieldLabel htmlFor="bulk-product-workbook" className="sr-only">
                {t("bulkProducts.uploadTitle")}
              </FieldLabel>
              <label
                htmlFor="bulk-product-workbook"
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  if (event.currentTarget.contains(event.relatedTarget as Node)) {
                    return;
                  }
                  setDragging(false);
                }}
                onDrop={(event: DragEvent<HTMLLabelElement>) => {
                  event.preventDefault();
                  setDragging(false);
                  chooseFile(event.dataTransfer.files[0]);
                }}
                className={cn(
                  "flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center transition-colors hover:bg-muted/50 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
                  dragging && "border-primary bg-primary/5",
                )}
              >
                {validating ? (
                  <>
                    <CometSpinner size="sm" />
                    <span className="mt-4 text-sm font-medium text-foreground">
                      {t("bulkProducts.validating")}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex size-12 items-center justify-center rounded-lg border bg-background">
                      <Plus className="size-5" aria-hidden="true" />
                    </span>
                    <span className="mt-4 text-sm font-medium text-foreground">
                      {t("bulkProducts.dropTitle")}
                    </span>
                    <span className="mt-1 text-sm text-muted-foreground">
                      {t("bulkProducts.dropBrowse")}
                    </span>
                    <span className="mt-4 text-xs text-muted-foreground">
                      {t("bulkProducts.fileRules")}
                    </span>
                  </>
                )}
                <Input
                  ref={fileInputRef}
                  id="bulk-product-workbook"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  disabled={validating || importing}
                  onChange={(event) => chooseFile(event.target.files?.[0])}
                />
              </label>
              <FieldDescription>
                {t("bulkProducts.preparingNotice")}
              </FieldDescription>
            </Field>

            {file ? (
              <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <FileSpreadsheet
                    className="size-5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={validating || importing}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadCloud aria-hidden="true" />
                    {t("bulkProducts.replaceFile")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={validating || importing}
                    onClick={removeFile}
                  >
                    <Trash2 aria-hidden="true" />
                    {t("bulkProducts.removeFile")}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {phase === "preview" && validation ? (
        <ValidationPreview
          validation={validation}
          importing={importing}
          onCreate={() => void createProducts()}
        />
      ) : null}

      {phase === "images" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("bulkProducts.imagesTitle")}</CardTitle>
            <CardDescription>
              {t("bulkProducts.imagesDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryMetric
                label={t("bulkProducts.created")}
                value={createdProducts.length}
              />
              <SummaryMetric
                label={t("bulkProducts.imagesCompleted")}
                value={completedImages}
              />
              <SummaryMetric
                label={t("bulkProducts.imagesRemaining")}
                value={createdProducts.length - completedImages}
              />
            </div>

            <div className="space-y-3">
              {createdProducts.map((product) => (
                <BulkProductImageRow
                  key={product.id}
                  product={product}
                  onImagesSaved={handleImagesSaved}
                />
              ))}
            </div>

            <div className="flex flex-col gap-2 border-t pt-5 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={reset}>
                <Plus aria-hidden="true" />
                {t("bulkProducts.addMoreProducts")}
              </Button>
              <Button
                render={
                  <Link
                    href={`${withLocale("/dashboard/seller", locale)}?section=products`}
                  />
                }
              >
                {t("bulkProducts.goToProducts")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function StepList({ currentStep }: { currentStep: number }) {
  const { t } = useI18n();
  const steps = [
    t("bulkProducts.stepTemplate"),
    t("bulkProducts.stepUpload"),
    t("bulkProducts.stepPreview"),
    t("bulkProducts.stepCreate"),
    t("bulkProducts.stepImages"),
  ];

  return (
    <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      {steps.map((label, index) => {
        const number = index + 1;
        const completed = number < currentStep;
        const active = number === currentStep;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex min-w-0 items-center gap-3 rounded-lg border bg-card px-3 py-2.5",
              active && "border-primary/40 bg-primary/5",
            )}
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold text-muted-foreground",
                (active || completed) &&
                  "border-primary/30 bg-primary/10 text-primary",
              )}
            >
              {completed ? (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              ) : (
                number
              )}
            </span>
            <span className="truncate text-sm font-medium text-foreground">
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ValidationPreview({
  validation,
  importing,
  onCreate,
}: {
  validation: BulkProductValidationResponse;
  importing: boolean;
  onCreate: () => void;
}) {
  const { t } = useI18n();
  const hasErrors = validation.errorRows > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle>{t("bulkProducts.previewTitle")}</CardTitle>
            <CardDescription>
              {t("bulkProducts.previewDescription")}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {t("bulkProducts.rowsReady")}: {validation.readyRows}
            </Badge>
            <Badge variant="outline">
              {t("bulkProducts.rowsWarning")}: {validation.warningRows}
            </Badge>
            <Badge variant={hasErrors ? "destructive" : "outline"}>
              {t("bulkProducts.rowsError")}: {validation.errorRows}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto rounded-lg border">
          <Table className="min-w-[1100px]">
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("bulkProducts.row")}</TableHead>
                <TableHead className="min-w-56">
                  {t("bulkProducts.productName")}
                </TableHead>
                <TableHead className="min-w-44">
                  {t("bulkProducts.category")}
                </TableHead>
                <TableHead>{t("bulkProducts.status")}</TableHead>
                <TableHead>{t("bulkProducts.retailPrice")}</TableHead>
                <TableHead>{t("bulkProducts.wholesalePrice")}</TableHead>
                <TableHead>{t("bulkProducts.currency")}</TableHead>
                <TableHead>{t("bulkProducts.moq")}</TableHead>
                <TableHead className="min-w-72">
                  {t("bulkProducts.validationResult")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {validation.rows.map((row) => (
                <PreviewRow key={row.excelRow} row={row} />
              ))}
            </TableBody>
          </Table>
        </div>

        {hasErrors ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {t("bulkProducts.fixErrors")}
          </div>
        ) : null}
        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("bulkProducts.preparingNotice")}
          </p>
          <Button
            type="button"
            size="lg"
            disabled={hasErrors || importing}
            onClick={onCreate}
          >
            {importing ? <CometSpinner size="xs" /> : null}
            {importing
              ? t("bulkProducts.creatingProducts")
              : t("bulkProducts.createProducts")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PreviewRow({ row }: { row: BulkProductPreviewRow }) {
  const { t } = useI18n();
  const issues = [...row.errors, ...row.warnings];

  return (
    <TableRow>
      <TableCell className="tabular-nums">{row.excelRow}</TableCell>
      <TableCell className="max-w-64 whitespace-normal font-medium">
        <span className="line-clamp-2">{row.product.name || "—"}</span>
      </TableCell>
      <TableCell className="max-w-52 truncate">
        {row.product.category || "—"}
      </TableCell>
      <TableCell>
        <StatusBadge status={row.status} />
      </TableCell>
      <TableCell className="tabular-nums">
        {row.product.retailPrice || "—"}
      </TableCell>
      <TableCell className="tabular-nums">
        {row.product.wholesalePrice || "—"}
      </TableCell>
      <TableCell>{row.product.currency || "—"}</TableCell>
      <TableCell className="whitespace-nowrap">
        {row.product.moqQuantity && row.product.moqUnit
          ? `${row.product.moqQuantity} ${row.product.moqUnit}`
          : "—"}
      </TableCell>
      <TableCell className="whitespace-normal">
        {issues.length ? (
          <ul className="space-y-1 text-xs">
            {issues.map((issue) => (
              <li
                key={`${issue.field}:${issue.message}`}
                className={
                  row.errors.includes(issue)
                    ? "text-destructive"
                    : "text-muted-foreground"
                }
              >
                <span className="font-medium">{issue.column}:</span>{" "}
                {issue.message}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-xs text-muted-foreground">
            {t("bulkProducts.ready")}
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}

function StatusBadge({
  status,
}: {
  status: BulkProductPreviewRow["status"];
}) {
  const { t } = useI18n();
  if (status === "error") {
    return <Badge variant="destructive">{t("bulkProducts.error")}</Badge>;
  }
  if (status === "warning") {
    return <Badge variant="outline">{t("bulkProducts.warning")}</Badge>;
  }
  return (
    <Badge
      variant="outline"
      className="border-primary/30 bg-primary/10 text-primary"
    >
      {t("bulkProducts.ready")}
    </Badge>
  );
}

function BulkProductImageRow({
  product,
  onImagesSaved,
}: {
  product: BulkCreatedProduct;
  onImagesSaved: (
    productId: string,
    images: UploadedListingImage[],
  ) => void;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [images, setImages] = useState(product.images);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const queue = useRef(Promise.resolve());
  const saveVersion = useRef(0);
  const persistedImages = useRef(product.images);

  const saveImages = useCallback(
    (nextImages: UploadedListingImage[]) => {
      const version = ++saveVersion.current;
      setImages(nextImages);
      setSaving(true);
      setError("");
      queue.current = queue.current
        .catch(() => undefined)
        .then(async () => {
          const response = await fetch(`/api/account/products/${product.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ images: nextImages }),
          });
          if (!response.ok) {
            throw new Error("image_save_failed");
          }
          persistedImages.current = nextImages;
          onImagesSaved(product.id, nextImages);
        })
        .catch(() => {
          if (saveVersion.current !== version) return;
          setImages(persistedImages.current);
          setError(t("bulkProducts.imageSaveFailed"));
        })
        .finally(() => {
          if (saveVersion.current === version) setSaving(false);
        });
    },
    [onImagesSaved, product.id, t],
  );

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <ProductImage
          urls={[images[0]?.cardUrl]}
          alt={product.name}
          sizes="48px"
          className="size-12 shrink-0 rounded-md border"
          imageClassName="bg-card object-contain p-1"
          placeholderClassName="p-1"
          showLabel={false}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {product.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {product.category}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{t("bulkProducts.preparing")}</Badge>
          <Badge
            variant={images.length ? "outline" : "destructive"}
            className={
              images.length
                ? "border-primary/30 bg-primary/10 text-primary"
                : undefined
            }
          >
            {images.length
              ? t("bulkProducts.imageAdded")
              : t("bulkProducts.imageRequired")}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
          >
            <ImagePlus aria-hidden="true" />
            {t("bulkProducts.imagesTitle")}
          </Button>
        </div>
      </div>
      {expanded ? (
        <div className="border-t p-4">
          <ListingImageUploader
            value={images}
            onChange={saveImages}
            onUploadingChange={setUploading}
            variant="dashboard"
          />
          {uploading || saving ? (
            <p
              role="status"
              className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"
            >
              <CometSpinner size="xs" />
              {saving
                ? t("bulkProducts.imageSaving")
                : t("listing.statusUploading")}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

function formatFileSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
