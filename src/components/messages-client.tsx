"use client";

import {
  ChevronLeft,
  CreditCard,
  Download,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  MoreVertical,
  Paperclip,
  Search,
  Send,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";

import { AdminBadge } from "@/components/admin-badge";
import { useI18n } from "@/components/i18n-provider";
import { CompanyLogo } from "@/components/profile-identity";
import { useUserContext } from "@/hooks/use-user-context";
import { withLocale } from "@/lib/i18n";
import {
  formatBytes,
  MESSAGE_ATTACHMENT_ALLOWED_EXTENSIONS,
  MESSAGE_ATTACHMENT_LIMITS,
} from "@/lib/message-attachment-rules";
import { getMessageTradeDealState } from "@/lib/message-trade-ui";
import { safeExternalUrl } from "@/lib/url-security";
import { cx, formatDate } from "@/lib/utils";
import {
  decidePaymentCheckoutResponse,
  type PaymentCheckoutResponsePayload,
} from "@/lib/payment-checkout-client-response";

type DealSummary = {
  id: string;
  dealStatus: "proposed" | "in_progress" | "completion_requested" | "completed" | "cancelled" | "disputed";
  confirmedByBuyer: boolean;
  confirmedBySeller: boolean;
  reviews: Array<{ id: string; reviewerCompanyId: string }>;
};

type PaymentRequestSummary = {
  id: string;
  productName: string;
  quantity: string;
  unit: string;
  productAmount: number;
  shippingAmount: number;
  grossAmount: number;
  platformFeeAmount: number;
  sellerPayableAmount: number;
  stripeProcessingFeeAmount: number | null;
  refundAmount: number;
  currency: string;
  paymentDueDate: string;
  orderTerms: string;
  status:
    | "PENDING"
    | "PAID"
    | "RELEASED"
    | "CANCELLED"
    | "PARTIALLY_REFUNDED"
    | "REFUNDED"
    | "DISPUTED";
  paidAt: string | null;
  cancelledAt: string | null;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
  disputes: Array<{ status: string; reason: string | null; updatedAt: string }>;
  events: Array<{
    id: string;
    eventType:
      | "CREATED"
      | "CHECKOUT_STARTED"
      | "PAID"
      | "RELEASED"
      | "CANCELLED"
      | "PARTIALLY_REFUNDED"
      | "REFUNDED"
      | "DISPUTE_OPENED"
      | "DISPUTE_UPDATED"
      | "DISPUTE_CLOSED"
      | "RECONCILIATION_REQUIRED";
    message: string | null;
    createdAt: string;
  }>;
};

type ThreadCompany = {
  id: string;
  legalName: string;
  tradeName?: string;
  logoOriginalUrl?: string | null;
  logoThumbnailUrl?: string | null;
  logoUrl?: string | null;
  useDefaultLogo: boolean;
  companyRole: "seller" | "buyer";
  verificationStatus: string;
  isTrade82Team?: boolean;
};

type InquiryThread = {
  id: string;
  message: string;
  createdAt: string;
  quantity: string | null;
  targetDate: string | null;
  status: string;
  updatedAt: string;
  recipientCompanyId: string;
  buyerCompany: ThreadCompany;
  sellerCompany: ThreadCompany;
  product: {
    id: string;
    name: string;
    imageUrl?: string | null;
    category?: string | null;
    slug?: string | null;
  } | null;
  messages: Array<{
    id: string;
    body: string;
    createdAt: string;
    senderCompanyId: string | null;
    attachments: MessageAttachment[];
  }>;
  deals?: DealSummary[];
  paymentRequests?: PaymentRequestSummary[];
  viewerCompanyIds?: string[];
  unreadCount?: number;
};

type MessageAttachment = {
  id: string;
  messageId: string | null;
  inquiryId: string;
  originalFilename: string;
  storedFilename?: string;
  mimeType: string;
  fileType: "image" | "pdf" | "document";
  sizeBytes: number;
  status: string;
  createdAt: string;
  uploadedByUserId?: string;
  uploadedByCompanyId?: string;
  uploadedByUser?: { displayName: string };
  uploadedByCompany?: { legalName: string; tradeName?: string | null };
};

type DraftAttachment = {
  localId: string;
  file: File;
  previewUrl: string | null;
  status: "uploading" | "uploaded" | "failed";
  progress: number;
  error: string;
  attachment?: MessageAttachment;
};

type ChatRoomContextMenuState = {
  threadId: string;
  x: number;
  y: number;
};

type ChatRoomContextMenuAction =
  | "open"
  | "rename"
  | "pin"
  | "favorite"
  | "notifications"
  | "leave";

type MobileThreadFilter =
  | "all"
  | "waiting"
  | "in_progress"
  | "completed"
  | "archived";

type SignedUrlPayload = {
  signedUrl: string;
  expiresInSeconds: number;
  filename: string;
  mimeType: string;
};

const MESSAGE_COMPOSER_MAX_LENGTH = 2000;

type InquiryThreadsResponse = {
  inquiries: InquiryThread[];
  paymentFeature: { enabled: boolean };
};

async function fetchInquiryThreads(): Promise<InquiryThreadsResponse> {
  const response = await fetch("/api/inquiries");
  const payload = (await response.json().catch(() => null)) as
    | InquiryThread[]
    | { inquiries?: InquiryThread[]; paymentFeature?: { enabled?: boolean }; error?: string }
    | null;
  if (!response.ok) {
    throw new Error(
      !Array.isArray(payload) && typeof payload?.error === "string"
        ? payload.error
        : "Unable to load conversations.",
    );
  }
  if (Array.isArray(payload)) {
    return { inquiries: payload, paymentFeature: { enabled: false } };
  }
  if (!payload || !Array.isArray(payload.inquiries)) {
    throw new Error("Unable to load conversations.");
  }
  return {
    inquiries: payload.inquiries,
    paymentFeature: { enabled: payload.paymentFeature?.enabled === true },
  };
}

function isDealSummary(value: DealSummary | { error?: string } | null): value is DealSummary {
  return Boolean(value && "id" in value && "dealStatus" in value);
}

function getDealError(value: DealSummary | { error?: string } | null) {
  return value && "error" in value ? value.error : null;
}

export function MessagesClient({
  initialInquiryId = null,
}: {
  initialInquiryId?: string | null;
}) {
  const { locale, t } = useI18n();
  const [threads, setThreads] = useState<InquiryThread[]>([]);
  const [paymentFeatureEnabled, setPaymentFeatureEnabled] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialInquiryId,
  );
  const [reply, setReply] = useState("");
  const [threadSearch, setThreadSearch] = useState("");
  const [draftAttachments, setDraftAttachments] = useState<DraftAttachment[]>([]);
  const [composerError, setComposerError] = useState("");
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryFilter, setLibraryFilter] = useState<"all" | "image" | "pdf">("all");
  const [previewAttachment, setPreviewAttachment] = useState<MessageAttachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [dealPending, setDealPending] = useState(false);
  const [dealError, setDealError] = useState("");
  const [contextMenu, setContextMenu] = useState<ChatRoomContextMenuState | null>(null);
  const [pinnedThreadIds, setPinnedThreadIds] = useState<Set<string>>(() => new Set());
  const [favoriteThreadIds, setFavoriteThreadIds] = useState<Set<string>>(() => new Set());
  const [mutedThreadIds, setMutedThreadIds] = useState<Set<string>>(() => new Set());
  const [mobileChatOpen, setMobileChatOpen] = useState(Boolean(initialInquiryId));
  const [mobileAttachmentSheetOpen, setMobileAttachmentSheetOpen] = useState(false);
  const [mobileDealSheetOpen, setMobileDealSheetOpen] = useState(false);
  const [completionDialogThread, setCompletionDialogThread] = useState<InquiryThread | null>(null);
  const [mobileFilter, setMobileFilter] = useState<MobileThreadFilter>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftAttachmentsRef = useRef<DraftAttachment[]>([]);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mobileMessagesEndRef = useRef<HTMLDivElement>(null);
  const mobileChatOpenRef = useRef(mobileChatOpen);
  const pushedMobileHistoryRef = useRef(false);

  async function load() {
    try {
      const result = await fetchInquiryThreads();
      setThreads(result.inquiries);
      setPaymentFeatureEnabled(result.paymentFeature.enabled);
      setLoadError("");
    } catch (error) {
      setLoadError(
        error instanceof Error && error.message
          ? error.message
          : t("messages.loadFailed", "Unable to load conversations. Please refresh and try again."),
      );
    }
  }

  useEffect(() => {
    let active = true;
    void fetchInquiryThreads()
      .then((result) => {
        if (!active) return;
        setThreads(result.inquiries);
        setPaymentFeatureEnabled(result.paymentFeature.enabled);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(
          error instanceof Error && error.message
            ? error.message
            : t("messages.loadFailed", "Unable to load conversations. Please refresh and try again."),
        );
      });
    return () => {
      active = false;
    };
  }, [t]);

  const selected = useMemo(
    () => threads.find((thread) => thread.id === selectedId) ?? threads[0],
    [selectedId, threads],
  );
  const hasPendingUploads = draftAttachments.some((item) => item.status === "uploading");
  const hasComposerContent =
    Boolean(reply.trim()) ||
    draftAttachments.some((item) => item.status === "uploaded");
  const lastMessageId =
    selected?.messages.at(-1)?.id ??
    (selected?.message.trim() ? selected.id : "");
  const libraryAttachments = useMemo(() => {
    if (!selected) return [];
    const search = librarySearch.trim().toLowerCase();
    return selected.messages
      .flatMap((message) =>
        message.attachments.map((attachment) => ({
          ...attachment,
          messageId: message.id,
        })),
      )
      .filter((attachment) => {
        const matchesFilter =
          libraryFilter === "all" ||
          (libraryFilter === "image" && attachment.fileType === "image") ||
          (libraryFilter === "pdf" && attachment.fileType === "pdf");
        const matchesSearch =
          !search || attachment.originalFilename.toLowerCase().includes(search);
        return matchesFilter && matchesSearch;
      });
  }, [libraryFilter, librarySearch, selected]);
  const visibleThreads = useMemo(
    () => getCanonicalInquiryThreads(threads),
    [threads],
  );
  const desktopVisibleThreads = useMemo(() => {
    const query = threadSearch.trim().toLowerCase();
    if (!query) return visibleThreads;
    return visibleThreads.filter((thread) => {
      const companyName = getCompanyDisplayName(getCounterparty(thread), t).toLowerCase();
      return [companyName, thread.product?.name ?? "", getLatestThreadPreview(thread, t)]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [t, threadSearch, visibleThreads]);
  const mobileVisibleThreads = useMemo(
    () =>
      mobileFilter === "all"
        ? visibleThreads
        : visibleThreads.filter(
            (thread) => getMobileThreadStatus(thread) === mobileFilter,
          ),
    [mobileFilter, visibleThreads],
  );
  const contextMenuThread = useMemo(
    () => visibleThreads.find((thread) => thread.id === contextMenu?.threadId) ?? null,
    [contextMenu?.threadId, visibleThreads],
  );

  useEffect(() => {
    draftAttachmentsRef.current = draftAttachments;
  }, [draftAttachments]);

  useEffect(() => {
    return () => {
      draftAttachmentsRef.current.forEach((attachment) => {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
    mobileMessagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [lastMessageId, selected?.id]);

  useEffect(() => {
    mobileChatOpenRef.current = mobileChatOpen;
  }, [mobileChatOpen]);

  useEffect(() => {
    function handlePopState() {
      if (!mobileChatOpenRef.current || !pushedMobileHistoryRef.current) return;
      pushedMobileHistoryRef.current = false;
      setMobileChatOpen(false);
      setMobileAttachmentSheetOpen(false);
      setMobileDealSheetOpen(false);
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  async function submitReply() {
    if (!selected) return;
    const uploadedAttachments = draftAttachments
      .filter((attachment) => attachment.status === "uploaded" && attachment.attachment)
      .map((attachment) => attachment.attachment as MessageAttachment);
    if (!reply.trim() && !uploadedAttachments.length) return;
    if (draftAttachments.some((attachment) => attachment.status === "uploading")) {
      setComposerError(t("messages.sendBlockedWhileUploading"));
      return;
    }
    if (draftAttachments.some((attachment) => attachment.status === "failed")) {
      setComposerError(t("messages.uploadFailed"));
      return;
    }
    const response = await fetch(`/api/inquiries/${selected.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: reply.trim(),
        attachmentIds: uploadedAttachments.map((attachment) => attachment.id),
      }),
    });
    if (response.ok) {
      setReply("");
      clearDraftAttachments();
      setComposerError("");
      await load();
    } else {
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      setComposerError(result?.error ?? t("messages.messageSendFailed"));
    }
  }

  function clearDraftAttachments() {
    setDraftAttachments((current) => {
      current.forEach((attachment) => {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      });
      return [];
    });
  }

  function selectThread(id: string) {
    if (id !== selectedId) {
      clearDraftAttachments();
      setComposerError("");
      setReply("");
    }
    setSelectedId(id);
    setDealError("");
  }

  function openThreadContextMenu(threadId: string, clientX: number, clientY: number) {
    const menuWidth = 244;
    const menuHeight = 300;
    const x = Math.max(8, Math.min(clientX, window.innerWidth - menuWidth - 8));
    const y = Math.max(8, Math.min(clientY, window.innerHeight - menuHeight - 8));
    setContextMenu({ threadId, x, y });
  }

  function handleThreadContextMenu(
    event: ReactMouseEvent<HTMLButtonElement>,
    threadId: string,
  ) {
    event.preventDefault();
    openThreadContextMenu(threadId, event.clientX, event.clientY);
  }

  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, []);

  function handleThreadPointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    threadId: string,
  ) {
    if (event.pointerType === "mouse") return;
    clearLongPressTimer();
    longPressTriggeredRef.current = false;
    const { clientX, clientY } = event;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      openThreadContextMenu(threadId, clientX, clientY);
    }, 550);
  }

  function handleThreadPressEnd() {
    clearLongPressTimer();
  }

  function handleThreadClick(threadId: string) {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    setContextMenu(null);
    selectThread(threadId);
  }

  function openMobileThread(threadId: string) {
    setContextMenu(null);
    selectThread(threadId);
    setMobileAttachmentSheetOpen(false);
    setMobileDealSheetOpen(false);
    setMobileChatOpen(true);
    if (
      typeof window !== "undefined" &&
      window.innerWidth < 768 &&
      !pushedMobileHistoryRef.current
    ) {
      window.history.pushState(
        { trade82MobileMessages: true, threadId },
        "",
        window.location.href,
      );
      pushedMobileHistoryRef.current = true;
    }
  }

  function closeMobileThread() {
    setMobileChatOpen(false);
    setMobileAttachmentSheetOpen(false);
    setMobileDealSheetOpen(false);
    if (pushedMobileHistoryRef.current && typeof window !== "undefined") {
      pushedMobileHistoryRef.current = false;
      window.history.back();
    }
  }

  function toggleThreadSet(
    setter: Dispatch<SetStateAction<Set<string>>>,
    threadId: string,
  ) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  }

  function handleContextMenuAction(action: ChatRoomContextMenuAction) {
    if (!contextMenu) return;
    const { threadId } = contextMenu;
    if (action === "open") {
      selectThread(threadId);
    }
    if (action === "pin") {
      toggleThreadSet(setPinnedThreadIds, threadId);
    }
    if (action === "favorite") {
      toggleThreadSet(setFavoriteThreadIds, threadId);
    }
    if (action === "notifications") {
      toggleThreadSet(setMutedThreadIds, threadId);
    }
    setContextMenu(null);
  }

  function addFiles(files: FileList | File[]) {
    if (!selected) return;
    setMobileAttachmentSheetOpen(false);
    setComposerError("");
    const incoming = Array.from(files);
    const openSlots = MESSAGE_ATTACHMENT_LIMITS.maxFilesPerMessage - draftAttachments.length;
    const limited = incoming.slice(0, Math.max(0, openSlots));
    if (!limited.length) return;
    limited.forEach((file) => {
      const localId = crypto.randomUUID();
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      const draft: DraftAttachment = {
        localId,
        file,
        previewUrl,
        status: "uploading",
        progress: 0,
        error: "",
      };
      setDraftAttachments((current) => [...current, draft]);
      void uploadDraftAttachment(selected.id, draft);
    });
  }

  function uploadDraftAttachment(inquiryId: string, draft: DraftAttachment) {
    const clientError = validateClientAttachment(draft.file);
    if (clientError) {
      updateDraftAttachment(draft.localId, {
        status: "failed",
        progress: 0,
        error: clientError,
      });
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const request = new XMLHttpRequest();
      const formData = new FormData();
      formData.set("inquiryId", inquiryId);
      formData.set("file", draft.file);

      request.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return;
        updateDraftAttachment(draft.localId, {
          progress: Math.round((event.loaded / event.total) * 100),
        });
      });
      request.addEventListener("load", () => {
        if (request.status >= 200 && request.status < 300) {
          const attachment = JSON.parse(request.responseText) as MessageAttachment;
          updateDraftAttachment(draft.localId, {
            status: "uploaded",
            progress: 100,
            attachment,
            error: "",
          });
        } else {
          const result = safeParseJson(request.responseText);
          updateDraftAttachment(draft.localId, {
            status: "failed",
            progress: 0,
            error: result?.error ?? t("messages.uploadFailed"),
          });
        }
        resolve();
      });
      request.addEventListener("error", () => {
        updateDraftAttachment(draft.localId, {
          status: "failed",
          progress: 0,
          error: t("messages.uploadFailed"),
        });
        resolve();
      });
      request.open("POST", "/api/messages/attachments/upload");
      request.send(formData);
    });
  }

  function retryDraftAttachment(localId: string) {
    if (!selected) return;
    const draft = draftAttachments.find((item) => item.localId === localId);
    if (!draft) return;
    updateDraftAttachment(localId, { status: "uploading", progress: 0, error: "" });
    void uploadDraftAttachment(selected.id, draft);
  }

  function updateDraftAttachment(
    localId: string,
    patch: Partial<DraftAttachment>,
  ) {
    setDraftAttachments((current) =>
      current.map((attachment) =>
        attachment.localId === localId ? { ...attachment, ...patch } : attachment,
      ),
    );
  }

  function removeDraftAttachment(localId: string) {
    setDraftAttachments((current) => {
      const removed = current.find((attachment) => attachment.localId === localId);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((attachment) => attachment.localId !== localId);
    });
  }

  async function openAttachment(attachment: MessageAttachment) {
    setPreviewLoading(true);
    const signedUrl = await fetchSignedUrl(attachment.id);
    setPreviewLoading(false);
    if (!signedUrl) return;
    if (attachment.fileType === "image") {
      setPreviewAttachment(attachment);
      setPreviewUrl(signedUrl);
      return;
    }
    window.open(signedUrl, "_blank", "noopener,noreferrer");
  }

  async function fetchSignedUrl(id: string) {
    const response = await fetch(`/api/messages/attachments/${id}/signed-url`);
    const result = (await response.json().catch(() => null)) as
      | SignedUrlPayload
      | { error?: string }
      | null;
    if (!response.ok || !result || !("signedUrl" in result)) {
      setComposerError(result && "error" in result ? result.error ?? "" : t("messages.messageSendFailed"));
      return "";
    }
    return result.signedUrl;
  }

  function jumpToMessage(messageId: string | null) {
    if (!messageId) return;
    document.getElementById(`message-${messageId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  function updateThreadDeal(threadId: string, deal: DealSummary) {
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              deals: [
                deal,
                ...(thread.deals ?? []).filter((item) => item.id !== deal.id),
              ],
            }
          : thread,
      ),
    );
  }

  async function createDeal(thread: InquiryThread) {
    setDealPending(true);
    setDealError("");
    try {
      const response = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiryId: thread.id }),
      });
      const result = (await response.json().catch(() => null)) as
        | DealSummary
        | { error?: string }
        | null;
      if (!response.ok || !isDealSummary(result)) {
        setDealError(getDealError(result) ?? t("deals.actionFailed"));
        return;
      }
      updateThreadDeal(thread.id, result);
    } catch {
      setDealError(t("deals.actionFailed"));
    } finally {
      setDealPending(false);
    }
  }

  async function updateDeal(
    thread: InquiryThread,
    deal: DealSummary,
    action: "mark_in_progress" | "request_completion" | "confirm_completion",
  ) {
    setDealPending(true);
    setDealError("");
    try {
      const response = await fetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = (await response.json().catch(() => null)) as
        | DealSummary
        | { error?: string }
        | null;
      if (!response.ok || !isDealSummary(result)) {
        setDealError(getDealError(result) ?? t("deals.actionFailed"));
        return false;
      }
      updateThreadDeal(thread.id, result);
      return true;
    } catch {
      setDealError(t("deals.actionFailed"));
      return false;
    } finally {
      setDealPending(false);
    }
  }

  if (!visibleThreads.length) {
    return (
      <>
        {loadError ? (
          <p role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {loadError}
          </p>
        ) : null}
        <div className="min-h-0 flex-1 md:hidden">
          <MobileConversationList
            threads={mobileVisibleThreads}
            activeFilter={mobileFilter}
            onFilter={setMobileFilter}
            onOpenThread={openMobileThread}
          />
        </div>
        <div className="hidden flex-1 items-center justify-center rounded-lg border border-dashed p-8 text-center theme-surface md:flex">
          <div>
            <h2 className="text-lg font-semibold theme-foreground">{t("messages.emptyTitle")}</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 theme-muted">{t("messages.emptyText")}</p>
            <Link
              href={withLocale("/marketplace", locale)}
              className="mt-5 inline-flex rounded-md px-4 py-2 text-sm font-medium theme-primary-button"
            >
              {t("common.browseProducts")}
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {loadError ? (
        <p role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {loadError}
        </p>
      ) : null}
      <div className="min-h-0 flex-1 md:hidden">
        {!mobileChatOpen ? (
          <MobileConversationList
            threads={mobileVisibleThreads}
            activeFilter={mobileFilter}
            onFilter={setMobileFilter}
            onOpenThread={openMobileThread}
          />
        ) : selected ? (
          <MobileChatDetail
            thread={selected}
            reply={reply}
            draftAttachments={draftAttachments}
            composerError={composerError}
            hasPendingUploads={hasPendingUploads}
            hasComposerContent={hasComposerContent}
            libraryAttachments={libraryAttachments}
            libraryFilter={libraryFilter}
            librarySearch={librarySearch}
            attachmentSheetOpen={mobileAttachmentSheetOpen}
            dealSheetOpen={mobileDealSheetOpen}
            messagesEndRef={mobileMessagesEndRef}
            fileInputRef={fileInputRef}
            onBack={closeMobileThread}
            onReplyChange={setReply}
            onSubmitReply={() => void submitReply()}
            onAddFiles={addFiles}
            onRemoveDraftAttachment={removeDraftAttachment}
            onRetryDraftAttachment={retryDraftAttachment}
            onOpenAttachment={openAttachment}
            onJumpToMessage={jumpToMessage}
            onFilterFiles={setLibraryFilter}
            onSearchFiles={setLibrarySearch}
            onOpenAttachmentSheet={() => setMobileAttachmentSheetOpen(true)}
            onCloseAttachmentSheet={() => setMobileAttachmentSheetOpen(false)}
            onOpenDealSheet={() => setMobileDealSheetOpen(true)}
            onCloseDealSheet={() => setMobileDealSheetOpen(false)}
            dealPending={dealPending}
            dealError={dealError}
            onCreateDeal={() => void createDeal(selected)}
            onUpdateDeal={(deal, action) => void updateDeal(selected, deal, action)}
            onReviewCompletion={() => setCompletionDialogThread(selected)}
            onPaymentUpdated={() => void load()}
            paymentFeatureEnabled={paymentFeatureEnabled}
          />
        ) : null}
      </div>

      <div className="hidden min-h-0 flex-1 overflow-hidden rounded-lg border theme-surface-elevated md:grid md:grid-cols-[280px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)_300px]">
        <aside className="flex min-h-0 flex-col border-r theme-border">
          <div className="border-b p-3 theme-border">
            <label className="flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-white px-2.5 text-sm text-zinc-500 focus-within:border-[#34B386] focus-within:ring-2 focus-within:ring-[#34B386]/10">
              <Search className="size-4 shrink-0" />
              <input
                value={threadSearch}
                onChange={(event) => setThreadSearch(event.target.value)}
                placeholder={t("messages.searchConversations")}
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-zinc-400"
              />
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
          {desktopVisibleThreads.map((thread) => {
            const company = getCounterparty(thread);
            const companyName = getCompanyDisplayName(company, t);
            const unreadCount = normalizeUnreadCount(thread.unreadCount);
            const isSelected =
              selected?.id === thread.id ||
              (selected ? getThreadParticipantKey(selected) === getThreadParticipantKey(thread) : false);
            return (
              <button
                key={thread.id}
                type="button"
                aria-haspopup="menu"
                onClick={() => handleThreadClick(thread.id)}
                onContextMenu={(event) => handleThreadContextMenu(event, thread.id)}
                onPointerDown={(event) => handleThreadPointerDown(event, thread.id)}
                onPointerUp={handleThreadPressEnd}
                onPointerCancel={handleThreadPressEnd}
                onPointerLeave={handleThreadPressEnd}
                className={`relative flex w-full gap-3 border-b px-3 py-3 pr-10 text-left theme-border ${isSelected ? "theme-surface-muted" : "hover:bg-[var(--muted)]"}`}
              >
                <CompanyLogo companyName={companyName} logoUrl={company.logoThumbnailUrl || company.logoUrl || undefined} useDefaultLogo={company.useDefaultLogo} size="sm" />
                <div className="min-w-0">
                  <p className="flex min-w-0 items-center gap-1.5 font-medium theme-foreground">
                    <span className="truncate">{companyName}</span>
                    {company.isTrade82Team ? <AdminBadge compact /> : null}
                  </p>
                  <p className="truncate text-xs theme-muted">{thread.product?.name || t("messages.sellerInquiry")}</p>
                  <p className="mt-1 truncate text-xs theme-muted">{getLatestThreadPreview(thread, t)}</p>
                  <p className="mt-1.5 text-[11px] theme-muted">{formatDate(thread.updatedAt)}</p>
                </div>
                <UnreadMessageBadge count={unreadCount} className="right-3 top-3" />
              </button>
            );
          })}
          {!desktopVisibleThreads.length ? (
            <p className="px-3 py-6 text-center text-sm text-zinc-500">{t("messages.noConversationsForFilter")}</p>
          ) : null}
          </div>
        </aside>
        {selected ? (
          <section className="flex min-h-0 flex-col">
            <ConversationHeader thread={selected} />
            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-[var(--muted)] p-5">
              <MessageTimeline
                thread={selected}
                paymentFeatureEnabled={paymentFeatureEnabled}
                onOpenAttachment={openAttachment}
                onPaymentUpdated={() => void load()}
              />
              <div ref={messagesEndRef} aria-hidden="true" />
            </div>
            <MessageTradeActionBar
              thread={selected}
              pending={dealPending}
              error={dealError}
              onReview={() => setCompletionDialogThread(selected)}
            />
            <footer className="shrink-0 border-t theme-border bg-[var(--card-elevated)] p-3">
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  addFiles(event.dataTransfer.files);
                }}
                className="rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-zinc-950 shadow-sm transition focus-within:border-[#64AF8B]/60 focus-within:ring-2 focus-within:ring-[#64AF8B]/10"
              >
                <textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  maxLength={MESSAGE_COMPOSER_MAX_LENGTH}
                  rows={3}
                  placeholder={t("messages.replyPlaceholder")}
                  className="min-h-20 w-full resize-none border-0 bg-transparent px-1 py-1.5 text-sm leading-6 text-zinc-950 outline-none placeholder:text-zinc-400"
                />
                <AttachmentDraftList
                  items={draftAttachments}
                  onRemove={removeDraftAttachment}
                  onRetry={retryDraftAttachment}
                />
                <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-zinc-100 pt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(event) => {
                      if (event.target.files) addFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex size-8 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                    aria-label={t("messages.attachFiles")}
                  >
                    <ImageIcon className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex size-8 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                    aria-label={t("messages.attachFiles")}
                  >
                    <Paperclip className="size-4" />
                  </button>
                  <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    <span className="text-xs tabular-nums text-zinc-400">
                      {reply.length}/{MESSAGE_COMPOSER_MAX_LENGTH}
                    </span>
                    <button
                      type="button"
                      onClick={() => void submitReply()}
                      disabled={hasPendingUploads || !hasComposerContent}
                      className="inline-flex size-8 items-center justify-center rounded-full bg-zinc-950 text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
                      aria-label={t("messages.saveReply")}
                    >
                      <Send className="size-4" />
                    </button>
                  </div>
                </div>
                {composerError ? (
                  <p className="mt-2 text-xs font-medium text-red-700">{composerError}</p>
                ) : null}
              </div>
            </footer>
          </section>
        ) : null}
        {selected ? (
          <aside className="hidden min-h-0 flex-col border-l bg-white theme-border lg:flex">
            <TradeDetailsPanel
              thread={selected}
              pending={dealPending}
              error={dealError}
              onCreate={() => void createDeal(selected)}
              onUpdate={(deal, action) => void updateDeal(selected, deal, action)}
              paymentFeatureEnabled={paymentFeatureEnabled}
              onPaymentUpdated={() => void load()}
            />
            <AttachmentLibrary
              attachments={libraryAttachments}
              filter={libraryFilter}
              search={librarySearch}
              onFilter={setLibraryFilter}
              onSearch={setLibrarySearch}
              onOpen={openAttachment}
              onJump={jumpToMessage}
            />
          </aside>
        ) : null}
      </div>

      {previewAttachment && previewUrl ? (
        <ImagePreviewModal
          attachment={previewAttachment}
          url={previewUrl}
          loading={previewLoading}
          onClose={() => {
            setPreviewAttachment(null);
            setPreviewUrl("");
          }}
        />
      ) : null}
      {contextMenu && contextMenuThread ? (
        <ChatRoomContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          threadName={getCompanyDisplayName(getCounterparty(contextMenuThread), t)}
          pinned={pinnedThreadIds.has(contextMenu.threadId)}
          favorite={favoriteThreadIds.has(contextMenu.threadId)}
          notificationsEnabled={!mutedThreadIds.has(contextMenu.threadId)}
          onClose={() => setContextMenu(null)}
          onAction={handleContextMenuAction}
        />
      ) : null}
      {completionDialogThread ? (
        <CompletionConfirmationDialog
          thread={completionDialogThread}
          pending={dealPending}
          onClose={() => setCompletionDialogThread(null)}
          onConfirm={async () => {
            const deal = getActiveDeal(completionDialogThread);
            if (!deal) return false;
            return updateDeal(completionDialogThread, deal, "confirm_completion");
          }}
        />
      ) : null}
    </>
  );
}

function normalizeUnreadCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function formatUnreadCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

function UnreadMessageBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;

  return (
    <span
      aria-label={`${count} unread messages`}
      className={`absolute inline-flex items-center justify-center rounded-full bg-[#64AF8B] text-[10px] font-semibold leading-none text-white shadow-sm ${count > 99 ? "size-6 text-[9px]" : "size-5"} ${className ?? ""}`}
    >
      {formatUnreadCount(count)}
    </span>
  );
}

function MobileConversationList({
  threads,
  activeFilter,
  onFilter,
  onOpenThread,
}: {
  threads: InquiryThread[];
  activeFilter: MobileThreadFilter;
  onFilter: (filter: MobileThreadFilter) => void;
  onOpenThread: (threadId: string) => void;
}) {
  const { locale, t } = useI18n();
  const filters: Array<{ value: MobileThreadFilter; label: string }> = [
    { value: "all", label: t("messages.filterAll") },
    { value: "waiting", label: t("messages.filterWaiting") },
    { value: "in_progress", label: t("messages.filterInProgress") },
    { value: "completed", label: t("messages.filterCompleted") },
    { value: "archived", label: t("messages.filterArchived") },
  ];

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <header className="shrink-0 border-b border-zinc-100 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-950">
            {t("messages.mobileAllConversations")}
          </h2>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
            {threads.length}
          </span>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => onFilter(filter.value)}
              className={cx(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                activeFilter === filter.value
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {threads.length ? (
          threads.map((thread) => {
            const company = getCounterparty(thread);
            const companyName = getCompanyDisplayName(company, t);
            const unreadCount = normalizeUnreadCount(thread.unreadCount);
            const latestPreview = getLatestThreadPreview(thread, t);
            return (
              <button
                key={thread.id}
                type="button"
                onClick={() => onOpenThread(thread.id)}
                className="relative flex w-full gap-3 border-b border-zinc-100 px-4 py-3.5 text-left transition active:bg-zinc-50"
              >
                <CompanyLogo
                  companyName={companyName}
                  logoUrl={company.logoThumbnailUrl || company.logoUrl || undefined}
                  useDefaultLogo={company.useDefaultLogo}
                  size="md"
                  shape="circle"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-zinc-950">
                      <span className="truncate">{companyName}</span>
                      {company.isTrade82Team ? <AdminBadge compact /> : null}
                    </p>
                    <time className="shrink-0 text-[11px] text-zinc-400">
                      {formatThreadListTime(thread.updatedAt, locale)}
                    </time>
                  </div>
                  <p className="mt-0.5 truncate text-xs font-medium text-zinc-500">
                    {thread.product?.name || getInquiryLabel(thread, t)}
                  </p>
                  <p className="mt-1 line-clamp-1 text-sm text-zinc-500">
                    {latestPreview}
                  </p>
                </div>
                <UnreadMessageBadge count={unreadCount} className="right-4 top-9" />
              </button>
            );
          })
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <p className="text-sm text-zinc-500">{t("messages.noConversationsForFilter")}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function MobileChatDetail({
  thread,
  reply,
  draftAttachments,
  composerError,
  hasPendingUploads,
  hasComposerContent,
  libraryAttachments,
  libraryFilter,
  librarySearch,
  attachmentSheetOpen,
  dealSheetOpen,
  messagesEndRef,
  fileInputRef,
  onBack,
  onReplyChange,
  onSubmitReply,
  onAddFiles,
  onRemoveDraftAttachment,
  onRetryDraftAttachment,
  onOpenAttachment,
  onJumpToMessage,
  onFilterFiles,
  onSearchFiles,
  onOpenAttachmentSheet,
  onCloseAttachmentSheet,
  onOpenDealSheet,
  onCloseDealSheet,
  dealPending,
  dealError,
  onCreateDeal,
  onUpdateDeal,
  onReviewCompletion,
  onPaymentUpdated,
  paymentFeatureEnabled,
}: {
  thread: InquiryThread;
  reply: string;
  draftAttachments: DraftAttachment[];
  composerError: string;
  hasPendingUploads: boolean;
  hasComposerContent: boolean;
  libraryAttachments: MessageAttachment[];
  libraryFilter: "all" | "image" | "pdf";
  librarySearch: string;
  attachmentSheetOpen: boolean;
  dealSheetOpen: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onBack: () => void;
  onReplyChange: (value: string) => void;
  onSubmitReply: () => void;
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveDraftAttachment: (id: string) => void;
  onRetryDraftAttachment: (id: string) => void;
  onOpenAttachment: (attachment: MessageAttachment) => void;
  onJumpToMessage: (messageId: string | null) => void;
  onFilterFiles: (value: "all" | "image" | "pdf") => void;
  onSearchFiles: (value: string) => void;
  onOpenAttachmentSheet: () => void;
  onCloseAttachmentSheet: () => void;
  onOpenDealSheet: () => void;
  onCloseDealSheet: () => void;
  dealPending: boolean;
  dealError: string;
  onCreateDeal: () => void;
  onUpdateDeal: (
    deal: DealSummary,
    action: "mark_in_progress" | "request_completion" | "confirm_completion",
  ) => void;
  onReviewCompletion: () => void;
  onPaymentUpdated: () => void;
  paymentFeatureEnabled: boolean;
}) {
  const { t } = useI18n();
  const company = getCounterparty(thread);
  const companyName = getCompanyDisplayName(company, t);
  const subtitle = thread.product?.name || getInquiryLabel(thread, t);
  return (
    <section className="fixed inset-0 z-40 flex h-[100dvh] flex-col overflow-hidden bg-white text-zinc-950 md:hidden">
      <header className="shrink-0 border-b border-zinc-100 bg-white px-3 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label={t("common.back", "Back")}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-zinc-700 active:bg-zinc-100"
          >
            <ChevronLeft className="size-5" />
          </button>
          <CompanyLogo
            companyName={companyName}
            logoUrl={company.logoThumbnailUrl || company.logoUrl || undefined}
            useDefaultLogo={company.useDefaultLogo}
            size="sm"
            shape="circle"
          />
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
              <span className="truncate">{companyName}</span>
              {company.isTrade82Team ? <AdminBadge compact /> : null}
            </p>
            <p className="truncate text-xs text-zinc-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onOpenDealSheet}
            aria-label={t("messages.mobileDealActions")}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-zinc-600 active:bg-zinc-100"
          >
            <MoreVertical className="size-5" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 px-3 py-3">
        <MessageTimeline
          thread={thread}
          paymentFeatureEnabled={paymentFeatureEnabled}
          onOpenAttachment={onOpenAttachment}
          onPaymentUpdated={onPaymentUpdated}
        />
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      <MessageTradeActionBar
        thread={thread}
        pending={dealPending}
        error={dealError}
        onReview={onReviewCompletion}
        mobile
      />

      <footer className="shrink-0 border-t border-zinc-100 bg-white px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">
        <AttachmentDraftList
          items={draftAttachments}
          onRemove={onRemoveDraftAttachment}
          onRetry={onRetryDraftAttachment}
        />
        {composerError ? (
          <p className="mb-2 text-xs font-medium text-red-700">{composerError}</p>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(event) => {
            if (event.target.files) onAddFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <div className="rounded-[1.4rem] border border-zinc-200 bg-zinc-50 px-2.5 py-2">
          <textarea
            value={reply}
            onChange={(event) => onReplyChange(event.target.value)}
            maxLength={MESSAGE_COMPOSER_MAX_LENGTH}
            rows={1}
            placeholder={t("messages.mobileReplyPlaceholder")}
            className="max-h-28 min-h-9 w-full resize-none border-0 bg-transparent px-1 py-2 text-sm leading-5 text-zinc-950 outline-none placeholder:text-zinc-400"
          />
          <div className="mt-2 flex items-center gap-1.5 border-t border-zinc-200 pt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label={t("messages.attachFiles")}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-zinc-600 shadow-sm active:bg-zinc-100"
            >
              <ImageIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={onOpenAttachmentSheet}
              aria-label={t("messages.mobileAttach")}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-zinc-600 shadow-sm active:bg-zinc-100"
            >
              <Paperclip className="size-4" />
            </button>
            <span className="ml-auto text-xs tabular-nums text-zinc-400">
              {reply.length}/{MESSAGE_COMPOSER_MAX_LENGTH}
            </span>
            <button
              type="button"
              onClick={onSubmitReply}
              disabled={hasPendingUploads || !hasComposerContent}
              aria-label={t("messages.saveReply")}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-white disabled:bg-zinc-200 disabled:text-zinc-400"
            >
              <Send className="size-4" />
            </button>
          </div>
        </div>
      </footer>

      {attachmentSheetOpen ? (
        <MobileAttachmentSheet
          attachments={libraryAttachments}
          filter={libraryFilter}
          search={librarySearch}
          fileInputRef={fileInputRef}
          onClose={onCloseAttachmentSheet}
          onFilter={onFilterFiles}
          onSearch={onSearchFiles}
          onOpen={onOpenAttachment}
          onJump={onJumpToMessage}
        />
      ) : null}

      {dealSheetOpen ? (
        <MobileTradeDetailsSheet
          thread={thread}
          onClose={onCloseDealSheet}
          onPaymentUpdated={onPaymentUpdated}
          paymentFeatureEnabled={paymentFeatureEnabled}
          pending={dealPending}
          error={dealError}
          onCreate={onCreateDeal}
          onUpdate={onUpdateDeal}
          onOpenFiles={() => {
            onCloseDealSheet();
            onOpenAttachmentSheet();
          }}
        />
      ) : null}
    </section>
  );
}

function MobileAttachmentSheet({
  attachments,
  filter,
  search,
  fileInputRef,
  onClose,
  onFilter,
  onSearch,
  onOpen,
  onJump,
}: {
  attachments: MessageAttachment[];
  filter: "all" | "image" | "pdf";
  search: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onFilter: (value: "all" | "image" | "pdf") => void;
  onSearch: (value: string) => void;
  onOpen: (attachment: MessageAttachment) => void;
  onJump: (messageId: string | null) => void;
}) {
  const { t } = useI18n();
  const fileListRef = useRef<HTMLDivElement>(null);
  const filters = [
    ["all", t("messages.allFiles")],
    ["image", t("messages.images")],
    ["pdf", t("messages.documents")],
  ] as const;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 max-h-[82dvh] overflow-hidden rounded-t-3xl border border-zinc-200 bg-white shadow-2xl md:hidden">
      <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-zinc-200" />
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-950">{t("messages.mobileFilesTitle")}</h3>
          <p className="text-xs text-zinc-500">{t("messages.mobileFilesSubtitle")}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-2 text-zinc-500 active:bg-zinc-100">
          <X className="size-5" />
        </button>
      </div>
      <div className="grid gap-3 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-950 px-3 text-sm font-semibold text-white"
          >
            <Upload className="size-4" />
            {t("messages.mobileUploadFile")}
          </button>
          <button
            type="button"
            onClick={() => fileListRef.current?.scrollIntoView({ block: "start" })}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700"
          >
            <FolderOpen className="size-4" />
            {t("messages.mobileViewFiles")}
          </button>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm">
          <Search className="size-4 text-zinc-400" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={t("messages.searchFiles")}
            className="min-w-0 flex-1 outline-none"
          />
        </label>
        <div className="flex gap-2 overflow-x-auto">
          {filters.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onFilter(value)}
              className={cx(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                filter === value
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-200 text-zinc-600",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div ref={fileListRef} className="grid max-h-72 gap-2 overflow-y-auto scroll-mt-3">
          {attachments.length ? (
            attachments.map((attachment) => (
              <article key={attachment.id} className="rounded-xl border border-zinc-200 p-2">
                <AttachmentCard attachment={attachment} onOpen={() => onOpen(attachment)} compact />
                <button
                  type="button"
                  onClick={() => {
                    onJump(attachment.messageId);
                    onClose();
                  }}
                  className="mt-2 text-xs font-medium text-blue-700"
                >
                  {t("messages.jumpToOriginal")}
                </button>
              </article>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
              {t("messages.noAttachments")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MobileTradeDetailsSheet({
  thread,
  onClose,
  onPaymentUpdated,
  paymentFeatureEnabled,
  pending,
  error,
  onCreate,
  onUpdate,
  onOpenFiles,
}: {
  thread: InquiryThread;
  onClose: () => void;
  onPaymentUpdated: () => void;
  paymentFeatureEnabled: boolean;
  pending: boolean;
  error: string;
  onCreate: () => void;
  onUpdate: (
    deal: DealSummary,
    action: "mark_in_progress" | "request_completion" | "confirm_completion",
  ) => void;
  onOpenFiles: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 overflow-hidden rounded-t-3xl border border-zinc-200 bg-white shadow-2xl md:hidden">
      <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-zinc-200" />
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-950">{t("messages.mobileTradeDetails")}</h3>
        <button type="button" onClick={onClose} className="rounded-full p-2 text-zinc-500 active:bg-zinc-100">
          <X className="size-5" />
        </button>
      </div>
      <div className="grid max-h-[72dvh] gap-4 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
        <TradeDetailsPanel
          thread={thread}
          pending={pending}
          error={error}
          onCreate={onCreate}
          onUpdate={onUpdate}
          paymentFeatureEnabled={paymentFeatureEnabled}
          onPaymentUpdated={onPaymentUpdated}
          compact
        />
        <button
          type="button"
          onClick={onOpenFiles}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700"
        >
          <FolderOpen className="size-4" />
          {t("messages.mobileViewFiles")}
        </button>
      </div>
    </div>
  );
}

function ChatRoomContextMenu({
  x,
  y,
  threadName,
  pinned,
  favorite,
  notificationsEnabled,
  onClose,
  onAction,
}: {
  x: number;
  y: number;
  threadName: string;
  pinned: boolean;
  favorite: boolean;
  notificationsEnabled: boolean;
  onClose: () => void;
  onAction: (action: ChatRoomContextMenuAction) => void;
}) {
  const { t } = useI18n();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`${t("messages.chatRoomActions", "Chat room actions")}: ${threadName}`}
      className="fixed z-50 w-[236px] overflow-hidden rounded-xl border border-white/10 bg-zinc-950/95 py-1.5 text-sm text-zinc-100 shadow-2xl shadow-black/40 backdrop-blur"
      style={{ left: x, top: y }}
    >
      <ChatRoomContextMenuItem
        label={t("messages.menuOpenChatRoom", "Open Chat Room")}
        shortcut="Enter"
        onSelect={() => onAction("open")}
      />
      <ChatRoomContextMenuItem
        label={t("messages.menuRenameChatRoom", "Rename Chat Room")}
        shortcut="R"
        disabled
        onSelect={() => onAction("rename")}
      />
      <ChatRoomContextMenuDivider />
      <ChatRoomContextMenuItem
        label={t("messages.menuPinChatRoom", "Pin Chat Room")}
        shortcut="P"
        checked={pinned}
        onSelect={() => onAction("pin")}
      />
      <ChatRoomContextMenuItem
        label={t("messages.menuAddToFavorites", "Add to Favorites")}
        shortcut="F"
        checked={favorite}
        onSelect={() => onAction("favorite")}
      />
      <ChatRoomContextMenuItem
        label={t("messages.menuNotifications", "Notifications")}
        shortcut="N"
        checked={notificationsEnabled}
        onSelect={() => onAction("notifications")}
      />
      <ChatRoomContextMenuDivider />
      <ChatRoomContextMenuItem
        label={t("messages.menuLeaveChatRoom", "Leave Chat Room")}
        shortcut="Del"
        disabled
        danger
        onSelect={() => onAction("leave")}
      />
    </div>
  );
}

function ChatRoomContextMenuDivider() {
  return <div className="my-1 h-px bg-zinc-800" role="separator" />;
}

function ChatRoomContextMenuItem({
  label,
  shortcut,
  checked = false,
  disabled = false,
  danger = false,
  onSelect,
}: {
  label: string;
  shortcut?: string;
  checked?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      aria-disabled={disabled}
      onClick={onSelect}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left transition ${
        disabled
          ? "cursor-not-allowed text-zinc-500"
          : danger
            ? "text-zinc-100 hover:bg-red-500/15 hover:text-red-200"
            : "text-zinc-100 hover:bg-white/10"
      }`}
    >
      <span className="flex size-4 shrink-0 items-center justify-center text-xs text-emerald-300">
        {checked ? "✓" : ""}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {shortcut ? (
        <span className="ml-3 shrink-0 text-[11px] text-zinc-500">{shortcut}</span>
      ) : null}
    </button>
  );
}

function ConversationHeader({ thread }: { thread: InquiryThread }) {
  const { locale, t } = useI18n();
  const product = thread.product;
  const company = getCounterparty(thread);
  const companyName = getCompanyDisplayName(company, t);
  const productHref = product?.id ? withLocale(`/products/${product.id}`, locale) : "";
  const imageUrl = safeExternalUrl(product?.imageUrl) || "/window.svg";

  return (
    <header className="shrink-0 border-b bg-white px-4 py-3 theme-border">
      <div className="flex min-w-0 items-center gap-3">
        <CompanyLogo
          companyName={companyName}
          logoUrl={company.logoThumbnailUrl || company.logoUrl || undefined}
          useDefaultLogo={company.useDefaultLogo}
          size="sm"
          shape="circle"
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="truncate text-sm font-semibold theme-foreground">{companyName}</h2>
            {company.verificationStatus === "verified" ? (
              <span className="shrink-0 text-[11px] font-medium text-[#23825e]">{t("messages.verifiedCompany")}</span>
            ) : null}
            {company.isTrade82Team ? <AdminBadge compact /> : null}
          </div>
          <p className="mt-0.5 truncate text-xs theme-muted">
            {product?.name || getInquiryLabel(thread, t)}
          </p>
        </div>
        {product ? (
          <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border theme-border theme-surface">
            <Image
              src={imageUrl}
              alt=""
              fill
              sizes="40px"
              unoptimized
              className="object-cover"
            />
          </div>
        ) : null}
        {productHref ? (
          <Link
            href={productHref}
            className="shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-medium transition theme-secondary-button"
          >
            {t("common.viewProduct")}
          </Link>
        ) : null}
      </div>
    </header>
  );
}

type TimelineMessage = {
  key: string;
  id?: string;
  body: string;
  createdAt: string;
  senderCompanyId: string | null;
  attachments: MessageAttachment[];
};

type TimelineEntry =
  | { kind: "message"; key: string; createdAt: string; item: TimelineMessage }
  | { kind: "payment"; key: string; createdAt: string; item: PaymentRequestSummary }
  | {
      kind: "payment-event";
      key: string;
      createdAt: string;
      item: PaymentRequestSummary["events"][number];
    }
  | { kind: "deal-event"; key: string; createdAt: string; state: "waiting_for_counterparty" | "completed" };

function MessageTimeline({
  thread,
  paymentFeatureEnabled,
  onOpenAttachment,
  onPaymentUpdated,
}: {
  thread: InquiryThread;
  paymentFeatureEnabled: boolean;
  onOpenAttachment: (attachment: MessageAttachment) => void;
  onPaymentUpdated: () => void;
}) {
  const { locale } = useI18n();
  const deal = getActiveDeal(thread);
  const dealState = getMessageTradeDealState(deal, {
    viewerCompanyId: getViewerCompanyId(thread),
    buyerCompanyId: thread.buyerCompany.id,
    sellerCompanyId: thread.sellerCompany.id,
  });
  const dealTimelineEvent =
    dealState === "waiting_for_counterparty" || dealState === "completed"
      ? {
          kind: "deal-event" as const,
          key: `deal-${thread.id}-${dealState}`,
          createdAt: thread.updatedAt,
          state: dealState,
        }
      : null;
  const messages: TimelineMessage[] = [
    ...(thread.message.trim()
      ? [
          {
            key: `initial-${thread.id}`,
            body: thread.message,
            createdAt: thread.createdAt,
            senderCompanyId: getInitialMessageSenderCompanyId(thread),
            attachments: [],
          },
        ]
      : []),
    ...thread.messages.map((message) => ({
      key: message.id,
      id: `message-${message.id}`,
      body: message.body,
      createdAt: message.createdAt,
      senderCompanyId: message.senderCompanyId,
      attachments: message.attachments,
    })),
  ];
  const timeline: TimelineEntry[] = [
    ...messages.map((message) => ({
      kind: "message" as const,
      key: message.key,
      createdAt: message.createdAt,
      item: message,
    })),
    ...(paymentFeatureEnabled ? (thread.paymentRequests ?? []) : []).flatMap((paymentRequest) => [
      {
        kind: "payment" as const,
        key: `payment-${paymentRequest.id}`,
        createdAt: paymentRequest.createdAt,
        item: paymentRequest,
      },
      ...paymentRequest.events.map((event) => ({
        kind: "payment-event" as const,
        key: `payment-event-${event.id}`,
        createdAt: event.createdAt,
        item: event,
      })),
    ]),
    ...(dealTimelineEvent ? [dealTimelineEvent] : []),
  ].sort((left, right) => {
    const dateDifference = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    if (dateDifference !== 0) return dateDifference;
    const order = { message: 0, payment: 1, "payment-event": 2, "deal-event": 3 } as const;
    return order[left.kind] - order[right.kind] || left.key.localeCompare(right.key);
  });
  return (
    <>
      {timeline.map((entry, index) => {
        const dateKey = getMessageDateKey(entry.createdAt);
        const previousEntry = timeline[index - 1];
        const showDateSeparator =
          !previousEntry || dateKey !== getMessageDateKey(previousEntry.createdAt);

        return (
          <Fragment key={entry.key}>
            {showDateSeparator ? (
              <DateSeparator label={formatMessageDate(entry.createdAt, locale)} />
            ) : null}
            {entry.kind === "message" ? (
              <ChatBubble
                id={entry.item.id}
                body={entry.item.body}
                createdAt={entry.item.createdAt}
                senderCompanyId={entry.item.senderCompanyId}
                thread={thread}
                attachments={entry.item.attachments}
                onOpenAttachment={onOpenAttachment}
              />
            ) : entry.kind === "payment" ? (
              <PaymentRequestCard
                paymentRequest={entry.item}
                thread={thread}
                onUpdated={onPaymentUpdated}
              />
            ) : (
              entry.kind === "payment-event" ? (
                <PaymentRequestTimelineEvent event={entry.item} locale={locale} />
              ) : (
                <DealTimelineEvent state={entry.state} />
              )
            )}
          </Fragment>
        );
      })}
    </>
  );
}

function DealTimelineEvent({ state }: { state: "waiting_for_counterparty" | "completed" }) {
  const { t } = useI18n();
  const label = state === "completed" ? t("deals.compactCompletedDeal") : t("deals.completionRequestSent");

  return <p className="mx-auto my-3 w-fit max-w-full px-3 text-center text-xs text-zinc-500">{label}</p>;
}

function PaymentRequestTimelineEvent({
  event,
  locale,
}: {
  event: PaymentRequestSummary["events"][number];
  locale: string;
}) {
  return (
    <div className="mx-auto my-2 flex max-w-xl items-center justify-center gap-2 px-3 text-center text-xs text-zinc-500">
      <span className="h-px flex-1 bg-zinc-100" />
      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1">
        {event.message ?? event.eventType.replaceAll("_", " ")} · {new Date(event.createdAt).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}
      </span>
      <span className="h-px flex-1 bg-zinc-100" />
    </div>
  );
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="h-px flex-1 bg-[var(--border)]" />
      <span className="rounded-full border px-2.5 py-1 text-[11px] font-medium theme-surface-muted theme-muted">
        {label}
      </span>
      <span className="h-px flex-1 bg-[var(--border)]" />
    </div>
  );
}

function ChatBubble({
  id,
  body,
  createdAt,
  senderCompanyId,
  thread,
  attachments,
  onOpenAttachment,
}: {
  id?: string;
  body: string;
  createdAt: string;
  senderCompanyId: string | null;
  thread: InquiryThread;
  attachments: MessageAttachment[];
  onOpenAttachment: (attachment: MessageAttachment) => void;
}) {
  const { locale, t } = useI18n();
  const { context: userContext } = useUserContext();
  const viewerCompanyId = getViewerCompanyId(thread);
  const isMine = Boolean(senderCompanyId && senderCompanyId === viewerCompanyId);
  const senderCompany = getSenderCompany(thread, senderCompanyId) ?? getCounterparty(thread);
  const senderName = getCompanyDisplayName(senderCompany, t);
  const senderProfileHref = !isMine
    ? getPublicProfileHref(senderCompany, locale, userContext?.isAdmin === true)
    : "";
  const incomingAvatar = (
    <CompanyLogo
      companyName={senderName}
      logoUrl={senderCompany.logoThumbnailUrl || senderCompany.logoUrl || senderCompany.logoOriginalUrl || undefined}
      logoUrls={[
        senderCompany.logoThumbnailUrl || "",
        senderCompany.logoUrl || "",
        senderCompany.logoOriginalUrl || "",
      ]}
      useDefaultLogo={senderCompany.useDefaultLogo}
      size="sm"
      shape="circle"
      className="size-8 text-[10px]"
    />
  );

  return (
    <div id={id} className={`flex w-full scroll-mt-24 ${isMine ? "justify-end" : "justify-start"}`}>
      <article className={`flex max-w-[94%] items-end gap-2 ${isMine ? "flex-row-reverse" : ""}`}>
        {!isMine && senderProfileHref ? (
          <Link
            href={senderProfileHref}
            aria-label={`${t("messages.openCompanyProfile")}: ${senderName}`}
            className="shrink-0 cursor-pointer rounded-full transition hover:scale-105 hover:ring-2 hover:ring-[#64AF8B]/35 focus:outline-none focus:ring-2 focus:ring-[#64AF8B]/50"
          >
            {incomingAvatar}
          </Link>
        ) : !isMine ? (
          incomingAvatar
        ) : null}
        <div className={`flex min-w-0 items-end gap-1.5 ${isMine ? "flex-row-reverse" : ""}`}>
          <div
            className={
              isMine
                ? "max-w-[72vw] rounded-2xl rounded-br-md px-3.5 py-2.5 shadow-sm theme-primary-button sm:max-w-[32rem]"
                : "max-w-[72vw] rounded-2xl rounded-bl-md border px-3.5 py-2.5 shadow-sm theme-surface sm:max-w-[32rem]"
            }
          >
            {body ? <p className="whitespace-pre-wrap break-words text-sm leading-6">{body}</p> : null}
            {attachments.length ? (
              <div className={`mt-2.5 grid gap-2 ${body ? "border-t border-white/20 pt-2.5" : ""}`}>
                {attachments.map((attachment) => (
                  <AttachmentCard
                    key={attachment.id}
                    attachment={attachment}
                    mine={isMine}
                    compact
                    onOpen={() => onOpenAttachment(attachment)}
                  />
                ))}
              </div>
            ) : null}
          </div>
          <time
            dateTime={createdAt}
            className="mb-1 shrink-0 whitespace-nowrap text-[10px] leading-none theme-muted"
          >
            {formatMessageTime(createdAt, locale)}
          </time>
        </div>
      </article>
    </div>
  );
}

function AttachmentDraftList({
  items,
  onRemove,
  onRetry,
}: {
  items: DraftAttachment[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const { t } = useI18n();
  if (!items.length) return null;

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {items.map((item) => {
        const isImage = item.file.type.startsWith("image/");
        return (
          <div key={item.localId} className="flex gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-left">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded bg-white text-zinc-500">
              {isImage && item.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <FileText className="size-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-zinc-900">{item.file.name}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">{formatBytes(item.file.size)}</p>
              {item.status === "uploading" ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${item.progress}%` }} />
                </div>
              ) : null}
              {item.status === "failed" ? (
                <button
                  type="button"
                  onClick={() => onRetry(item.localId)}
                  className="mt-1 text-[11px] font-medium text-red-700 underline"
                >
                  {item.error || t("messages.uploadFailed")}
                </button>
              ) : (
                <p className="mt-1 text-[11px] text-zinc-500">
                  {item.status === "uploading" ? t("messages.uploadingAttachment") : t("common.saved")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onRemove(item.localId)}
              aria-label={t("messages.removeAttachment")}
              className="size-7 rounded text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"
            >
              <X className="mx-auto size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function AttachmentCard({
  attachment,
  mine,
  compact = false,
  onOpen,
}: {
  attachment: MessageAttachment;
  mine?: boolean;
  compact?: boolean;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const isImage = attachment.fileType === "image";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full min-w-0 gap-3 rounded-lg border p-2 text-left transition hover:scale-[1.01] ${
        mine
          ? "border-white/20 bg-white/10 text-white"
          : "border-zinc-200 bg-zinc-50 text-zinc-900"
      }`}
    >
      <span className={`flex ${compact ? "size-12" : "size-14"} shrink-0 items-center justify-center overflow-hidden rounded-md ${mine ? "bg-white/15" : "bg-white"}`}>
        {isImage ? (
          <SecureAttachmentThumbnail attachment={attachment} />
        ) : (
          <FileText className="size-5" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">{attachment.originalFilename}</span>
        <span className={`mt-1 block text-[11px] ${mine ? "text-zinc-300" : "text-zinc-500"}`}>
          {isImage ? t("messages.preview") : t("messages.pdfDocument")} · {formatBytes(attachment.sizeBytes)}
        </span>
      </span>
      <Download className={`mt-1 size-4 shrink-0 ${mine ? "text-zinc-300" : "text-zinc-500"}`} />
    </button>
  );
}

function SecureAttachmentThumbnail({ attachment }: { attachment: MessageAttachment }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let active = true;
    void fetch(`/api/messages/attachments/${attachment.id}/signed-url`)
      .then((response) => (response.ok ? response.json() : null))
      .then((result: SignedUrlPayload | null) => {
        if (active && result?.signedUrl) setUrl(result.signedUrl);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [attachment.id]);

  if (!url) return <ImageIcon className="size-5" />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="h-full w-full object-cover" />
  );
}

function AttachmentLibrary({
  attachments,
  filter,
  search,
  onFilter,
  onSearch,
  onOpen,
  onJump,
}: {
  attachments: MessageAttachment[];
  filter: "all" | "image" | "pdf";
  search: string;
  onFilter: (value: "all" | "image" | "pdf") => void;
  onSearch: (value: string) => void;
  onOpen: (attachment: MessageAttachment) => void;
  onJump: (messageId: string | null) => void;
}) {
  const { t } = useI18n();
  const filters = [
    ["all", t("messages.allFiles")],
    ["image", t("messages.images")],
    ["pdf", t("messages.documents")],
  ] as const;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-950">{t("messages.files")}</h3>
        <span className="text-xs text-zinc-500">{attachments.length}</span>
      </div>
      <label className="mt-3 flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm">
        <Search className="size-4 text-zinc-400" />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={t("messages.searchFiles")}
          className="min-w-0 flex-1 outline-none"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {filters.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onFilter(value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              filter === value
                ? "border-zinc-950 bg-zinc-950 text-white"
                : "border-zinc-200 text-zinc-600 hover:border-blue-200 hover:text-blue-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-4 grid min-h-0 flex-1 gap-3 overflow-y-auto pr-1">
        {attachments.length ? (
          attachments.map((attachment) => (
            <article key={attachment.id} className="rounded-lg border border-zinc-200 p-3">
              <AttachmentCard attachment={attachment} onOpen={() => onOpen(attachment)} />
              <p className="mt-2 truncate text-xs text-zinc-500">
                {attachment.uploadedByCompany
                  ? getCompanyDisplayName(attachment.uploadedByCompany, t)
                  : ""}
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">{formatDate(attachment.createdAt)}</p>
              <button
                type="button"
                onClick={() => onJump(attachment.messageId)}
                className="mt-2 text-xs font-medium text-blue-700 hover:text-blue-800"
              >
                {t("messages.jumpToOriginal")}
              </button>
            </article>
          ))
        ) : (
          <p className="rounded-md border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
            {t("messages.noAttachments")}
          </p>
        )}
      </div>
    </section>
  );
}

function ImagePreviewModal({
  attachment,
  url,
  loading,
  onClose,
}: {
  attachment: MessageAttachment;
  url: string;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-4xl rounded-lg bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="truncate text-sm font-semibold text-zinc-950">{attachment.originalFilename}</p>
          <button type="button" onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-100">
            <X className="size-5" />
          </button>
        </div>
        {loading ? (
          <div className="flex min-h-80 items-center justify-center text-sm text-zinc-500">Loading...</div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={attachment.originalFilename} className="max-h-[78vh] w-full rounded object-contain" />
        )}
      </div>
    </div>
  );
}

function validateClientAttachment(file: File) {
  const parts = file.name
    .toLowerCase()
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
  const extension = parts.at(-1) ?? "";
  const hasAllowedExtension = MESSAGE_ATTACHMENT_ALLOWED_EXTENSIONS.has(extension);
  if (!hasAllowedExtension) return "Only PDF, JPG, PNG, and WEBP files can be attached.";
  if (file.size <= 0) return "Empty files cannot be attached.";
  if (file.type === "application/pdf") {
    return file.size > MESSAGE_ATTACHMENT_LIMITS.maxPdfBytes
      ? "PDF files must be 100MB or smaller."
      : "";
  }
  if (file.type.startsWith("image/")) {
    return file.size > MESSAGE_ATTACHMENT_LIMITS.maxImageBytes
      ? "Image files must be 25MB or smaller."
      : "";
  }
  return "Only PDF, JPG, PNG, and WEBP files can be attached.";
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as { error?: string };
  } catch {
    return null;
  }
}

function PaymentRequestControls({
  thread,
  paymentFeatureEnabled,
  onUpdated,
}: {
  thread: InquiryThread;
  paymentFeatureEnabled: boolean;
  onUpdated: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const viewerCompanyId = getViewerCompanyId(thread);
  const isSeller = viewerCompanyId === thread.sellerCompany.id;

  if (!paymentFeatureEnabled || !isSeller) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-800 transition hover:border-zinc-950 hover:text-zinc-950"
      >
        <CreditCard className="size-4" />
        {t("payments.requestPayment")}
      </button>
      {open ? (
        <PaymentRequestDialog
          thread={thread}
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            onUpdated();
          }}
        />
      ) : null}
    </div>
  );
}

function PaymentRequestDialog({
  thread,
  onClose,
  onCreated,
}: {
  thread: InquiryThread;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const [productName, setProductName] = useState(thread.product?.name ?? "");
  const [quantity, setQuantity] = useState(thread.quantity ?? "");
  const [unit, setUnit] = useState("units");
  const [productAmount, setProductAmount] = useState("");
  const [shippingAmount, setShippingAmount] = useState("0.00");
  const [paymentDueDate, setPaymentDueDate] = useState(() => defaultPaymentDueDate());
  const [orderTerms, setOrderTerms] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/inquiries/${thread.id}/payment-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName,
          quantity,
          unit,
          productAmount,
          shippingAmount,
          paymentDueDate,
          orderTerms,
        }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "Unable to create the payment request.");
        return;
      }
      onCreated();
    } catch {
      setError("Unable to create the payment request.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <form
        className="w-full max-w-2xl rounded-xl border bg-white p-5 text-zinc-950 shadow-2xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-request-title"
        onSubmit={(event) => void submit(event)}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="payment-request-title" className="text-lg font-semibold">{t("payments.requestPaymentTitle")}</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600">{t("payments.requestPaymentDescription")}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100" aria-label={t("payments.cancel")}>
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <PaymentFormField label={t("payments.productName")} value={productName} onChange={setProductName} required className="sm:col-span-2" />
          <PaymentFormField label={t("payments.quantity")} value={quantity} onChange={setQuantity} required />
          <PaymentFormField label={t("payments.unit")} value={unit} onChange={setUnit} required />
          <PaymentFormField label={t("payments.productAmount")} value={productAmount} onChange={setProductAmount} required inputMode="decimal" placeholder="0.00" />
          <PaymentFormField label={t("payments.shippingAmount")} value={shippingAmount} onChange={setShippingAmount} required inputMode="decimal" placeholder="0.00" />
          <label className="grid gap-1.5 text-sm font-medium text-zinc-800">
            {t("payments.currency")}
            <input value="USD" disabled className="h-10 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-500" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-zinc-800">
            {t("payments.paymentDueDate")}
            <input type="date" value={paymentDueDate} onChange={(event) => setPaymentDueDate(event.target.value)} required className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-950" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-zinc-800 sm:col-span-2">
            {t("payments.orderTerms")}
            <textarea value={orderTerms} onChange={(event) => setOrderTerms(event.target.value)} required rows={4} className="rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-950" />
          </label>
        </div>
        {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="h-10 rounded-md border border-zinc-200 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50">{t("payments.cancel")}</button>
          <button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60">
            <CreditCard className="size-4" />
            {t("payments.createRequest")}
          </button>
        </div>
      </form>
    </div>
  );
}

function PaymentFormField({
  label,
  value,
  onChange,
  required,
  className,
  inputMode,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  inputMode?: "decimal" | "numeric" | "text";
  placeholder?: string;
}) {
  return (
    <label className={`grid gap-1.5 text-sm font-medium text-zinc-800 ${className ?? ""}`}>
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        inputMode={inputMode}
        placeholder={placeholder}
        className="h-10 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-950"
      />
    </label>
  );
}

function PaymentRequestCard({
  paymentRequest,
  thread,
  onUpdated,
}: {
  paymentRequest: PaymentRequestSummary;
  thread: InquiryThread;
  onUpdated: () => void;
}) {
  const { locale, t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const checkoutActionLockedRef = useRef(false);
  const viewerCompanyId = getViewerCompanyId(thread);
  const isSeller = viewerCompanyId === thread.sellerCompany.id;
  const isBuyer = viewerCompanyId === thread.buyerCompany.id;
  const expired =
    currentTime > 0 &&
    paymentRequest.status === "PENDING" &&
    new Date(paymentRequest.paymentDueDate).getTime() <= currentTime;
  const dispute = paymentRequest.disputes[0] ?? null;

  useEffect(() => {
    const updateCurrentTime = () => setCurrentTime(Date.now());
    updateCurrentTime();
    const timer = window.setInterval(updateCurrentTime, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function pay() {
    if (busy || processing || checkoutActionLockedRef.current) return;

    checkoutActionLockedRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    let keepCheckoutLocked = false;
    try {
      const returnPath =
        window.location.pathname === "/ko/messages" || window.location.pathname === "/en/messages"
          ? window.location.pathname
          : "/messages";
      const response = await fetch(`/api/payment-requests/${paymentRequest.id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnPath }),
      });
      const result = (await response.json().catch(() => null)) as PaymentCheckoutResponsePayload;
      const decision = decidePaymentCheckoutResponse({
        statusCode: response.status,
        payload: result,
        processingFallback: t(
          "payments.paymentProcessing",
          "Payment confirmation is being processed. Please wait a moment and refresh the conversation.",
        ),
        errorFallback: t("payments.checkoutStartFailed", "Unable to start Checkout."),
      });

      if (decision.action === "redirect") {
        window.location.assign(decision.url);
        return;
      }

      if (decision.action === "processing") {
        keepCheckoutLocked = true;
        setProcessing(true);
        setNotice(decision.message);
        onUpdated();
        window.setTimeout(onUpdated, 1_500);
        return;
      }

      setError(decision.message);
    } catch {
      setError(t("payments.checkoutStartFailed", "Unable to start Checkout."));
    } finally {
      setBusy(false);
      if (!keepCheckoutLocked) checkoutActionLockedRef.current = false;
    }
  }

  async function cancel() {
    if (!window.confirm(t("payments.cancelPaymentRequest"))) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/payment-requests/${paymentRequest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "Unable to cancel this payment request.");
        return;
      }
      onUpdated();
    } catch {
      setError("Unable to cancel this payment request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="mx-auto my-4 w-full max-w-2xl rounded-xl border border-zinc-200 bg-white p-4 text-zinc-950 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <CreditCard className="size-3.5" />
            {t("payments.paymentRequest")}
          </p>
          <h3 className="mt-1 text-base font-semibold">{paymentRequest.productName}</h3>
          <p className="mt-1 text-sm text-zinc-600">{paymentRequest.quantity} {paymentRequest.unit}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${paymentRequestStatusTone(paymentRequest.status)}`}>
          {expired ? t("payments.paymentExpired") : paymentRequestStatusLabel(paymentRequest.status, t)}
        </span>
      </div>

      <dl className="mt-4 grid gap-x-4 gap-y-2 border-y border-zinc-100 py-3 text-sm sm:grid-cols-2">
        <PaymentCardMetric label={t("payments.productAmount")} value={formatPaymentMoney(paymentRequest.productAmount, paymentRequest.currency)} />
        <PaymentCardMetric label={t("payments.shippingAmount")} value={formatPaymentMoney(paymentRequest.shippingAmount, paymentRequest.currency)} />
        <PaymentCardMetric label={t("payments.grossAmount")} value={formatPaymentMoney(paymentRequest.grossAmount, paymentRequest.currency)} strong />
        <PaymentCardMetric label={t("payments.paymentDue")} value={new Date(paymentRequest.paymentDueDate).toLocaleDateString(locale)} />
        {isSeller ? <PaymentCardMetric label={t("payments.platformFee")} value={formatPaymentMoney(paymentRequest.platformFeeAmount, paymentRequest.currency)} /> : null}
        {isSeller ? <PaymentCardMetric label={t("payments.sellerPayable")} value={formatPaymentMoney(paymentRequest.sellerPayableAmount, paymentRequest.currency)} strong /> : null}
        {paymentRequest.refundAmount > 0 ? <PaymentCardMetric label={t("payments.refundAmount")} value={formatPaymentMoney(paymentRequest.refundAmount, paymentRequest.currency)} /> : null}
        {dispute ? <PaymentCardMetric label={t("payments.disputeStatus")} value={dispute.status} /> : null}
      </dl>

      <div className="mt-3">
        <p className="text-xs font-medium text-zinc-500">{t("payments.orderTermsLabel")}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{paymentRequest.orderTerms}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">{new Date(paymentRequest.createdAt).toLocaleString(locale)}</p>
        {isBuyer && paymentRequest.status === "PENDING" && !expired ? (
          <button type="button" onClick={() => void pay()} disabled={busy || processing} className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-3 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60">
            <CreditCard className="size-4" />
            {t("payments.payNow")}
          </button>
        ) : null}
        {isSeller && paymentRequest.status === "PENDING" ? (
          <button type="button" onClick={() => void cancel()} disabled={busy} className="inline-flex h-9 items-center rounded-md border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">
            {t("payments.cancelPaymentRequest")}
          </button>
        ) : null}
      </div>
      {notice ? <p className="mt-3 text-sm font-medium text-blue-700">{notice}</p> : null}
      {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
    </article>
  );
}

function PaymentCardMetric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 sm:block">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className={`mt-0.5 ${strong ? "font-semibold text-zinc-950" : "font-medium text-zinc-700"}`}>{value}</dd>
    </div>
  );
}

function defaultPaymentDueDate() {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  return dueDate.toISOString().slice(0, 10);
}

function formatPaymentMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function paymentRequestStatusLabel(
  status: PaymentRequestSummary["status"],
  t: (key: string, fallback?: string) => string,
) {
  const keyByStatus: Record<PaymentRequestSummary["status"], string> = {
    PENDING: "payments.paymentPending",
    PAID: "payments.paymentPaid",
    RELEASED: "payments.paymentReleased",
    CANCELLED: "payments.paymentCancelled",
    PARTIALLY_REFUNDED: "payments.paymentPartiallyRefunded",
    REFUNDED: "payments.paymentRefunded",
    DISPUTED: "payments.paymentDisputed",
  };
  return t(keyByStatus[status], status);
}

function paymentRequestStatusTone(status: PaymentRequestSummary["status"]) {
  if (status === "PAID" || status === "RELEASED") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "DISPUTED" || status.includes("REFUND")) return "border-amber-200 bg-amber-50 text-amber-900";
  if (status === "CANCELLED") return "border-zinc-200 bg-zinc-100 text-zinc-600";
  return "border-blue-200 bg-blue-50 text-blue-800";
}

function MessageTradeActionBar({
  thread,
  pending,
  error,
  onReview,
  mobile = false,
}: {
  thread: InquiryThread;
  pending: boolean;
  error: string;
  onReview: () => void;
  mobile?: boolean;
}) {
  const { t } = useI18n();
  const deal = getActiveDeal(thread);
  const state = getMessageTradeDealState(deal, {
    viewerCompanyId: getViewerCompanyId(thread),
    buyerCompanyId: thread.buyerCompany.id,
    sellerCompanyId: thread.sellerCompany.id,
  });

  if (state !== "review_completion" && state !== "completed") return null;

  const isCompleted = state === "completed";

  return (
    <div className={cx("shrink-0 border-y border-emerald-100 bg-emerald-50/70 px-3 py-1.5", mobile ? "" : "mx-0")}>
      <div className="mx-auto max-w-4xl">
        <div className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-600">
          <span>{t("messages.productInquiry")}</span>
          <span aria-hidden="true">·</span>
          <span className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 font-medium text-emerald-800">
            {isCompleted ? t("deals.compactCompletedDeal") : t("deals.completionRequested")}
          </span>
          {!isCompleted ? (
            <button
              type="button"
              onClick={onReview}
              disabled={pending}
              aria-busy={pending || undefined}
              className="ml-auto inline-flex h-8 shrink-0 items-center rounded-md border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60"
            >
              {t("deals.reviewCompletion")}
            </button>
          ) : null}
        </div>
        {!isCompleted ? <p className="mt-0.5 text-xs text-zinc-500">{t("deals.otherRequestedCompletion")}</p> : null}
      </div>
      {error ? <p role="alert" className="mx-auto max-w-4xl text-xs font-medium text-red-700">{error}</p> : null}
    </div>
  );
}

function TradeDetailsPanel({
  thread,
  pending,
  error,
  onCreate,
  onUpdate,
  paymentFeatureEnabled,
  onPaymentUpdated,
  compact = false,
}: {
  thread: InquiryThread;
  pending: boolean;
  error: string;
  onCreate: () => void;
  onUpdate: (
    deal: DealSummary,
    action: "mark_in_progress" | "request_completion" | "confirm_completion",
  ) => void;
  paymentFeatureEnabled: boolean;
  onPaymentUpdated: () => void;
  compact?: boolean;
}) {
  const { locale, t } = useI18n();
  const deal = getActiveDeal(thread);
  const viewerCompanyId = getViewerCompanyId(thread);
  const hasReviewed = Boolean(deal?.reviews.some((review) => review.reviewerCompanyId === viewerCompanyId));
  const latestPayment = thread.paymentRequests?.at(-1) ?? null;
  const productHref = thread.product?.id ? withLocale(`/products/${thread.product.id}`, locale) : "";
  const statusLabel = deal
    ? deal.dealStatus === "completed"
      ? t("deals.compactCompletedDeal")
      : dealStatusLabel(deal.dealStatus, t)
    : t("messages.tradeNotStarted");

  return (
    <section className={cx("shrink-0 border-b border-zinc-200 p-4", compact ? "rounded-xl border bg-zinc-50 p-3" : "")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-950">{t("messages.tradeDetails")}</h3>
          <p className="mt-1 truncate text-xs text-zinc-500">{thread.product?.name || getInquiryLabel(thread, t)}</p>
        </div>
        {productHref ? (
          <Link href={productHref} className="shrink-0 text-xs font-semibold text-[#23825e] hover:underline">
            {t("common.viewProduct")}
          </Link>
        ) : null}
      </div>
      <dl className="mt-3 grid gap-2 text-xs">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-zinc-500">{t("messages.dealStatus")}</dt>
          <dd className="font-medium text-zinc-800">{statusLabel}</dd>
        </div>
        {thread.quantity ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-zinc-500">{t("messages.orderQuantity")}</dt>
            <dd className="font-medium text-zinc-800">{thread.quantity}</dd>
          </div>
        ) : null}
        {latestPayment ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-zinc-500">{t("payments.paymentRequest")}</dt>
            <dd className="font-medium text-zinc-800">{paymentRequestStatusLabel(latestPayment.status, t)}</dd>
          </div>
        ) : null}
      </dl>
      <TradeDetailsActions
        deal={deal}
        viewerCompanyId={viewerCompanyId}
        pending={pending}
        hasReviewed={hasReviewed}
        onCreate={onCreate}
        onUpdate={onUpdate}
      />
      {paymentFeatureEnabled ? (
        <PaymentRequestControls
          thread={thread}
          paymentFeatureEnabled={paymentFeatureEnabled}
          onUpdated={onPaymentUpdated}
        />
      ) : null}
      {error ? <p role="alert" className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}
    </section>
  );
}

function TradeDetailsActions({
  deal,
  viewerCompanyId,
  pending,
  hasReviewed,
  onCreate,
  onUpdate,
}: {
  deal: DealSummary | null;
  viewerCompanyId: string | null;
  pending: boolean;
  hasReviewed: boolean;
  onCreate: () => void;
  onUpdate: (
    deal: DealSummary,
    action: "mark_in_progress" | "request_completion" | "confirm_completion",
  ) => void;
}) {
  const { locale, t } = useI18n();
  if (!deal) {
    return <TradeDetailsAction disabled={pending} onClick={onCreate}>{t("deals.markInProgress")}</TradeDetailsAction>;
  }

  if (deal.dealStatus === "proposed" || deal.dealStatus === "in_progress") {
    return (
      <TradeDetailsAction disabled={pending} onClick={() => onUpdate(deal, "request_completion")}>
        {t("deals.requestCompletion")}
      </TradeDetailsAction>
    );
  }

  if (deal.dealStatus === "completed" && !hasReviewed && viewerCompanyId) {
    return (
      <Link
        href={withLocale(`/deals/${deal.id}/review`, locale)}
        className="mt-3 inline-flex h-8 items-center rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950"
      >
        {t("deals.writeReview")}
      </Link>
    );
  }

  return null;
}

function TradeDetailsAction({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={disabled || undefined}
      onClick={onClick}
      className="mt-3 inline-flex h-8 items-center rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950 disabled:cursor-wait disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function CompletionConfirmationDialog({
  thread,
  pending,
  onClose,
  onConfirm,
}: {
  thread: InquiryThread;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => Promise<boolean>;
}) {
  const { locale, t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const paymentRequest = thread.paymentRequests?.at(-1) ?? null;
  const productImageUrl = safeExternalUrl(thread.product?.imageUrl) || "/window.svg";
  const busy = pending || submitting;
  const busyRef = useRef(busy);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    confirmButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busyRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1) as HTMLElement;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  async function confirm() {
    if (busy) return;
    setSubmitting(true);
    const succeeded = await onConfirm();
    setSubmitting(false);
    if (succeeded) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="completion-confirmation-title"
        aria-describedby="completion-confirmation-description"
        className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-5 text-zinc-950 shadow-xl sm:p-6"
      >
        <h2 id="completion-confirmation-title" className="text-lg font-semibold">{t("deals.completionDialogTitle")}</h2>
        <p id="completion-confirmation-description" className="mt-1 text-sm leading-6 text-zinc-600">
          {t("deals.completionDialogPrompt")}
        </p>
        <div className="mt-4 flex gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <div className="relative size-12 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-white">
            <Image src={productImageUrl} alt="" fill sizes="48px" unoptimized className="object-cover" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-900">{paymentRequest?.productName || thread.product?.name || getInquiryLabel(thread, t)}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {paymentRequest ? `${paymentRequest.quantity} ${paymentRequest.unit}` : thread.quantity || t("common.notProvided")}
            </p>
          </div>
        </div>
        {paymentRequest ? (
          <dl className="mt-4 grid gap-2 rounded-lg border border-zinc-200 p-3 text-sm sm:grid-cols-2">
            <DialogMetric label={t("payments.productAmount")} value={formatPaymentMoney(paymentRequest.productAmount, paymentRequest.currency)} />
            <DialogMetric label={t("payments.shippingAmount")} value={formatPaymentMoney(paymentRequest.shippingAmount, paymentRequest.currency)} />
            <DialogMetric label={t("payments.grossAmount")} value={formatPaymentMoney(paymentRequest.grossAmount, paymentRequest.currency)} strong />
            <DialogMetric label={t("payments.paymentRequest")} value={paymentRequestStatusLabel(paymentRequest.status, t)} />
          </dl>
        ) : null}
        <p className="mt-4 text-xs text-zinc-500">{new Date(thread.updatedAt).toLocaleString(locale)}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="h-9 rounded-md border border-zinc-200 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60">
            {t("common.cancel")}
          </button>
          <button ref={confirmButtonRef} type="button" onClick={() => void confirm()} disabled={busy} aria-busy={busy || undefined} className="h-9 rounded-md bg-[#23825e] px-3 text-sm font-semibold text-white hover:bg-[#1e6e50] disabled:cursor-wait disabled:opacity-60">
            {t("deals.confirmCompletion")}
          </button>
        </div>
      </div>
    </div>
  );
}

function DialogMetric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 sm:block">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className={cx("mt-0.5 text-sm", strong ? "font-semibold text-zinc-950" : "font-medium text-zinc-700")}>{value}</dd>
    </div>
  );
}

function getActiveDeal(thread: InquiryThread) {
  return (thread.deals ?? []).find((deal) => deal.dealStatus !== "cancelled") ?? null;
}

function getMobileThreadStatus(thread: InquiryThread): MobileThreadFilter {
  const rawStatus = thread.status.toLowerCase();
  const deal = getActiveDeal(thread);

  if (rawStatus.includes("archived")) return "archived";
  if (deal?.dealStatus === "completed" || rawStatus.includes("closed") || rawStatus.includes("completed")) {
    return "completed";
  }
  if (deal && deal.dealStatus !== "cancelled") return "in_progress";
  return "waiting";
}

function getLatestThreadPreview(
  thread: InquiryThread,
  t: (key: string, fallback?: string) => string,
) {
  const latest = thread.messages.at(-1);
  if (latest?.body.trim()) return latest.body.trim();
  if (latest?.attachments.length) return t("messages.mobileAttachmentPreview", "Attachment shared");
  if (thread.message.trim()) return thread.message.trim();
  return thread.product?.name || getInquiryLabel(thread, t);
}

function getThreadParticipantKey(thread: InquiryThread) {
  return [thread.buyerCompany.id, thread.sellerCompany.id].sort().join(":");
}

function getCanonicalInquiryThreads(threads: InquiryThread[]) {
  const canonicalThreads = new Map<string, InquiryThread>();

  threads.forEach((thread) => {
    const key = getThreadParticipantKey(thread);
    const existing = canonicalThreads.get(key);
    if (
      !existing ||
      new Date(thread.updatedAt).getTime() > new Date(existing.updatedAt).getTime()
    ) {
      canonicalThreads.set(key, thread);
    }
  });

  return Array.from(canonicalThreads.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

function getViewerCompanyId(thread: InquiryThread) {
  const viewerCompanyIds = thread.viewerCompanyIds ?? [];
  return (
    viewerCompanyIds.find((id) => id === thread.buyerCompany.id || id === thread.sellerCompany.id) ??
    ""
  );
}

function getCounterparty(thread: InquiryThread) {
  const viewerCompanyId = getViewerCompanyId(thread);
  if (viewerCompanyId === thread.sellerCompany.id) {
    return thread.buyerCompany;
  }
  return thread.sellerCompany;
}

function getSenderCompany(thread: InquiryThread, senderCompanyId: string | null) {
  if (senderCompanyId === thread.buyerCompany.id) {
    return thread.buyerCompany;
  }
  if (senderCompanyId === thread.sellerCompany.id) {
    return thread.sellerCompany;
  }
  return null;
}

function getPublicProfileHref(
  company: ThreadCompany,
  locale: "en" | "ko",
  allowUnlisted = false,
) {
  if (!allowUnlisted && company.verificationStatus !== "verified") return "";
  const path =
    company.companyRole === "buyer"
      ? `/buyers/${company.id}`
      : `/companies/${company.id}`;
  return withLocale(path, locale);
}

function getInitialMessageSenderCompanyId(thread: InquiryThread) {
  if (thread.recipientCompanyId === thread.buyerCompany.id) {
    return thread.sellerCompany.id;
  }
  if (thread.recipientCompanyId === thread.sellerCompany.id) {
    return thread.buyerCompany.id;
  }
  return null;
}

function getCompanyDisplayName(
  company: { legalName: string; tradeName?: string | null },
  t?: (key: string, fallback?: string) => string,
) {
  const name = company.tradeName || company.legalName;
  if (name === "Trade82 team") {
    return t?.("adminBadge.label", "Trade82 team") ?? "Trade82 team";
  }
  return name === "Deleted company"
    ? t?.("messages.deletedUser", "Deleted user") ?? "Deleted user"
    : name;
}

function getInquiryLabel(
  thread: InquiryThread,
  t: (key: string, fallback?: string) => string,
) {
  const viewerCompanyId = getViewerCompanyId(thread);
  if (viewerCompanyId === thread.sellerCompany.id) {
    return t("messages.buyerInquiry");
  }
  return t("messages.sellerInquiry");
}

function localeCode(locale: "en" | "ko") {
  return locale === "ko" ? "ko-KR" : "en-US";
}

function safeDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getMessageDateKey(value: string) {
  const date = safeDate(value);
  if (!date) return value;
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatMessageDate(value: string, locale: "en" | "ko") {
  const date = safeDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat(localeCode(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatMessageTime(value: string, locale: "en" | "ko") {
  const date = safeDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(localeCode(locale), {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatThreadListTime(value: string, locale: "en" | "ko") {
  const date = safeDate(value);
  if (!date) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return formatMessageTime(value, locale);
  return new Intl.DateTimeFormat(localeCode(locale), {
    month: "short",
    day: "numeric",
  }).format(date);
}

function dealStatusLabel(
  status: DealSummary["dealStatus"],
  t: (key: string, fallback?: string) => string,
) {
  if (status === "completion_requested") return t("deals.completionRequested");
  if (status === "completed") return t("deals.completedDeal");
  return t("deals.dealInProgress");
}
