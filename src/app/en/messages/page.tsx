import { MessagesClient } from "@/components/messages-client";
import { SectionHeader } from "@/components/section-header";
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
    <div className="bg-zinc-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeader
          label={messages.messages.label}
          title={messages.messages.title}
          description={messages.messages.description}
        />
        <MessagesClient initialInquiryId={inquiryId ?? null} />
      </div>
    </div>
  );
}
