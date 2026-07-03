import {
  ArrowRight,
  Building2,
  ClipboardList,
  FileText,
  FolderOpen,
  LayoutDashboard,
  MessageCircle,
  Package,
  Search,
  Send,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { HomeWorkflowVisual } from "@/components/home-workflow-visual";
import { withLocale, type Locale } from "@/lib/i18n";

type HomeCopy = {
  eyebrow: string;
  headline: string;
  subheadline: string;
  primaryCta: string;
  secondaryCta: string;
  workflowEyebrow: string;
  workflowTitle: string;
  workflowText: string;
  featuresEyebrow: string;
  featuresTitle: string;
  featuresText: string;
  howEyebrow: string;
  howTitle: string;
  storyEyebrow: string;
  storyTitle: string;
  ctaEyebrow: string;
  ctaTitle: string;
  ctaText: string;
  finalPrimary: string;
  finalSecondary: string;
  visual: {
    sellerLabel: string;
    sellerTitle: string;
    sellerMeta: string[];
    platformLabel: string;
    platformTitle: string;
    platformItems: string[];
    buyerLabel: string;
    buyerTitle: string;
    inquiryTitle: string;
    inquiryText: string;
    statusDraft: string;
    statusPublished: string;
    statusLead: string;
  };
};

const homeCopy: Record<Locale, HomeCopy> = {
  en: {
    eyebrow: "Export operations workspace",
    headline: "Connect Korean suppliers with U.S. buyers and manage export work in one place.",
    subheadline:
      "Trade82 brings product discovery, buyer chat, export templates, and private document storage into a focused B2B workflow for Korean exporters and American buyers.",
    primaryCta: "Join as Seller",
    secondaryCta: "Browse Marketplace",
    workflowEyebrow: "System map",
    workflowTitle: "From product listing to export conversation, every step stays connected.",
    workflowText:
      "Trade82 turns scattered product data, buyer questions, and shipment documents into a structured workflow sellers can operate from one dashboard.",
    featuresEyebrow: "Core workspace",
    featuresTitle: "A cleaner operating layer for U.S. export readiness.",
    featuresText:
      "Find the right document template, answer buyer inquiries, organize files, and review products without jumping between tools.",
    howEyebrow: "How Trade82 works",
    howTitle: "A simple path from supplier profile to buyer inquiry.",
    storyEyebrow: "Product surfaces",
    storyTitle: "Designed around the export tasks sellers repeat every week.",
    ctaEyebrow: "Start the workflow",
    ctaTitle: "List products, talk with buyers, and keep export files organized.",
    ctaText:
      "Create a company profile, add products, and use Trade82 as the operating workspace between Korean suppliers and U.S. buyers.",
    finalPrimary: "Start Exporting Smarter",
    finalSecondary: "Explore Products",
    visual: {
      sellerLabel: "Korean Seller",
      sellerTitle: "PDRN skincare set",
      sellerMeta: ["MOQ 50 units", "Lead time 21 days", "Docs ready"],
      platformLabel: "Trade82",
      platformTitle: "Structured export workspace",
      platformItems: ["Templates", "Chat", "Drive"],
      buyerLabel: "U.S. Buyer",
      buyerTitle: "Category sourcing team",
      inquiryTitle: "Inquiry received",
      inquiryText: "Can you share carton specs, sample terms, and private-label options?",
      statusDraft: "Draft",
      statusPublished: "Published",
      statusLead: "Lead received",
    },
  },
  ko: {
    eyebrow: "수출 운영 워크스페이스",
    headline: "한국 셀러와 미국 바이어를 연결하고 수출 업무를 한곳에서 관리하세요.",
    subheadline:
      "Trade82는 상품 발견, 바이어 채팅, 수출 서류 템플릿, 비공개 문서 보관을 한국 수출기업과 미국 바이어를 위한 B2B 업무 흐름으로 정리합니다.",
    primaryCta: "셀러로 시작하기",
    secondaryCta: "마켓플레이스 보기",
    workflowEyebrow: "업무 흐름",
    workflowTitle: "상품 등록부터 수출 상담까지, 모든 단계가 연결됩니다.",
    workflowText:
      "흩어진 상품 정보, 바이어 문의, 선적 관련 문서를 하나의 구조화된 셀러 대시보드에서 관리할 수 있습니다.",
    featuresEyebrow: "핵심 워크스페이스",
    featuresTitle: "미국 수출 준비를 위한 더 깔끔한 운영 레이어.",
    featuresText:
      "필요한 서류 템플릿을 찾고, 바이어 문의에 답하고, 파일을 정리하고, 상품과 회사를 빠르게 확인할 수 있습니다.",
    howEyebrow: "Trade82 이용 흐름",
    howTitle: "회사 프로필에서 바이어 문의까지 이어지는 단순한 경로.",
    storyEyebrow: "제품 화면",
    storyTitle: "셀러가 반복하는 수출 업무를 중심으로 설계했습니다.",
    ctaEyebrow: "업무 시작하기",
    ctaTitle: "상품을 등록하고, 바이어와 대화하고, 수출 파일을 정리하세요.",
    ctaText:
      "회사 프로필과 상품을 등록하고, 한국 셀러와 미국 바이어 사이의 수출 운영 워크스페이스로 Trade82를 활용하세요.",
    finalPrimary: "더 스마트하게 수출 시작하기",
    finalSecondary: "상품 둘러보기",
    visual: {
      sellerLabel: "한국 셀러",
      sellerTitle: "PDRN 스킨케어 세트",
      sellerMeta: ["MOQ 50개", "리드타임 21일", "서류 준비"],
      platformLabel: "Trade82",
      platformTitle: "구조화된 수출 워크스페이스",
      platformItems: ["템플릿", "채팅", "드라이브"],
      buyerLabel: "미국 바이어",
      buyerTitle: "카테고리 소싱팀",
      inquiryTitle: "문의 도착",
      inquiryText: "카톤 규격, 샘플 조건, PB 가능 여부를 공유해 주실 수 있나요?",
      statusDraft: "초안",
      statusPublished: "공개 중",
      statusLead: "리드 도착",
    },
  },
};

export function HomeExperience({ locale }: { locale: Locale }) {
  const copy = homeCopy[locale];
  const featureCards = [
    {
      title: locale === "ko" ? "수출 계약 / 서류 탐색" : "Export contract / document finder",
      description:
        locale === "ko"
          ? "Proforma Invoice, Packing List, Purchase Order 같은 업무 템플릿을 빠르게 찾고 인쇄용 페이지로 열 수 있습니다."
          : "Quickly find workflow templates such as proforma invoices, packing lists, and purchase orders.",
      icon: FileText,
      visual: <TemplateMiniVisual locale={locale} />,
    },
    {
      title: locale === "ko" ? "바이어 채팅 / 문의 워크스페이스" : "Buyer chat / inquiry workspace",
      description:
        locale === "ko"
          ? "상품 문의를 대화형으로 관리하고, 필요한 수량·납기·포장 정보를 한 흐름 안에서 확인합니다."
          : "Manage product inquiries as structured conversations around quantity, lead time, and packaging details.",
      icon: MessageCircle,
      visual: <ChatMiniVisual locale={locale} />,
    },
    {
      title: locale === "ko" ? "문서 드라이브 / 파일 보관" : "Document drive / file storage",
      description:
        locale === "ko"
          ? "회사, 상품, 컴플라이언스, 선적, 계약 문서를 카테고리와 폴더로 정리합니다."
          : "Organize company, product, compliance, shipping, and contract files by folder and category.",
      icon: FolderOpen,
      visual: <DriveMiniVisual locale={locale} />,
    },
    {
      title: locale === "ko" ? "회사와 상품을 빠르게 확인" : "Company and product discovery dashboard",
      description:
        locale === "ko"
          ? "미국 바이어가 회사 프로필과 상품 정보를 빠르게 훑어보고 적합한 셀러에게 문의할 수 있습니다."
          : "Help U.S. buyers scan supplier profiles and product details before starting an inquiry.",
      icon: LayoutDashboard,
      visual: <DiscoveryMiniVisual locale={locale} />,
    },
  ];

  const workflowSteps = [
    {
      label: locale === "ko" ? "등록" : "Register",
      title: locale === "ko" ? "회사와 상품 등록" : "Register company and products",
      text:
        locale === "ko"
          ? "셀러 프로필, 상품 정보, 가격 공개 범위, 기본 수출 조건을 정리합니다."
          : "Add supplier profile, product data, visibility settings, and export-ready terms.",
      icon: Building2,
    },
    {
      label: locale === "ko" ? "발견" : "Discovery",
      title: locale === "ko" ? "미국 바이어에게 발견" : "Get discovered by U.S. buyers",
      text:
        locale === "ko"
          ? "카테고리, 키워드, 회사 프로필을 통해 바이어가 상품을 빠르게 확인합니다."
          : "Buyers scan categories, keywords, product cards, and supplier profiles.",
      icon: Search,
    },
    {
      label: locale === "ko" ? "대화" : "Inquiry",
      title: locale === "ko" ? "채팅으로 세부 조건 확인" : "Chat and share export details",
      text:
        locale === "ko"
          ? "샘플, MOQ, 카톤 규격, 납기, 서류 요청을 대화 안에서 정리합니다."
          : "Discuss samples, MOQ, carton specs, timelines, and document requests in one thread.",
      icon: MessageCircle,
    },
    {
      label: locale === "ko" ? "정리" : "Organize",
      title: locale === "ko" ? "문서 보관 및 진행 관리" : "Organize documents and continue the deal",
      text:
        locale === "ko"
          ? "수출 서류와 계약 관련 파일을 드라이브에 보관하고 다음 업무로 이어갑니다."
          : "Store export files and contract materials while the conversation moves forward.",
      icon: FolderOpen,
    },
  ];

  const storyBlocks = [
    {
      label: "A",
      title: locale === "ko" ? "계약 / 서류 템플릿 탐색" : "Contract finder",
      text:
        locale === "ko"
          ? "서류 라이브러리에서 Trade82 템플릿과 공식 출처 링크를 구분해 확인합니다."
          : "Browse Trade82 templates and official-source references without mixing up who prepares each form.",
      visual: <TemplateFinderPanel locale={locale} />,
    },
    {
      label: "B",
      title: locale === "ko" ? "바이어 채팅" : "Buyer chat",
      text:
        locale === "ko"
          ? "상품 문의 중심의 대화 화면에서 제품, 셀러, 첨부 문서를 함께 확인합니다."
          : "Keep product inquiry context, seller details, and attachments together in one clean thread.",
      visual: <ChatPanel locale={locale} />,
    },
    {
      label: "C",
      title: locale === "ko" ? "문서 드라이브" : "Document drive",
      text:
        locale === "ko"
          ? "카테고리와 폴더를 기준으로 제출 서류, 선적 서류, 계약 파일을 정리합니다."
          : "Sort submitted documents, shipping files, and contract materials into clear workspace categories.",
      visual: <DrivePanel locale={locale} />,
    },
    {
      label: "D",
      title: locale === "ko" ? "상품 / 회사 발견" : "Product and company discovery",
      text:
        locale === "ko"
          ? "미국 바이어가 셀러 회사와 상품 정보를 빠르게 비교하고 문의할 수 있게 보여줍니다."
          : "Give buyers a fast way to evaluate supplier profiles and products before contacting sellers.",
      visual: <DiscoveryPanel locale={locale} />,
    },
  ];

  return (
    <main className="overflow-hidden theme-bg">
      <section className="relative isolate border-b theme-border">
        <div className="bm-grid-surface pointer-events-none absolute inset-0 opacity-[0.16]" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" aria-hidden="true" />
        <div className="relative mx-auto grid min-h-[620px] max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:px-8">
          <div className="bm-section-in max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] theme-success-badge">
              <span className="bm-pulse-dot size-2 rounded-full bg-emerald-300" />
              {copy.eyebrow}
            </div>
            <h1 className="mt-6 text-[2rem] font-semibold leading-[1.06] tracking-[-0.01em] theme-foreground sm:text-[2.65rem] lg:text-[3.1rem]">
              {copy.headline}
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-6 theme-muted sm:text-[15px]">
              {copy.subheadline}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={withLocale("/onboarding/seller", locale)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 theme-primary-button"
              >
                {copy.primaryCta}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href={withLocale("/marketplace", locale)}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 theme-secondary-button"
              >
                {copy.secondaryCta}
              </Link>
            </div>
          </div>
          <HomeWorkflowVisual copy={copy.visual} />
        </div>
      </section>

      <WorkflowMapSection copy={copy} locale={locale} />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <SectionHeader
          eyebrow={copy.featuresEyebrow}
          title={copy.featuresTitle}
          text={copy.featuresText}
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {featureCards.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </section>

      <HowItWorksSection
        eyebrow={copy.howEyebrow}
        title={copy.howTitle}
        steps={workflowSteps}
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <SectionHeader
          eyebrow={copy.storyEyebrow}
          title={copy.storyTitle}
          text={
            locale === "ko"
              ? "큰 설명보다 실제 업무 화면에 가까운 구조로, 셀러가 필요한 기능을 빠르게 이해하도록 구성했습니다."
              : "Instead of long copy, each block shows the practical surface sellers use to manage export workflow."
          }
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          {storyBlocks.map((block) => (
            <StoryBlock key={block.label} block={block} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[1.75rem] border p-6 theme-surface-elevated sm:p-8 lg:flex lg:items-center lg:justify-between">
          <div className="bm-grid-surface pointer-events-none absolute inset-0 opacity-[0.12]" aria-hidden="true" />
          <div className="relative max-w-2xl">
            <SectionEyebrow label={copy.ctaEyebrow} />
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.01em] theme-foreground sm:text-[1.85rem]">
              {copy.ctaTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 theme-muted">{copy.ctaText}</p>
          </div>
          <div className="relative mt-7 flex flex-col gap-3 sm:flex-row lg:mt-0">
            <Link
              href={withLocale("/onboarding/seller", locale)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 theme-primary-button"
            >
              {copy.finalPrimary}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href={withLocale("/marketplace", locale)}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 theme-secondary-button"
            >
              {copy.finalSecondary}
            </Link>
          </div>
        </div>
      </section>
    </main>
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
      <h2 className="mt-4 text-2xl font-semibold tracking-[-0.01em] theme-foreground sm:text-[1.9rem]">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 theme-muted">{text}</p>
    </div>
  );
}

function WorkflowMapSection({
  copy,
  locale,
}: {
  copy: HomeCopy;
  locale: Locale;
}) {
  const nodes = [
    {
      label: locale === "ko" ? "한국 셀러" : "Korean Seller",
      title: locale === "ko" ? "상품과 회사 정보 등록" : "Product and company data",
      badge: copy.visual.statusDraft,
      icon: Package,
    },
    {
      label: locale === "ko" ? "상품 리스팅" : "Product Listing",
      title: locale === "ko" ? "바이어용 데이터 정리" : "Buyer-facing structure",
      badge: copy.visual.statusPublished,
      icon: LayoutDashboard,
    },
    {
      label: locale === "ko" ? "바이어 발견" : "Buyer Discovery",
      title: locale === "ko" ? "카테고리와 키워드 검색" : "Category and keyword scan",
      badge: locale === "ko" ? "검색" : "Search",
      icon: Search,
    },
    {
      label: locale === "ko" ? "채팅 / 문의" : "Chat / Inquiry",
      title: locale === "ko" ? "수량, 샘플, 조건 확인" : "Quantity, samples, terms",
      badge: copy.visual.statusLead,
      icon: MessageCircle,
    },
    {
      label: locale === "ko" ? "문서 공유" : "Document Sharing",
      title: locale === "ko" ? "계약, 선적, 컴플라이언스 파일" : "Contract, shipping, compliance files",
      badge: locale === "ko" ? "드라이브" : "Drive",
      icon: FolderOpen,
    },
    {
      label: locale === "ko" ? "수출 진행" : "Export Progress",
      title: locale === "ko" ? "거래 대화 이어가기" : "Continue deal workflow",
      badge: locale === "ko" ? "진행" : "Progress",
      icon: Send,
    },
  ];

  return (
    <section className="border-b theme-border">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.58fr_1.42fr] lg:items-start">
          <SectionHeader
            eyebrow={copy.workflowEyebrow}
            title={copy.workflowTitle}
            text={copy.workflowText}
          />
          <div className="rounded-[1.75rem] border p-3 theme-surface">
            <div className="home-system-map rounded-[1.35rem] border p-4 theme-surface-elevated sm:p-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {nodes.map((node, index) => (
                  <WorkflowNode key={node.label} node={node} index={index} />
                ))}
              </div>
              <div className="mt-5 h-1 overflow-hidden rounded-full border theme-border theme-surface-muted">
                <span className="home-progress-line block h-full w-full rounded-full bg-gradient-to-r from-emerald-300 via-emerald-200 to-sky-200" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkflowNode({
  node,
  index,
}: {
  node: {
    label: string;
    title: string;
    badge: string;
    icon: typeof Package;
  };
  index: number;
}) {
  const Icon = node.icon;
  return (
    <article
      className="bm-premium-card rounded-2xl border p-4 theme-surface-muted"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex size-9 items-center justify-center rounded-xl border theme-border theme-surface-elevated">
          <Icon className="size-4 text-[var(--accent-foreground)]" aria-hidden="true" />
        </span>
        <span className="rounded-full border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] theme-success-badge">
          {node.badge}
        </span>
      </div>
      <p className="mt-5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] theme-muted">
        {node.label}
      </p>
      <h3 className="mt-2 min-h-10 text-sm font-semibold leading-5 theme-foreground">
        {node.title}
      </h3>
    </article>
  );
}

function FeatureCard({
  feature,
  index,
}: {
  feature: {
    title: string;
    description: string;
    icon: typeof FileText;
    visual: ReactNode;
  };
  index: number;
}) {
  const Icon = feature.icon;
  return (
    <article
      className="bm-premium-card bm-section-in grid min-h-[300px] gap-5 rounded-[1.4rem] border p-4 theme-surface"
      style={{ animationDelay: `${index * 55}ms` }}
    >
      <div className="rounded-2xl border p-4 theme-surface-elevated">
        {feature.visual}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-lg border theme-border theme-surface-muted">
            <Icon className="size-4 text-[var(--accent-foreground)]" aria-hidden="true" />
          </span>
          <h3 className="text-base font-semibold theme-foreground">{feature.title}</h3>
        </div>
        <p className="mt-3 text-[13px] leading-6 theme-muted">{feature.description}</p>
      </div>
    </article>
  );
}

function HowItWorksSection({
  eyebrow,
  title,
  steps,
}: {
  eyebrow: string;
  title: string;
  steps: Array<{
    label: string;
    title: string;
    text: string;
    icon: typeof Building2;
  }>;
}) {
  return (
    <section className="border-y theme-border">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <SectionHeader eyebrow={eyebrow} title={title} text="" />
        <div className="mt-10 grid gap-3 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <article key={step.label} className="rounded-2xl border p-4 theme-surface">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] theme-success-text">
                    0{index + 1} / {step.label}
                  </span>
                  <span className="inline-flex size-8 items-center justify-center rounded-lg border theme-border theme-surface-muted">
                    <Icon className="size-4 text-[var(--accent-foreground)]" aria-hidden="true" />
                  </span>
                </div>
                <h3 className="mt-5 text-sm font-semibold theme-foreground">{step.title}</h3>
                <p className="mt-3 text-xs leading-5 theme-muted">{step.text}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function StoryBlock({
  block,
}: {
  block: {
    label: string;
    title: string;
    text: string;
    visual: ReactNode;
  };
}) {
  return (
    <article className="bm-premium-card rounded-[1.4rem] border p-4 theme-surface">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border font-mono text-[11px] font-semibold theme-success-badge">
          {block.label}
        </span>
        <div>
          <h3 className="text-base font-semibold theme-foreground">{block.title}</h3>
          <p className="mt-2 text-[13px] leading-6 theme-muted">{block.text}</p>
        </div>
      </div>
      <div className="mt-5 rounded-2xl border p-4 theme-surface-elevated">
        {block.visual}
      </div>
    </article>
  );
}

function TemplateMiniVisual({ locale }: { locale: Locale }) {
  const rows =
    locale === "ko"
      ? ["Proforma Invoice", "Packing List", "Purchase Order"]
      : ["Proforma Invoice", "Packing List", "Purchase Order"];
  return (
    <div className="grid gap-2">
      {rows.map((row, index) => (
        <div key={row} className="flex items-center justify-between rounded-xl border px-3 py-2 theme-surface-muted">
          <span className="flex items-center gap-2 text-xs font-medium theme-foreground">
            <FileText className="size-3.5 text-[var(--accent-foreground)]" aria-hidden="true" />
            {row}
          </span>
          <span className="font-mono text-[10px] theme-muted">{index === 0 ? "PDF" : "HTML"}</span>
        </div>
      ))}
    </div>
  );
}

function ChatMiniVisual({ locale }: { locale: Locale }) {
  return (
    <div className="grid gap-2">
      <div className="max-w-[78%] rounded-2xl border px-3 py-2 text-xs theme-surface-muted">
        {locale === "ko" ? "샘플 조건을 확인할 수 있을까요?" : "Can you confirm sample terms?"}
      </div>
      <div className="ml-auto max-w-[78%] rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs theme-foreground">
        {locale === "ko" ? "MOQ와 리드타임을 공유드릴게요." : "We can share MOQ and lead time."}
      </div>
      <div className="flex items-center gap-2 rounded-xl border px-3 py-2 theme-surface-muted">
        <Send className="size-3.5 text-[var(--accent-foreground)]" aria-hidden="true" />
        <span className="text-xs theme-muted">{locale === "ko" ? "상품 문의 스레드" : "Product inquiry thread"}</span>
      </div>
    </div>
  );
}

function DriveMiniVisual({ locale }: { locale: Locale }) {
  const folders =
    locale === "ko"
      ? ["회사", "상품", "선적", "계약"]
      : ["Company", "Product", "Shipping", "Contracts"];
  return (
    <div className="grid grid-cols-2 gap-2">
      {folders.map((folder) => (
        <div key={folder} className="rounded-xl border p-3 theme-surface-muted">
          <FolderOpen className="size-4 text-[var(--accent-foreground)]" aria-hidden="true" />
          <p className="mt-3 text-xs font-semibold theme-foreground">{folder}</p>
          <span className="mt-2 block h-1.5 w-14 rounded-full bg-emerald-300/30" />
        </div>
      ))}
    </div>
  );
}

function DiscoveryMiniVisual({ locale }: { locale: Locale }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2 rounded-xl border px-3 py-2 theme-surface-muted">
        <Search className="size-3.5 text-[var(--accent-foreground)]" aria-hidden="true" />
        <span className="text-xs theme-muted">{locale === "ko" ? "skincare, supplements" : "skincare, supplements"}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SmallProductCard title={locale === "ko" ? "마스크팩" : "Mask pack"} />
        <SmallProductCard title={locale === "ko" ? "콜라겐" : "Collagen"} />
      </div>
    </div>
  );
}

function SmallProductCard({ title }: { title: string }) {
  return (
    <div className="rounded-xl border p-3 theme-surface-muted">
      <div className="aspect-[1.35] rounded-lg border bg-emerald-300/10 theme-border" />
      <p className="mt-2 truncate text-xs font-semibold theme-foreground">{title}</p>
    </div>
  );
}

function TemplateFinderPanel({ locale }: { locale: Locale }) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2 rounded-xl border px-3 py-2 theme-surface-muted">
        <Search className="size-4 text-[var(--accent-foreground)]" aria-hidden="true" />
        <span className="text-xs theme-muted">{locale === "ko" ? "invoice, origin, packing" : "invoice, origin, packing"}</span>
      </div>
      <div className="grid gap-2">
        {["Proforma Invoice", "Certificate of Origin", "Document Checklist"].map((item) => (
          <div key={item} className="flex items-center justify-between rounded-xl border px-3 py-2 theme-surface-muted">
            <span className="text-xs font-medium theme-foreground">{item}</span>
            <span className="rounded-full border px-2 py-0.5 font-mono text-[10px] theme-success-badge">
              {locale === "ko" ? "템플릿" : "Template"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatPanel({ locale }: { locale: Locale }) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between rounded-xl border px-3 py-2 theme-surface-muted">
        <span className="text-xs font-semibold theme-foreground">{locale === "ko" ? "상품 문의" : "Product inquiry"}</span>
        <span className="rounded-full border px-2 py-0.5 font-mono text-[10px] theme-success-badge">
          {locale === "ko" ? "새 문의" : "New"}
        </span>
      </div>
      <div className="grid gap-2">
        <div className="max-w-[78%] rounded-2xl border px-3 py-2 text-xs theme-surface-muted">
          {locale === "ko" ? "카톤 규격과 월 공급량을 알고 싶습니다." : "Can you share carton dimensions and monthly capacity?"}
        </div>
        <div className="ml-auto max-w-[78%] rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs theme-foreground">
          {locale === "ko" ? "자료를 정리해서 전달드리겠습니다." : "We will organize the details and share them."}
        </div>
      </div>
    </div>
  );
}

function DrivePanel({ locale }: { locale: Locale }) {
  const files =
    locale === "ko"
      ? ["회사 제출 서류", "상품 스펙 시트", "선적 서류", "계약 초안"]
      : ["Company documents", "Product spec sheet", "Shipping files", "Contract draft"];
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {files.map((file) => (
        <div key={file} className="rounded-xl border p-3 theme-surface-muted">
          <ClipboardList className="size-4 text-[var(--accent-foreground)]" aria-hidden="true" />
          <p className="mt-3 text-xs font-semibold theme-foreground">{file}</p>
          <p className="mt-1 font-mono text-[10px] theme-muted">private / drive</p>
        </div>
      ))}
    </div>
  );
}

function DiscoveryPanel({ locale }: { locale: Locale }) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border p-3 theme-surface-muted">
          <Building2 className="size-4 text-[var(--accent-foreground)]" aria-hidden="true" />
          <p className="mt-3 text-xs font-semibold theme-foreground">{locale === "ko" ? "셀러 회사" : "Supplier profile"}</p>
          <p className="mt-1 text-[11px] theme-muted">{locale === "ko" ? "카테고리, 국가, 소개" : "Category, origin, overview"}</p>
        </div>
        <div className="rounded-xl border p-3 theme-surface-muted">
          <Package className="size-4 text-[var(--accent-foreground)]" aria-hidden="true" />
          <p className="mt-3 text-xs font-semibold theme-foreground">{locale === "ko" ? "상품 카드" : "Product card"}</p>
          <p className="mt-1 text-[11px] theme-muted">{locale === "ko" ? "MOQ, 리드타임, 공개 정보" : "MOQ, lead time, visible fields"}</p>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full border theme-border theme-surface-muted">
        <span className="home-progress-line block h-full w-full rounded-full bg-gradient-to-r from-emerald-300 to-sky-200" />
      </div>
    </div>
  );
}
