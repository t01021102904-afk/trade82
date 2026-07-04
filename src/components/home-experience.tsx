import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileText,
  FolderOpen,
  MessageCircle,
  PackageSearch,
  Search,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { HomeAutoVideo, HomeFaqAccordion } from "@/components/home-landing-interactions";
import { HomeWorkflowVisual } from "@/components/home-workflow-visual";
import { withLocale, type Locale } from "@/lib/i18n";

type CapabilityItem = {
  title: string;
  description: string;
  icon: typeof FileText;
};

type ValueSection = {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  image: string;
  imageAlt: string;
  imageSide: "left" | "right";
};

type HomeCopy = {
  hero: {
    eyebrow: string;
    headline: string;
    subheadline: string;
    sellerCta: string;
    buyerCta: string;
    builtWith: string;
  };
  capabilities: {
    eyebrow: string;
    title: string;
    text: string;
    items: CapabilityItem[];
  };
  documents: {
    eyebrow: string;
    title: string;
    description: string;
    bullets: string[];
    fallbackTitle: string;
    fallbackText: string;
  };
  messaging: {
    eyebrow: string;
    title: string;
    description: string;
    bullets: string[];
    fallbackTitle: string;
    fallbackText: string;
  };
  buyers: ValueSection;
  sellers: ValueSection;
  faq: {
    eyebrow: string;
    title: string;
    text: string;
    items: Array<{ question: string; answer: string }>;
  };
  cta: {
    eyebrow: string;
    title: string;
    text: string;
    sellerTitle: string;
    sellerText: string;
    buyerTitle: string;
    buyerText: string;
    sellerCta: string;
    buyerCta: string;
    browseCta: string;
  };
};

const builtWithLogos = [
  "ChatGPT",
  "Codex",
  "Vercel",
  "Supabase",
  "Stripe",
  "Clerk",
  "Resend",
  "GitHub",
  "Claude",
];

