"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { CometSpinner } from "@/components/ui/comet-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getDictionary, withLocale, type Locale } from "@/lib/i18n";

type Reviewer = { id: string; displayName: string; email: string };
type ApplicationListItem = {
  id: string;
  applicationNumber: string;
  legalCompanyName: string;
  tradeName: string | null;
  registrationCountry: string;
  status: string;
  riskLevel: string;
  submittedAt: string | null;
  updatedAt: string;
  applicant: { displayName: string; email: string };
  assignedAdmin: Reviewer | null;
  _count: {
    documents: number;
    inventorySamples: number;
    duplicateFlags: number;
    informationRequests: number;
  };
};
type AdminApplication = ApplicationListItem & {
  statusReason: string | null;
  contacts: Array<{
    firstName: string;
    lastName: string;
    workEmail: string;
    phoneNumber: string;
  }>;
  documents: Array<{
    id: string;
    originalFilename: string;
    documentType: string;
    reviewStatus: string;
  }>;
  inventorySamples: Array<{
    id: string;
    originalFilename: string;
    reviewStatus: string;
    totalRows: number;
    validRows: number;
    invalidRows: number;
  }>;
  duplicateFlags: Array<{
    id: string;
    signal: string;
    resolvedAt: string | null;
  }>;
  informationRequests: Array<{
    id: string;
    section: string;
    message: string;
    applicantResponse: string | null;
    respondedAt: string | null;
    resolutionNote: string | null;
    resolvedAt: string | null;
  }>;
  brandVerifications: Array<{
    id: string;
    brand: string;
    isActive: boolean;
    status: string;
    evidenceStatus: string;
    reviewNotes: string;
    countryRestrictions: string[];
    expiresAt: string | null;
  }>;
  statusHistory: Array<{
    id: string;
    toStatus: string;
    reason: string | null;
    createdAt: string;
  }>;
  reviews: Array<{
    id: string;
    section: string;
    status: string;
    notes: string;
    createdAt: string;
  }>;
};

const statusOptions = [
  "DRAFT",
  "SUBMITTED",
  "BUSINESS_VERIFICATION",
  "PRODUCT_AUTHENTICITY_VERIFICATION",
  "OPERATIONS_VERIFICATION",
  "SETTLEMENT_VERIFICATION",
  "ADDITIONAL_INFORMATION_REQUIRED",
  "ADDITIONAL_DOCUMENTS_REQUIRED",
  "INVENTORY_VERIFICATION_REQUIRED",
  "TEST_ORDER_REQUIRED",
  "CONDITIONALLY_APPROVED",
  "APPROVED",
  "ON_HOLD",
  "REJECTED",
  "WITHDRAWN",
  "SUSPENDED",
];
const sectionOptions = [
  "BASIC_INFORMATION",
  "BUSINESS_VERIFICATION",
  "STAKEHOLDERS",
  "WAREHOUSES",
  "SUPPLY_CHAIN",
  "BRANDS",
  "INVENTORY_SAMPLE",
  "OPERATIONS",
  "SETTLEMENT",
  "DOCUMENTS",
  "FINAL_REVIEW",
];
const reviewOptions = [
  "PENDING",
  "VERIFIED",
  "ADDITIONAL_INFORMATION_REQUIRED",
  "INVALID_DOCUMENT",
  "EXPIRED_DOCUMENT",
  "UNABLE_TO_VERIFY",
  "REJECTED",
];

function pretty(value: string) {
  return value.replaceAll("_", " ");
}

