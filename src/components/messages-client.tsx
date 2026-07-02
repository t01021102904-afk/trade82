"use client";

import {
  Download,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
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
import { formatDate } from "@/lib/utils";

type DealSummary = {
  id: string;
  dealStatus: "proposed" | "in_progress" | "completion_requested" | "completed" | "cancelled" | "disputed";
  confirmedByBuyer: boolean;
  confirmedBySeller: boolean;
  reviews: Array<{ id: string; reviewerCompanyId: string }>;
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
  product: { name: string } | null;
  messages: Array<{
    id: string;
    body: string;
    createdAt: string;
    senderCompanyId: string | null;
    attachments: MessageAttachment[];
  }>;
  deals?: DealSummary[];
  viewerCompanyIds?: string[];
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

type SignedUrlPayload = {
  signedUrl: string;
  expiresInSeconds: number;
  filename: string;
  mimeType: string;
};

async function fetchInquiryThreads() {
  const response = await fetch("/api/inquiries");
  if (!response.ok) return [];
  return (await response.json()) as InquiryThread[];
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
  const [selectedId, setSelectedId] = useState<string | null>(
    initialInquiryId,
  );
  const [reply, setReply] = useState("");
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftAttachmentsRef = useRef<DraftAttachment[]>([]);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  async function load() {
    setThreads(await fetchInquiryThreads());
  }

  useEffect(() => {
    let active = true;
    void fetchInquiryThreads().then((items) => {
      if (active) setThreads(items);
    });
    return () => {
      active = false;
    };
  }, []);

  const selected = useMemo(
    () => threads.find((thread) => thread.id === selectedId) ?? threads[0],
    [selectedId, threads],
  );
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
  const contextMenuThread = useMemo(
    () => threads.find((thread) => thread.id === contextMenu?.threadId) ?? null,
    [contextMenu?.threadId, threads],
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
  }, [lastMessageId, selected?.id]);

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
    const response = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inquiryId: thread.id }),
    });
    const result = (await response.json().catch(() => null)) as
      | DealSummary
      | { error?: string }
      | null;
    setDealPending(false);
    if (!response.ok || !isDealSummary(result)) {
      setDealError(getDealError(result) ?? t("deals.actionFailed"));
      return;
    }
    updateThreadDeal(thread.id, result);
  }

  async function updateDeal(
    thread: InquiryThread,
    deal: DealSummary,
    action: "mark_in_progress" | "request_completion" | "confirm_completion",
  ) {
    setDealPending(true);
    setDealError("");
    const response = await fetch(`/api/deals/${deal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const result = (await response.json().catch(() => null)) as
      | DealSummary
      | { error?: string }
      | null;
    setDealPending(false);
    if (!response.ok || !isDealSummary(result)) {
      setDealError(getDealError(result) ?? t("deals.actionFailed"));
      return;
    }
    updateThreadDeal(thread.id, result);
  }

  if (!threads.length) {
    return <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-8 text-center theme-surface"><div><h2 className="text-lg font-semibold theme-foreground">{t("messages.emptyTitle")}</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 theme-muted">{t("messages.emptyText")}</p><Link href={withLocale("/marketplace", locale)} className="mt-5 inline-flex rounded-md px-4 py-2 text-sm font-medium theme-primary-button">{t("common.browseProducts")}</Link></div></div>;
  }

  return (
    <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,12rem)_minmax(0,1fr)_minmax(0,13rem)] overflow-hidden rounded-lg border theme-surface-elevated xl:grid-cols-[320px_minmax(0,1fr)_320px] xl:grid-rows-1">
      <aside className="max-h-48 min-h-0 overflow-y-auto border-b theme-border xl:max-h-none xl:border-b-0 xl:border-r">
        {threads.map((thread) => {
          const company = getCounterparty(thread);
          const companyName = getCompanyDisplayName(company, t);
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
              className={`flex w-full gap-3 border-b p-4 text-left theme-border ${selected?.id === thread.id ? "theme-surface-muted" : "hover:bg-[var(--muted)]"}`}
            >
              <CompanyLogo companyName={companyName} logoUrl={company.logoThumbnailUrl || company.logoUrl || undefined} useDefaultLogo={company.useDefaultLogo} size="sm" />
              <div className="min-w-0">
                <p className="flex min-w-0 items-center gap-1.5 font-medium theme-foreground">
                  <span className="truncate">{companyName}</span>
                  {company.isTrade82Team ? <AdminBadge compact /> : null}
                </p>
                <p className="truncate text-xs theme-muted">{thread.product?.name || t("messages.sellerInquiry")}</p>
                <p className="mt-2 text-xs theme-muted">{formatDate(thread.updatedAt)}</p>
              </div>
            </button>
          );
        })}
      </aside>
      {selected ? (
        <section className="flex min-h-0 flex-col">
          <header className="shrink-0 border-b theme-border p-4">
            <h2 className="text-lg font-semibold theme-foreground">{selected.product?.name || getInquiryLabel(selected, t)}</h2>
            <CounterpartyProfileLink company={getCounterparty(selected)} />
            {selected.product ? <p className="mt-2 text-xs font-medium uppercase tracking-wide text-blue-700">{t("messages.productInquiry")}</p> : null}
            <DealControls
              thread={selected}
              pending={dealPending}
              error={dealError}
              onCreate={() => void createDeal(selected)}
              onUpdate={(deal, action) => void updateDeal(selected, deal, action)}
            />
          </header>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[var(--muted)] p-5">
            {selected.message.trim() ? (
              <ChatBubble
                body={selected.message}
                createdAt={selected.createdAt}
                senderCompanyId={getInitialMessageSenderCompanyId(selected)}
                thread={selected}
                attachments={[]}
                onOpenAttachment={openAttachment}
              />
            ) : null}
            {selected.messages.map((message) => (
              <ChatBubble
                key={message.id}
                id={`message-${message.id}`}
                body={message.body}
                createdAt={message.createdAt}
                senderCompanyId={message.senderCompanyId}
                thread={selected}
                attachments={message.attachments}
                onOpenAttachment={openAttachment}
              />
            ))}
            <div ref={messagesEndRef} aria-hidden="true" />
          </div>
          <footer className="max-h-[45%] shrink-0 overflow-y-auto border-t theme-border p-4">
            <div
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                addFiles(event.dataTransfer.files);
              }}
              className="rounded-lg border border-dashed p-3 theme-surface"
            >
              <textarea
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                rows={3}
                placeholder={t("messages.replyPlaceholder")}
                className="w-full resize-none rounded-md border px-3 py-2 theme-input"
              />
              <AttachmentDraftList
                items={draftAttachments}
                onRemove={removeDraftAttachment}
                onRetry={retryDraftAttachment}
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
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
                  className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium theme-secondary-button"
                >
                  <Paperclip className="size-4" />
                  {t("messages.attachFiles")}
                </button>
                <span className="text-xs theme-muted">{t("messages.dropFiles")}</span>
                <button
                  type="button"
                  onClick={() => void submitReply()}
                  disabled={draftAttachments.some((item) => item.status === "uploading")}
                  className="ml-auto rounded-md px-4 py-2 text-sm font-medium theme-primary-button disabled:cursor-wait disabled:opacity-60"
                >
                  {t("messages.saveReply")}
                </button>
              </div>
              <p className="mt-2 text-xs leading-5 theme-muted">{t("messages.attachmentHelp")}</p>
              {composerError ? (
                <p className="mt-2 text-xs font-medium text-red-700">{composerError}</p>
              ) : null}
            </div>
          </footer>
        </section>
      ) : null}
      {selected ? (
        <AttachmentLibrary
          attachments={libraryAttachments}
          filter={libraryFilter}
          search={librarySearch}
          onFilter={setLibraryFilter}
          onSearch={setLibrarySearch}
          onOpen={openAttachment}
          onJump={jumpToMessage}
        />
      ) : null}
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

function CounterpartyProfileLink({ company }: { company: ThreadCompany }) {
  const { locale, t } = useI18n();
  const { context: userContext } = useUserContext();
  const displayName = getCompanyDisplayName(company, t);
  const profileHref = getPublicProfileHref(company, locale, userContext?.isAdmin === true);
  const logo = (
    <CompanyLogo
      companyName={displayName}
      logoUrl={company.logoThumbnailUrl || company.logoUrl || company.logoOriginalUrl || undefined}
      logoUrls={[
        company.logoThumbnailUrl || "",
        company.logoUrl || "",
        company.logoOriginalUrl || "",
      ]}
      useDefaultLogo={company.useDefaultLogo}
      size="sm"
      className="size-11"
    />
  );

  if (!profileHref) {
    return (
      <div className="mt-3 flex min-w-0 items-center gap-3 rounded-lg border p-3 text-sm theme-surface-muted theme-muted">
        {logo}
        <div className="min-w-0">
          <p className="flex min-w-0 flex-wrap items-center gap-1.5 font-medium theme-foreground">
            <span className="truncate">{displayName}</span>
            {company.isTrade82Team ? <AdminBadge /> : null}
          </p>
          <p className="text-xs theme-muted">{t("messages.profileNotListed")}</p>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={profileHref}
      aria-label={`${t("messages.openCompanyProfile")}: ${displayName}`}
      className="mt-3 flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition theme-surface-muted theme-card-hover"
    >
      {logo}
      <div className="min-w-0">
        <p className="flex min-w-0 flex-wrap items-center gap-1.5 font-medium theme-foreground">
          <span className="truncate hover:underline">{displayName}</span>
          {company.isTrade82Team ? <AdminBadge /> : null}
        </p>
        <p className="text-xs theme-muted">{t("messages.openCompanyProfile")}</p>
      </div>
    </Link>
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
  const { t } = useI18n();
  const viewerCompanyId = getViewerCompanyId(thread);
  const isMine = Boolean(senderCompanyId && senderCompanyId === viewerCompanyId);
  const senderLabel = isMine
    ? t("messages.you")
    : getSenderCompanyName(thread, senderCompanyId, t) ||
      getCompanyDisplayName(getCounterparty(thread), t);

  return (
    <div id={id} className={`flex w-full scroll-mt-24 ${isMine ? "justify-end" : "justify-start"}`}>
      <article className={`max-w-[85%] sm:max-w-[70%] ${isMine ? "text-right" : "text-left"}`}>
        <p className="mb-1 text-xs font-medium theme-muted">
          {senderLabel}
        </p>
        <div
          className={
            isMine
              ? "rounded-2xl rounded-br-md px-4 py-3 shadow-sm theme-primary-button"
              : "rounded-2xl rounded-bl-md border px-4 py-3 shadow-sm theme-surface"
          }
        >
          {body ? <p className="whitespace-pre-wrap break-words text-sm leading-6">{body}</p> : null}
          {attachments.length ? (
            <div className={`mt-3 grid gap-2 ${body ? "border-t border-white/20 pt-3" : ""}`}>
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
        <p className="mt-1 text-[11px] theme-muted">
          {formatDate(createdAt)}
        </p>
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
    <aside className="flex max-h-56 min-h-0 flex-col overflow-hidden border-t border-zinc-200 bg-white p-4 xl:max-h-none xl:border-l xl:border-t-0">
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
    </aside>
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

function DealControls({
  thread,
  pending,
  error,
  onCreate,
  onUpdate,
}: {
  thread: InquiryThread;
  pending: boolean;
  error: string;
  onCreate: () => void;
  onUpdate: (
    deal: DealSummary,
    action: "mark_in_progress" | "request_completion" | "confirm_completion",
  ) => void;
}) {
  const { locale, t } = useI18n();
  const deal = getActiveDeal(thread);
  const viewerCompanyId = getViewerCompanyId(thread);
  const isBuyer = viewerCompanyId === thread.buyerCompany.id;
  const currentSideConfirmed = deal
    ? isBuyer
      ? deal.confirmedByBuyer
      : deal.confirmedBySeller
    : false;
  const hasReviewed = Boolean(
    deal?.reviews.some((review) => review.reviewerCompanyId === viewerCompanyId),
  );
  const statusLabel = deal ? dealStatusLabel(deal.dealStatus, t) : null;

  return (
    <div className="mt-4 grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {statusLabel ? (
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">
            {statusLabel}
          </span>
        ) : null}
        {!deal ? (
          <ActionButton disabled={pending} onClick={onCreate}>
            {t("deals.markInProgress")}
          </ActionButton>
        ) : null}
        {deal && (deal.dealStatus === "proposed" || deal.dealStatus === "in_progress") ? (
          <ActionButton disabled={pending} onClick={() => onUpdate(deal, "request_completion")}>
            {t("deals.requestCompletion")}
          </ActionButton>
        ) : null}
        {deal && deal.dealStatus === "completion_requested" && !currentSideConfirmed ? (
          <ActionButton disabled={pending} onClick={() => onUpdate(deal, "confirm_completion")}>
            {t("deals.confirmCompletion")}
          </ActionButton>
        ) : null}
        {deal && deal.dealStatus === "completed" && !hasReviewed ? (
          <Link
            href={withLocale(`/deals/${deal.id}/review`, locale)}
            className="rounded-md bg-zinc-950 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
          >
            {t("deals.writeReview")}
          </Link>
        ) : null}
        {deal && deal.dealStatus === "completed" && hasReviewed ? (
          <span className="text-xs font-medium text-emerald-700">{t("deals.alreadyReviewed")}</span>
        ) : null}
      </div>
      {deal?.dealStatus === "completion_requested" && !currentSideConfirmed ? (
        <Banner>{t("deals.otherRequestedCompletion")}</Banner>
      ) : null}
      {deal?.dealStatus === "completed" && !hasReviewed ? (
        <Banner>{t("deals.completeReviewPrompt")}</Banner>
      ) : null}
      {error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
    </div>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:border-blue-200 hover:text-blue-700 disabled:cursor-wait disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
      {children}
    </p>
  );
}

function getActiveDeal(thread: InquiryThread) {
  return (thread.deals ?? []).find((deal) => deal.dealStatus !== "cancelled") ?? null;
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

function getSenderCompanyName(
  thread: InquiryThread,
  senderCompanyId: string | null,
  t?: (key: string, fallback?: string) => string,
) {
  if (senderCompanyId === thread.buyerCompany.id) {
    return getCompanyDisplayName(thread.buyerCompany, t);
  }
  if (senderCompanyId === thread.sellerCompany.id) {
    return getCompanyDisplayName(thread.sellerCompany, t);
  }
  return "";
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

function dealStatusLabel(
  status: DealSummary["dealStatus"],
  t: (key: string, fallback?: string) => string,
) {
  if (status === "completion_requested") return t("deals.completionRequested");
  if (status === "completed") return t("deals.completedDeal");
  return t("deals.dealInProgress");
}