const homeCopy: Record<Locale, HomeCopy> = {
  en: {
    hero: {
      eyebrow: "Trade82",
      headline: "Korean Sellers. U.S. Buyers. One B2B Workspace.",
      subheadline:
        "Trade82 helps Korean suppliers and American buyers connect, manage product sourcing, share trade documents, and move inquiries into real business.",
      sellerCta: "Join as seller",
      buyerCta: "Join as buyer",
      builtWith: "Built with",
    },
    capabilities: {
      eyebrow: "What you can actually do",
      title: "A practical workspace for sourcing, documents, and buyer-seller conversations.",
      text:
        "Trade82 is built around the real steps teams repeat during cross-border B2B work: find companies, evaluate products, ask questions, and keep the paperwork close to the conversation.",
      items: [
        {
          title: "Browse Korean products",
          description: "Discover product listings prepared for U.S. sourcing conversations.",
          icon: PackageSearch,
        },
        {
          title: "View seller profiles",
          description: "Review supplier company information before starting an inquiry.",
          icon: Building2,
        },
        {
          title: "Send inquiries",
          description: "Ask sellers about MOQ, pricing, samples, lead time, and export details.",
          icon: MessageCircle,
        },
        {
          title: "Share documents",
          description: "Keep trade files close to the buyer-seller conversation.",
          icon: FolderOpen,
        },
        {
          title: "Manage trade templates",
          description: "Preview and print Trade82-ready templates for common export workflows.",
          icon: FileText,
        },
        {
          title: "Track sourcing workflow",
          description: "Move from product discovery to organized inquiry and deal preparation.",
          icon: ShieldCheck,
        },
      ],
    },
    documents: {
      eyebrow: "Documents and templates",
      title: "Find the right trade document in seconds",
      description:
        "Search templates, preview forms, and access export paperwork without digging through folders. Trade82 organizes the documents buyers and sellers actually use in cross-border trade.",
      bullets: [
        "Search by document or category",
        "Preview before downloading",
        "Use Trade82-ready templates",
        "Keep paperwork organized in one place",
      ],
      fallbackTitle: "Document walkthrough",
      fallbackText: "Add /public/Trade82/document.mp4 to show the auto-playing template demo here.",
    },
    messaging: {
      eyebrow: "Buyer-seller workflow",
      title: "Move from inquiry to transaction",
      description:
        "Buyers can contact sellers directly, request MOQ, pricing, lead time, samples, and documents, while sellers can respond and keep the conversation organized in one workflow.",
      bullets: [
        "Send product inquiries instantly",
        "Request pricing, MOQ, and samples",
        "Share documents in the same conversation",
        "Keep the sourcing workflow organized",
      ],
      fallbackTitle: "Messaging walkthrough",
      fallbackText: "Add /public/Trade82/message.mp4 to show the auto-playing inquiry demo here.",
    },
    buyers: {
      eyebrow: "For U.S. buyers",
      title: "Why Trade82 works for buyers",
      description:
        "Trade82 helps U.S. buyers discover Korean suppliers faster and evaluate products with more confidence. Instead of sourcing through scattered emails and spreadsheets, buyers can compare products, review seller profiles, and manage conversations in one place.",
      bullets: [
        "Discover Korean products and suppliers faster",
        "Compare sellers before starting a conversation",
        "Request documents and pricing in one place",
        "Reduce back-and-forth across email and chat",
        "Keep sourcing activity more organized",
        "Build a repeatable import workflow",
      ],
      image: "/landing/beauty-products-chat.png",
      imageAlt: "Isometric buyer inquiry and beauty products illustration",
      imageSide: "right",
    },
    sellers: {
      eyebrow: "For Korean sellers",
      title: "Why sellers use Trade82",
      description:
        "Trade82 gives Korean sellers a cleaner way to present products, respond to buyer inquiries, and support export conversations with the right information and documents.",
      bullets: [
        "Get discovered by U.S. buyers",
        "Present your company and products professionally",
        "Share export documents more efficiently",
        "Manage buyer inquiries in one place",
        "Build trust with better product and company information",
        "Turn inbound interest into real business conversations",
      ],
      image: "/landing/export-documents.png",
      imageAlt: "Isometric export documents and contract templates illustration",
      imageSide: "left",
    },
    faq: {
      eyebrow: "FAQ",
      title: "Common questions about Trade82",
      text:
        "Clear answers for buyers and sellers before starting a sourcing conversation.",
      items: [
        {
          question: "What is Trade82?",
          answer:
            "Trade82 is a B2B platform that helps Korean sellers and U.S. buyers connect, share product information, manage trade documents, and start sourcing conversations more efficiently.",
        },
        {
          question: "Can buyers contact sellers directly?",
          answer:
            "Yes. Buyers can contact sellers through Trade82 to ask about pricing, MOQ, lead time, samples, and export details.",
        },
        {
          question: "Can sellers upload multiple products?",
          answer: "Yes. Sellers can manage and publish multiple products from their dashboard.",
        },
        {
          question: "What kind of documents can be shared?",
          answer:
            "Sellers can share documents such as proforma invoices, packing lists, commercial invoices, product specifications, and other trade-related files or templates.",
        },
        {
          question: "Does Trade82 handle payments or guarantee transactions?",
          answer:
            "Trade82 provides the sourcing and workflow platform. Buyers and sellers are responsible for their own commercial decisions unless a separate payment or escrow feature is explicitly used.",
        },
        {
          question: "Who is Trade82 for?",
          answer:
            "Trade82 is designed for Korean sellers who want to reach U.S. buyers and for U.S. buyers looking for Korean products and suppliers.",
        },
      ],
    },
    cta: {
      eyebrow: "Start with Trade82",
      title: "Start sourcing or selling with Trade82",
      text:
        "Whether you are a Korean seller looking for U.S. buyers or a buyer searching for Korean products, Trade82 gives you one place to start.",
      sellerTitle: "For sellers",
      sellerText: "List your company and products for U.S. buyer discovery.",
      buyerTitle: "For buyers",
      buyerText: "Discover Korean suppliers and start organized product inquiries.",
      sellerCta: "Join as seller",
      buyerCta: "Join as buyer",
      browseCta: "Browse marketplace",
    },
  },
  ko: {
    hero: {
      eyebrow: "Trade82",
      headline: "한국 셀러와 미국 바이어를 연결하는 B2B 워크스페이스.",
      subheadline:
        "Trade82는 한국 공급사와 미국 바이어가 만나고, 상품 소싱을 관리하고, 무역 서류를 공유하고, 문의를 실제 비즈니스 대화로 이어가도록 돕습니다.",
      sellerCta: "셀러로 시작하기",
      buyerCta: "바이어로 시작하기",
      builtWith: "Built with",
    },
    capabilities: {
      eyebrow: "실제로 할 수 있는 일",
      title: "소싱, 문서, 바이어-셀러 대화를 위한 실무형 워크스페이스.",
      text:
        "Trade82는 회사 탐색, 상품 검토, 문의, 서류 정리처럼 국경 간 B2B 업무에서 반복되는 실제 단계를 중심으로 설계되었습니다.",
      items: [
        {
          title: "한국 상품 둘러보기",
          description: "미국 소싱 대화에 맞게 정리된 상품 리스트를 확인합니다.",
          icon: PackageSearch,
        },
        {
          title: "셀러 프로필 확인",
          description: "문의 전에 공급사 회사 정보를 빠르게 검토합니다.",
          icon: Building2,
        },
        {
          title: "상품 문의 보내기",
          description: "MOQ, 가격, 샘플, 리드타임, 수출 조건을 셀러에게 문의합니다.",
          icon: MessageCircle,
        },
        {
          title: "문서 공유",
          description: "무역 파일을 바이어-셀러 대화 흐름 안에서 함께 관리합니다.",
          icon: FolderOpen,
        },
        {
          title: "무역 템플릿 관리",
          description: "수출 업무에 필요한 Trade82 템플릿을 미리보고 인쇄합니다.",
          icon: FileText,
        },
        {
          title: "소싱 흐름 추적",
          description: "상품 발견에서 문의, 거래 준비까지 한 흐름으로 정리합니다.",
          icon: ShieldCheck,
        },
      ],
    },
    documents: {
      eyebrow: "문서와 템플릿",
      title: "필요한 무역 문서를 빠르게 찾기",
      description:
        "폴더를 뒤지지 않고 템플릿을 검색하고, 양식을 미리보고, 수출 업무에 필요한 서류에 접근할 수 있습니다. Trade82는 바이어와 셀러가 실제로 쓰는 문서를 정리합니다.",
      bullets: [
        "문서명 또는 카테고리로 검색",
        "다운로드 전 미리보기",
        "Trade82 준비 템플릿 사용",
        "서류를 한곳에 정리",
      ],
      fallbackTitle: "문서 기능 데모",
      fallbackText: "/public/Trade82/document.mp4 파일을 추가하면 템플릿 데모 영상이 자동 재생됩니다.",
    },
    messaging: {
      eyebrow: "문의와 거래 흐름",
      title: "문의에서 거래 대화로 자연스럽게 이동",
      description:
        "바이어는 셀러에게 MOQ, 가격, 리드타임, 샘플, 서류를 직접 요청할 수 있고, 셀러는 같은 워크플로 안에서 답변과 자료를 정리할 수 있습니다.",
      bullets: [
        "상품 문의를 즉시 전송",
        "가격, MOQ, 샘플 요청",
        "같은 대화 안에서 문서 공유",
        "소싱 업무 흐름 정리",
      ],
      fallbackTitle: "메시지 기능 데모",
      fallbackText: "/public/Trade82/message.mp4 파일을 추가하면 문의 데모 영상이 자동 재생됩니다.",
    },
    buyers: {
      eyebrow: "미국 바이어를 위해",
      title: "바이어가 Trade82를 쓰는 이유",
      description:
        "Trade82는 미국 바이어가 한국 공급사를 더 빠르게 발견하고 더 자신 있게 상품을 검토할 수 있게 합니다. 흩어진 이메일과 스프레드시트 대신 상품 비교, 셀러 프로필 검토, 대화 관리를 한곳에서 진행합니다.",
      bullets: [
        "한국 상품과 공급사를 더 빠르게 발견",
        "대화 시작 전 셀러 비교",
        "문서와 가격 정보를 한곳에서 요청",
        "이메일과 채팅 왕복 감소",
        "소싱 활동을 더 체계적으로 관리",
        "반복 가능한 수입 업무 흐름 구축",
      ],
      image: "/landing/beauty-products-chat.png",
      imageAlt: "뷰티 상품과 바이어 문의 아이소메트릭 일러스트",
      imageSide: "right",
    },
    sellers: {
      eyebrow: "한국 셀러를 위해",
      title: "셀러가 Trade82를 쓰는 이유",
      description:
        "Trade82는 한국 셀러가 상품을 더 깔끔하게 보여주고, 바이어 문의에 답하고, 필요한 정보와 문서로 수출 대화를 지원할 수 있게 합니다.",
      bullets: [
        "미국 바이어에게 발견될 기회 확대",
        "회사와 상품을 전문적으로 제시",
        "수출 문서를 더 효율적으로 공유",
        "바이어 문의를 한곳에서 관리",
        "더 나은 상품/회사 정보로 신뢰 형성",
        "인바운드 관심을 실제 비즈니스 대화로 연결",
      ],
      image: "/landing/export-documents.png",
      imageAlt: "수출 서류와 계약 템플릿 아이소메트릭 일러스트",
      imageSide: "left",
    },
    faq: {
      eyebrow: "FAQ",
      title: "Trade82에 대해 자주 묻는 질문",
      text: "소싱 대화를 시작하기 전 바이어와 셀러가 확인할 수 있는 기본 질문입니다.",
      items: [
        {
          question: "Trade82는 무엇인가요?",
          answer:
            "Trade82는 한국 셀러와 미국 바이어가 연결되고, 상품 정보를 공유하고, 무역 서류를 관리하고, 소싱 대화를 더 효율적으로 시작하도록 돕는 B2B 플랫폼입니다.",
        },
        {
          question: "바이어가 셀러에게 직접 연락할 수 있나요?",
          answer:
            "네. 바이어는 Trade82를 통해 가격, MOQ, 리드타임, 샘플, 수출 세부 조건을 셀러에게 문의할 수 있습니다.",
        },
        {
          question: "셀러가 여러 상품을 올릴 수 있나요?",
          answer: "네. 셀러는 대시보드에서 여러 상품을 관리하고 공개할 수 있습니다.",
        },
        {
          question: "어떤 문서를 공유할 수 있나요?",
          answer:
            "Proforma Invoice, Packing List, Commercial Invoice, 상품 사양서 등 무역 관련 파일과 템플릿을 공유할 수 있습니다.",
        },
        {
          question: "Trade82가 결제나 거래를 보증하나요?",
          answer:
            "Trade82는 소싱과 워크플로 플랫폼을 제공합니다. 별도 결제 또는 에스크로 기능을 명시적으로 사용하는 경우가 아니라면 상업적 판단은 바이어와 셀러가 직접 책임집니다.",
        },
        {
          question: "Trade82는 누구를 위한 서비스인가요?",
          answer:
            "Trade82는 미국 바이어에게 도달하고 싶은 한국 셀러와 한국 상품 및 공급사를 찾는 미국 바이어를 위해 설계되었습니다.",
        },
      ],
    },
    cta: {
      eyebrow: "Trade82 시작하기",
      title: "Trade82에서 소싱하거나 판매를 시작하세요",
      text:
        "미국 바이어를 찾는 한국 셀러든, 한국 상품을 찾는 바이어든 Trade82는 시작할 수 있는 하나의 워크스페이스를 제공합니다.",
      sellerTitle: "셀러용",
      sellerText: "회사와 상품을 등록해 미국 바이어에게 발견될 수 있게 하세요.",
      buyerTitle: "바이어용",
      buyerText: "한국 공급사와 상품을 찾고 체계적인 문의를 시작하세요.",
      sellerCta: "셀러로 시작하기",
      buyerCta: "바이어로 시작하기",
      browseCta: "마켓플레이스 보기",
    },
  },
};

