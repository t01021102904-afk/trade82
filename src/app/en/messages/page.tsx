import { MessagesClient } from "@/components/messages-client";
import { getDictionary } from "@/lib/i18n";
import { requireAppProfile } from "@/lib/require-auth";

export default async function EnMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ inquiryId?: string }>;
}) {
  await requireAppProfile("/en/messages");
  const { inquiryId } = await searchParams;
  const messages = getDictionary("en");

  return (
    <div className="theme-bg">
      <div className="flex h-[calc(100dvh-4rem)] min-h-[560px] w-full flex-col px-2 py-2 sm:px-3 lg:px-4">
        <h1 className="sr-only">{messages.messages.label}</h1>
        <MessagesClient initialInquiryId={inquiryId ?? null} />
      </div>
    </div>
  );
}