export function AdminSupplierApplications({ locale }: { locale: Locale }) {
  const copy = getDictionary(locale).admin.supplierApplications;
  const [applications, setApplications] = useState<ApplicationListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    const suffix =
      statusFilter === "ALL"
        ? ""
        : `?status=${encodeURIComponent(statusFilter)}`;
    const response = await fetch(`/api/admin/supplier-applications${suffix}`, {
      cache: "no-store",
    });
    const result = (await response.json().catch(() => null)) as {
      applications?: ApplicationListItem[];
      error?: string;
    } | null;
    if (!response.ok || !result?.applications)
      setError(result?.error ?? copy.loadError);
    else {
      setApplications(result.applications);
      setError(null);
    }
    setLoading(false);
  }, [copy.loadError, statusFilter]);
  useEffect(() => {
    const deferredLoad = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(deferredLoad);
  }, [load]);
  if (loading)
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <CometSpinner size="xs" />
        {copy.loadError}
      </div>
    );
  if (error)
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  return (
    <div className="space-y-4">
      <Field className="max-w-xs">
        <FieldLabel>{copy.filterStatus}</FieldLabel>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value ?? "ALL")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{copy.allStatuses}</SelectItem>
            {statusOptions.map((status) => (
              <SelectItem key={status} value={status}>
                {pretty(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{copy.company}</TableHead>
              <TableHead>{copy.applicant}</TableHead>
              <TableHead>{copy.status}</TableHead>
              <TableHead>{copy.assignedAdmin}</TableHead>
              <TableHead>{copy.risk}</TableHead>
              <TableHead>{copy.documents}</TableHead>
              <TableHead>{copy.submitted}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.length ? (
              applications.map((application) => (
                <TableRow key={application.id}>
                  <TableCell>
                    <Link
                      className="font-medium hover:underline"
                      href={withLocale(
                        `/admin/supplier-applications/${application.id}`,
                        locale,
                      )}
                    >
                      {application.legalCompanyName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {application.registrationCountry}
                    </p>
                  </TableCell>
                  <TableCell>
                    {application.applicant.displayName}
                    <p className="text-xs text-muted-foreground">
                      {application.applicant.email}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {pretty(application.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {application.assignedAdmin?.displayName ?? copy.unassigned}
                  </TableCell>
                  <TableCell>
                    {application.riskLevel}
                    {application._count.duplicateFlags ? (
                      <span className="ml-1 text-xs text-destructive">
                        ({application._count.duplicateFlags})
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {application._count.documents} /{" "}
                    {application._count.inventorySamples}
                  </TableCell>
                  <TableCell>
                    {application.submittedAt
                      ? new Date(application.submittedAt).toLocaleDateString(
                          locale === "ko" ? "ko-KR" : "en-US",
                        )
                      : "—"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  {copy.empty}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function AdminSupplierApplicationDetail({
  locale,
  applicationId,
}: {
  locale: Locale;
  applicationId: string;
}) {
  const copy = getDictionary(locale).admin.supplierApplications;
  const [application, setApplication] = useState<AdminApplication | null>(null);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [assignedAdminUserId, setAssignedAdminUserId] = useState("UNASSIGNED");
  const [targetStatus, setTargetStatus] = useState("BUSINESS_VERIFICATION");
  const [reason, setReason] = useState("");
  const [section, setSection] = useState("BUSINESS_VERIFICATION");
  const [reviewStatus, setReviewStatus] = useState("PENDING");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch(
      `/api/admin/supplier-applications/${applicationId}`,
      { cache: "no-store" },
    );
    const result = (await response.json().catch(() => null)) as {
      application?: AdminApplication;
      reviewers?: Reviewer[];
      error?: string;
    } | null;
    if (!response.ok || !result?.application)
      setError(result?.error ?? copy.loadError);
    else {
      setApplication(result.application);
      setReviewers(result.reviewers ?? []);
      setAssignedAdminUserId(
        result.application.assignedAdmin?.id ?? "UNASSIGNED",
      );
      setError(null);
    }
  }, [applicationId, copy.loadError]);
  useEffect(() => {
    const deferredLoad = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(deferredLoad);
  }, [load]);
  const write = async (
    path: "transition" | "reviews" | "information-requests",
    payload: Record<string, unknown>,
  ) => {
    setSaving(true);
    setError(null);
    const response = await fetch(
      `/api/admin/supplier-applications/${applicationId}/${path}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (!response.ok) setError(result?.error ?? copy.actionError);
    else await load();
    setSaving(false);
  };
  const assignReviewer = async () => {
    setSaving(true);
    setError(null);
    const response = await fetch(
      `/api/admin/supplier-applications/${applicationId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedAdminUserId:
            assignedAdminUserId === "UNASSIGNED" ? null : assignedAdminUserId,
        }),
      },
    );
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (!response.ok) setError(result?.error ?? copy.actionError);
    else await load();
    setSaving(false);
  };
  if (!application)
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <CometSpinner size="xs" />
        {copy.loadError}
      </div>
    );
  return (
    <div className="grid gap-6">
      <Button
        variant="outline"
        className="w-fit"
        render={
          <Link href={withLocale("/admin/supplier-applications", locale)} />
        }
      >
        <ArrowLeft aria-hidden="true" />
        {copy.back}
      </Button>
      <header>
        <p className="text-sm text-muted-foreground">
          {application.applicationNumber}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {application.legalCompanyName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {application.applicant.displayName} · {application.applicant.email}
        </p>
      </header>
      {error ? (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{copy.transition}</CardTitle>
            <CardDescription>{pretty(application.status)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field>
              <FieldLabel>{copy.assignedAdmin}</FieldLabel>
              <Select
                value={assignedAdminUserId}
                onValueChange={(value) =>
                  setAssignedAdminUserId(value ?? "UNASSIGNED")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNASSIGNED">{copy.unassigned}</SelectItem>
                  {reviewers.map((reviewer) => (
                    <SelectItem key={reviewer.id} value={reviewer.id}>
                      {reviewer.displayName} · {reviewer.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => void assignReviewer()}
            >
              {copy.assignReviewer}
            </Button>
            <Field>
              <FieldLabel>{copy.status}</FieldLabel>
              <Select
                value={targetStatus}
                onValueChange={(value) => setTargetStatus(value ?? "")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {pretty(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{copy.reason}</FieldLabel>
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
            <Button
              disabled={saving}
              onClick={() => void write("transition", { targetStatus, reason })}
            >
              {copy.transition}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{copy.saveReview}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field>
              <FieldLabel>{copy.reviewSection}</FieldLabel>
              <Select
                value={section}
                onValueChange={(value) => setSection(value ?? "")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sectionOptions.map((item) => (
                    <SelectItem key={item} value={item}>
                      {pretty(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{copy.reviewStatus}</FieldLabel>
              <Select
                value={reviewStatus}
                onValueChange={(value) => setReviewStatus(value ?? "")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reviewOptions.map((item) => (
                    <SelectItem key={item} value={item}>
                      {pretty(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{copy.reason}</FieldLabel>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
            <Button
              disabled={saving}
              onClick={() =>
                void write("reviews", { section, status: reviewStatus, notes })
              }
            >
              {copy.saveReview}
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{copy.requestInformation}</CardTitle>
          <CardDescription>
            {application.informationRequests.length} open or historical requests
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={copy.reason}
          />
          <Button
            disabled={saving || !notes.trim()}
            onClick={() =>
              void write("information-requests", {
                section,
                message: notes,
                targetStatus: "ADDITIONAL_INFORMATION_REQUIRED",
              })
            }
          >
            {copy.requestInformation}
          </Button>
        </CardContent>
      </Card>
      {application.informationRequests.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Information request responses</CardTitle>
            <CardDescription>
              Applicant responses remain unresolved until an administrator
              explicitly closes the request.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {application.informationRequests.map((request) => (
              <AdminInformationRequestRow
                key={request.id}
                applicationId={applicationId}
                request={request}
                disabled={saving}
                onSaving={setSaving}
                onError={setError}
                onSaved={load}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Brand verifications</CardTitle>
          <CardDescription>
            Review each active brand independently. Section reviews are audit
            records and do not mutate brand status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {application.brandVerifications.length ? (
            application.brandVerifications.map((brand) => (
              <BrandReviewRow
                key={brand.id}
                applicationId={applicationId}
                brand={brand}
                disabled={saving}
                onSaving={setSaving}
                onError={setError}
                onSaved={load}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <ReviewList
          title={copy.documents}
          rows={application.documents.map(
            (document) =>
              `${document.originalFilename} · ${pretty(document.documentType)} · ${pretty(document.reviewStatus)}`,
          )}
        />
        <ReviewList
          title={copy.inventory}
          rows={application.inventorySamples.map(
            (sample) =>
              `${sample.originalFilename} · ${sample.validRows}/${sample.totalRows} valid · ${pretty(sample.reviewStatus)}`,
          )}
        />
        <ReviewList
          title={copy.risk}
          rows={application.duplicateFlags.map(
            (flag) =>
              `${pretty(flag.signal)}${flag.resolvedAt ? " · resolved" : ""}`,
          )}
        />
        <ReviewList
          title={copy.status}
          rows={application.statusHistory.map(
            (event) =>
              `${pretty(event.toStatus)}${event.reason ? ` — ${event.reason}` : ""}`,
          )}
        />
      </div>
    </div>
  );
}

function AdminInformationRequestRow({
  applicationId,
  request,
  disabled,
  onSaving,
  onError,
  onSaved,
}: {
  applicationId: string;
  request: AdminApplication["informationRequests"][number];
  disabled: boolean;
  onSaving: (saving: boolean) => void;
  onError: (error: string | null) => void;
  onSaved: () => Promise<void>;
}) {
  const [resolutionNote, setResolutionNote] = useState(
    request.resolutionNote ?? "",
  );
  const resolve = async () => {
    onSaving(true);
    onError(null);
    const response = await fetch(
      `/api/admin/supplier-applications/${applicationId}/information-requests/${request.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutionNote }),
      },
    );
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (!response.ok)
      onError(result?.error ?? "Unable to resolve the information request.");
    else await onSaved();
    onSaving(false);
  };
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{pretty(request.section)}</p>
        <Badge variant={request.resolvedAt ? "secondary" : "outline"}>
          {request.resolvedAt ? "Resolved" : "Open"}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{request.message}</p>
      <div className="rounded-md bg-muted p-3 text-sm">
        {request.applicantResponse ?? "No applicant response yet."}
      </div>
      {!request.resolvedAt ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field className="flex-1">
            <FieldLabel>Resolution note</FieldLabel>
            <Input
              value={resolutionNote}
              onChange={(event) => setResolutionNote(event.target.value)}
            />
          </Field>
          <Button
            variant="outline"
            disabled={disabled || !resolutionNote.trim()}
            onClick={() => void resolve()}
          >
            Resolve request
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const brandStatusOptions = [
  "PENDING",
  "VERIFIED",
  "ADDITIONAL_EVIDENCE_REQUIRED",
  "RESTRICTED",
  "REJECTED",
  "EXPIRED",
];

function BrandReviewRow({
  applicationId,
  brand,
  disabled,
  onSaving,
  onError,
  onSaved,
}: {
  applicationId: string;
  brand: AdminApplication["brandVerifications"][number];
  disabled: boolean;
  onSaving: (saving: boolean) => void;
  onError: (error: string | null) => void;
  onSaved: () => Promise<void>;
}) {
  const [status, setStatus] = useState(brand.status);
  const [evidenceStatus, setEvidenceStatus] = useState(brand.evidenceStatus);
  const [reviewNotes, setReviewNotes] = useState(brand.reviewNotes);
  const [expiresAt, setExpiresAt] = useState(
    brand.expiresAt?.slice(0, 10) ?? "",
  );
  const [countryRestrictions, setCountryRestrictions] = useState(
    brand.countryRestrictions.join(", "),
  );
  const [reason, setReason] = useState("");
  const save = async () => {
    onSaving(true);
    onError(null);
    const response = await fetch(
      `/api/admin/supplier-applications/${applicationId}/brands/${brand.id}/review`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          evidenceStatus,
          reviewNotes,
          expiresAt: expiresAt ? `${expiresAt}T23:59:59.999Z` : null,
          countryRestrictions: countryRestrictions
            .split(",")
            .map((country) => country.trim())
            .filter(Boolean),
          reason,
        }),
      },
    );
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (!response.ok) onError(result?.error ?? "Unable to review this brand.");
    else {
      setReason("");
      await onSaved();
    }
    onSaving(false);
  };
  return (
    <div className="grid gap-3 rounded-lg border p-4 lg:grid-cols-2">
      <div className="flex items-center gap-2 lg:col-span-2">
        <p className="font-medium">{brand.brand}</p>
        <Badge variant={brand.isActive ? "secondary" : "outline"}>
          {brand.isActive ? "Active" : "Removed"}
        </Badge>
      </div>
      <Field>
        <FieldLabel>Status</FieldLabel>
        <Select value={status} onValueChange={(value) => setStatus(value ?? "")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {brandStatusOptions.map((option) => (
              <SelectItem key={option} value={option}>{pretty(option)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>Evidence status</FieldLabel>
        <Select value={evidenceStatus} onValueChange={(value) => setEvidenceStatus(value ?? "")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {reviewOptions.map((option) => (
              <SelectItem key={option} value={option}>{pretty(option)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>Expires at</FieldLabel>
        <Input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
      </Field>
      <Field>
        <FieldLabel>Country restrictions</FieldLabel>
        <Input value={countryRestrictions} onChange={(event) => setCountryRestrictions(event.target.value)} />
      </Field>
      <Field>
        <FieldLabel>Review notes</FieldLabel>
        <Textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} />
      </Field>
      <Field>
        <FieldLabel>Reason</FieldLabel>
        <Textarea required value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <Button
        className="w-fit lg:col-span-2"
        disabled={disabled || !brand.isActive || !reason.trim()}
        onClick={() => void save()}
      >
        Review brand
      </Button>
    </div>
  );
}

function ReviewList({ title, rows }: { title: string; rows: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <ul className="space-y-2 text-sm text-muted-foreground">
            {rows.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </CardContent>
    </Card>
  );
}