export function HomeExperience({ locale }: { locale: Locale }) {
  const copy = homeCopy[locale];

  return (
    <main className="overflow-hidden theme-bg">
      <section className="relative isolate border-b theme-border">
        <div className="bm-grid-surface pointer-events-none absolute inset-0 opacity-[0.14]" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" aria-hidden="true" />
        <div className="relative mx-auto grid min-h-[680px] max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
          <div className="bm-section-in max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] theme-success-badge">
              <span className="bm-pulse-dot size-2 rounded-full bg-emerald-300" />
              {copy.hero.eyebrow}
            </div>
            <h1 className="mt-6 max-w-3xl text-[2.2rem] font-semibold leading-[1.05] tracking-[-0.01em] theme-foreground sm:text-[3rem] lg:text-[3.35rem]">
              {copy.hero.headline}
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-6 theme-muted sm:text-[15px]">
              {copy.hero.subheadline}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={withLocale("/signup", locale)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 theme-primary-button"
              >
                {copy.hero.sellerCta}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href={withLocale("/signup", locale)}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 theme-secondary-button"
              >
                {copy.hero.buyerCta}
              </Link>
            </div>
          </div>
          <HomeWorkflowVisual locale={locale} />
        </div>
        <BuiltWithMarquee label={copy.hero.builtWith} />
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <SectionHeader
          eyebrow={copy.capabilities.eyebrow}
          title={copy.capabilities.title}
          text={copy.capabilities.text}
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {copy.capabilities.items.map((item, index) => (
            <CapabilityCard key={item.title} item={item} index={index} />
          ))}
        </div>
      </section>

      <VideoFeatureSection
        eyebrow={copy.documents.eyebrow}
        title={copy.documents.title}
        description={copy.documents.description}
        bullets={copy.documents.bullets}
        videoSrc="/Trade82/document.mp4"
        videoTitle={copy.documents.title}
        fallbackTitle={copy.documents.fallbackTitle}
        fallbackText={copy.documents.fallbackText}
        mediaSide="right"
      />

      <VideoFeatureSection
        eyebrow={copy.messaging.eyebrow}
        title={copy.messaging.title}
        description={copy.messaging.description}
        bullets={copy.messaging.bullets}
        videoSrc="/Trade82/message.mp4"
        videoTitle={copy.messaging.title}
        fallbackTitle={copy.messaging.fallbackTitle}
        fallbackText={copy.messaging.fallbackText}
        mediaSide="left"
      />

      <ValueSectionBlock section={copy.buyers} />
      <ValueSectionBlock section={copy.sellers} />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="relative overflow-hidden rounded-[1.75rem] border p-5 theme-surface-elevated sm:p-8 lg:p-10">
          <div className="bm-grid-surface pointer-events-none absolute inset-0 opacity-[0.1]" aria-hidden="true" />
          <div className="relative grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
            <div>
              <SectionEyebrow label={copy.faq.eyebrow} />
              <h2 className="mt-4 text-2xl font-semibold tracking-[-0.01em] theme-foreground sm:text-[1.9rem]">
                {copy.faq.title}
              </h2>
              <p className="mt-3 text-sm leading-6 theme-muted">{copy.faq.text}</p>
            </div>
            <HomeFaqAccordion items={copy.faq.items} />
          </div>
        </div>
      </section>

      <FinalCta copy={copy.cta} locale={locale} />
    </main>
  );
}

function BuiltWithMarquee({ label }: { label: string }) {
  const loop = [...builtWithLogos, ...builtWithLogos];

  return (
    <div className="relative border-t theme-border">
      <div className="mx-auto flex max-w-7xl items-center gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <p className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] theme-muted">
          {label}
        </p>
        <div className="home-marquee-mask min-w-0 flex-1 overflow-hidden">
          <div className="home-marquee-track flex w-max items-center gap-3">
            {loop.map((name, index) => (
              <span
                key={`${name}-${index}`}
                className="inline-flex h-9 items-center rounded-full border px-4 font-mono text-[11px] font-semibold tracking-[0.04em] theme-surface-muted"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionEyebrow({ label }: { label: string }) {
  return (
    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] theme-success-text">
      {label}
    </p>
  );
}

function SectionHeader({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="max-w-3xl">
      <SectionEyebrow label={eyebrow} />
      <h2 className="mt-4 text-2xl font-semibold tracking-[-0.01em] theme-foreground sm:text-[1.95rem]">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 theme-muted">{text}</p>
    </div>
  );
}

function CapabilityCard({ item, index }: { item: CapabilityItem; index: number }) {
  const Icon = item.icon;

  return (
    <article
      className="bm-premium-card bm-section-in min-h-[190px] rounded-[1.35rem] border p-5 theme-surface"
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <div className="relative">
        <span className="inline-flex size-10 items-center justify-center rounded-xl border theme-border theme-surface-muted">
          <Icon className="size-[18px] text-[var(--accent-foreground)]" aria-hidden="true" />
        </span>
        <h3 className="mt-5 text-base font-semibold theme-foreground">{item.title}</h3>
        <p className="mt-3 text-[13px] leading-6 theme-muted">{item.description}</p>
      </div>
    </article>
  );
}

function VideoFeatureSection({
  eyebrow,
  title,
  description,
  bullets,
  videoSrc,
  videoTitle,
  fallbackTitle,
  fallbackText,
  mediaSide,
}: {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  videoSrc: string;
  videoTitle: string;
  fallbackTitle: string;
  fallbackText: string;
  mediaSide: "left" | "right";
}) {
  const text = (
    <FeatureText eyebrow={eyebrow} title={title} description={description} bullets={bullets} />
  );
  const media = (
    <HomeAutoVideo
      src={videoSrc}
      title={videoTitle}
      eyebrow={eyebrow}
      fallbackTitle={fallbackTitle}
      fallbackText={fallbackText}
    />
  );

  return (
    <section className="border-y theme-border">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center lg:px-8">
        {mediaSide === "left" ? media : text}
        {mediaSide === "left" ? text : media}
      </div>
    </section>
  );
}

function FeatureText({
  eyebrow,
  title,
  description,
  bullets,
}: {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
}) {
  return (
    <div className="max-w-xl">
      <SectionEyebrow label={eyebrow} />
      <h2 className="mt-4 text-2xl font-semibold tracking-[-0.01em] theme-foreground sm:text-[1.9rem]">
        {title}
      </h2>
      <p className="mt-4 text-sm leading-6 theme-muted">{description}</p>
      <ul className="mt-6 grid gap-3">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-3 text-sm leading-6 theme-muted">
            <CheckCircle2
              className="mt-1 size-4 shrink-0 text-[var(--accent-foreground)]"
              aria-hidden="true"
            />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ValueSectionBlock({ section }: { section: ValueSection }) {
  const text = (
    <FeatureText
      eyebrow={section.eyebrow}
      title={section.title}
      description={section.description}
      bullets={section.bullets}
    />
  );
  const image = (
    <div className="home-magnetic-panel rounded-[1.6rem] border p-4 theme-surface">
      <div className="relative overflow-hidden rounded-[1.25rem] border p-6 theme-surface-elevated sm:p-8">
        <div className="bm-grid-surface pointer-events-none absolute inset-0 opacity-[0.12]" aria-hidden="true" />
        <Image
          src={section.image}
          alt={section.imageAlt}
          width={1448}
          height={1086}
          sizes="(min-width: 1024px) 520px, 92vw"
          className="relative h-auto w-full object-contain transition duration-200 hover:-translate-y-1"
        />
      </div>
    </div>
  );

  return (
    <section className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center lg:px-8">
      {section.imageSide === "left" ? image : text}
      {section.imageSide === "left" ? text : image}
    </section>
  );
}

function FinalCta({ copy, locale }: { copy: HomeCopy["cta"]; locale: Locale }) {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 sm:pb-24 lg:px-8">
      <div className="relative overflow-hidden rounded-[1.75rem] border p-6 theme-surface-elevated sm:p-8 lg:p-10">
        <div className="bm-grid-surface pointer-events-none absolute inset-0 opacity-[0.1]" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl text-center">
          <SectionEyebrow label={copy.eyebrow} />
          <h2 className="mt-4 text-2xl font-semibold tracking-[-0.01em] theme-foreground sm:text-[2rem]">
            {copy.title}
          </h2>
          <p className="mt-3 text-sm leading-6 theme-muted">{copy.text}</p>
        </div>
        <div className="relative mt-9 grid gap-4 md:grid-cols-2">
          <CtaCard
            icon={Building2}
            title={copy.sellerTitle}
            text={copy.sellerText}
            href={withLocale("/signup", locale)}
            label={copy.sellerCta}
          />
          <CtaCard
            icon={Search}
            title={copy.buyerTitle}
            text={copy.buyerText}
            href={withLocale("/signup", locale)}
            label={copy.buyerCta}
          />
        </div>
        <div className="relative mt-6 text-center">
          <Link
            href={withLocale("/marketplace", locale)}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold theme-ghost-button"
          >
            {copy.browseCta}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function CtaCard({
  icon: Icon,
  title,
  text,
  href,
  label,
}: {
  icon: typeof Building2;
  title: string;
  text: string;
  href: string;
  label: string;
}) {
  return (
    <article className="rounded-[1.35rem] border p-5 theme-surface">
      <div className="flex items-start gap-4">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border theme-success-badge">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold theme-foreground">{title}</h3>
          <p className="mt-2 text-[13px] leading-6 theme-muted">{text}</p>
          <Link
            href={href}
            className="mt-5 inline-flex min-h-9 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 theme-primary-button"
          >
            {label}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
