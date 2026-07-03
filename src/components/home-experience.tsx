import {
  ArrowRight,
  Building2,
  FileText,
  FolderOpen,
  LayoutDashboard,
  MessageCircle,
  Search,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { HomeWorkflowVisual } from "@/components/home-workflow-visual";
import { withLocale, type Locale } from "@/lib/i18n";

type LandingImage = {
  src: string;
  alt: string;
};

type FeatureItem = {
  title: string;
  description: string;
  image: LandingImage;
  icon: typeof FileText;
};

type StepItem = {
  label: string;
  title: string;
  text: string;
  icon: typeof Building2;
};

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
  storyText: string;
  ctaEyebrow: string;
  ctaTitle: string;
  ctaText: string;
  finalPrimary: string;
  finalSecondary: string;
};

const landingImages = {
  documents: "/landing/export-documents.png",
  chat: "/landing/beauty-products-chat.png",
  logistics: "/landing/logistics-shipping.png",
} as const;

const homeCopy: Record<Locale, HomeCopy> = {
  en: {
    eyebrow: "Export operations workspace",
    headline: "Connect Korean suppliers with U.S. buyers and manage export work in one place.",
    subheadline:
      "Trade82 helps Korean sellers find export templates, talk with buyers, store trade documents, and review company and product information from one focused B2B workspace.",
    primaryCta: "Join as Seller",
    secondaryCta: "Browse Marketplace",
    workflowEyebrow: "Workflow",
    workflowTitle: "A visual workspace for the export tasks sellers repeat every week.",
    workflowText:
      "Move from document search to buyer conversation to logistics-ready files without leaving the Trade82 workspace.",
    featuresEyebrow: "Core benefits",
    featuresTitle: "Four practical tools for Korean exporters and U.S. buyers.",
    featuresText:
      "The homepage stays visual and simple: documents, chat, storage, and product discovery are the core story.",
    howEyebrow: "How Trade82 works",
    howTitle: "A clean path from supplier profile to buyer inquiry.",
    storyEyebrow: "Product surfaces",
    storyTitle: "Image-led workflows, not cluttered diagrams.",
    storyText:
      "Each Trade82 surface is designed around a concrete export workflow: finding templates, answering buyers, storing files, and reviewing seller products.",
    ctaEyebrow: "Start the workflow",
    ctaTitle: "List products, talk with buyers, and keep export files organized.",
    ctaText:
      "Create a company profile, add products, and use Trade82 as the operating workspace between Korean suppliers and U.S. buyers.",
    finalPrimary: "Start Exporting Smarter",
    finalSecondary: "Explore Products",
  },
  ko: {
    eyebrow: "수출 운영 워크스페이스",
    headline: "한국 셀러와 미국 바이어를 연결하고 수출 업무를 한곳에서 관리하세요.",
    subheadline:
      "Trade82는 한국 셀러가 수출 서류 템플릿을 찾고, 바이어와 대화하고, 무역 문서를 보관하고, 회사와 상품 정보를 빠르게 확인할 수 있도록 돕습니다.",
    primaryCta: "셀러로 시작하기",
    secondaryCta: "마켓플레이스 보기",
    workflowEyebrow: "업무 흐름",
    workflowTitle: "셀러가 매주 반복하는 수출 업무를 시각적으로 정리한 워크스페이스.",
    workflowText:
      "서류 탐색, 바이어 대화, 물류 관련 파일 정리를 Trade82 안에서 자연스럽게 이어갑니다.",
    featuresEyebrow: "핵심 기능",
    featuresTitle: "한국 수출기업과 미국 바이어를 위한 네 가지 실무 도구.",
    featuresText:
      "서류, 채팅, 문서 보관, 상품 발견이라는 핵심 흐름을 이미지 중심으로 간결하게 보여줍니다.",
    howEyebrow: "Trade82 이용 흐름",
    howTitle: "회사 프로필에서 바이어 문의까지 이어지는 단순한 경로.",
    storyEyebrow: "제품 화면",
    storyTitle: "복잡한 다이어그램보다 실제 수출 업무에 가까운 시각 구성.",
    storyText:
      "템플릿 탐색, 바이어 응대, 파일 보관, 셀러 상품 확인처럼 실제로 필요한 업무를 중심으로 구성했습니다.",
    ctaEyebrow: "업무 시작하기",
    ctaTitle: "상품을 등록하고, 바이어와 대화하고, 수출 파일을 정리하세요.",
    ctaText:
      "회사 프로필과 상품을 등록하고, 한국 셀러와 미국 바이어 사이의 수출 운영 워크스페이스로 Trade82를 활용하세요.",
    finalPrimary: "더 스마트하게 수출 시작하기",
    finalSecondary: "상품 둘러보기",
  },
};

export function HomeExperience({ locale }: { locale: Locale }) {
  const copy = homeCopy[locale];
  const featureCards: FeatureItem[] = [
    {
      title: locale === "ko" ? "수출 서류를 더 빠르게 찾기" : "Find export documents faster",
      description:
        locale === "ko"
          ? "Proforma Invoice, Packing List, Purchase Order 같은 수출 업무 템플릿을 빠르게 찾고 열람합니다."
          : "Quickly find practical export templates such as proforma invoices, packing lists, and purchase orders.",
      image: {
        src: landingImages.documents,
        alt: locale === "ko" ? "수출 서류 템플릿 일러스트" : "Export document templates illustration",
      },
      icon: FileText,
    },
    {
      title: locale === "ko" ? "미국 바이어와 직접 채팅" : "Chat with U.S. buyers",
      description:
        locale === "ko"
          ? "상품 문의, 샘플 조건, MOQ, 포장 정보처럼 바이어가 묻는 내용을 대화 안에서 정리합니다."
          : "Keep buyer questions about samples, MOQ, packaging, and terms inside a focused product inquiry thread.",
      image: {
        src: landingImages.chat,
        alt: locale === "ko" ? "화장품 상품 문의 채팅 일러스트" : "Beauty product buyer chat illustration",
      },
      icon: MessageCircle,
    },
    {
      title: locale === "ko" ? "수출 문서를 한 워크스페이스에 보관" : "Store export documents in one workspace",
      description:
        locale === "ko"
          ? "회사, 상품, 컴플라이언스, 선적, 계약 파일을 카테고리와 폴더 기준으로 정리합니다."
          : "Organize company, product, compliance, shipping, and contract files by category and folder.",
      image: {
        src: landingImages.logistics,
        alt: locale === "ko" ? "수출 물류와 서류 워크플로 일러스트" : "Export logistics and shipping workflow illustration",
      },
      icon: FolderOpen,
    },
    {
      title: locale === "ko" ? "셀러 회사와 상품을 빠르게 확인" : "View seller companies and products quickly",
      description:
        locale === "ko"
          ? "미국 바이어가 셀러 회사, 상품, 문의 가능한 정보를 빠르게 훑어보고 다음 대화를 시작합니다."
          : "Help buyers scan supplier profiles, product cards, and inquiry-ready information before starting a conversation.",
      image: {
        src: landingImages.chat,
        alt: locale === "ko" ? "상품 발견과 바이어 문의 일러스트" : "Product discovery and buyer inquiry illustration",
      },
      icon: LayoutDashboard,
    },
  ];

  const workflowCards = [
    {
      title: locale === "ko" ? "수출 서류 탐색" : "Export document search",
      text:
        locale === "ko"
          ? "템플릿과 공식 출처를 분리해서 확인합니다."
          : "Browse templates and official-source references clearly.",
      image: featureCards[0].image,
    },
    {
      title: locale === "ko" ? "바이어 문의" : "Buyer inquiry",
      text:
        locale === "ko"
          ? "상품 조건과 샘플 요청을 채팅 안에서 정리합니다."
          : "Discuss product terms and sample requests in chat.",
      image: featureCards[1].image,
    },
    {
      title: locale === "ko" ? "문서와 물류 흐름" : "Documents and logistics",
      text:
        locale === "ko"
          ? "수출 진행에 필요한 파일을 워크스페이스에 보관합니다."
          : "Keep export-ready files organized in a workspace.",
      image: featureCards[2].image,
    },
  ];

  const steps: StepItem[] = [
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
          ? "샘플, MOQ, 포장, 납기, 서류 요청을 대화 안에서 정리합니다."
          : "Discuss samples, MOQ, packaging, timelines, and document requests in one thread.",
      icon: MessageCircle,
    },
    {
      label: locale === "ko" ? "정리" : "Organize",
      title: locale === "ko" ? "문서 보관 및 진행 관리" : "Organize documents and continue the deal",
      text:
        locale === "ko"
          ? "수출 서류와 계약 관련 파일을 보관하고 다음 업무로 이어갑니다."
          : "Store export files and contract materials while the conversation moves forward.",
      icon: FolderOpen,
    },
  ];

  return (
    <main className="overflow-hidden theme-bg">
      <section className="relative isolate border-b theme-border">
        <div className="bm-grid-surface pointer-events-none absolute inset-0 opacity-[0.16]" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" aria-hidden="true" />
        <div className="relative mx-auto grid min-h-[620px] max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:px-8">
          <div className="bm-section-in max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] theme-success-badge">
              <span className="bm-pulse-dot size-2 rounded-full bg-emerald-300" />
              {copy.eyebrow}
            </div>
            <h1 className="mt-6 text-[2rem] font-semibold leading-[1.06] tracking-[-0.01em] theme-foreground sm:text-[2.65rem] lg:text-[3rem]">
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
          <HomeWorkflowVisual locale={locale} />
        </div>
      </section>

      <ImageWorkflowSection
        copy={copy}
        workflowCards={workflowCards}
      />

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

      <HowItWorksSection eyebrow={copy.howEyebrow} title={copy.howTitle} steps={steps} />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <SectionHeader
          eyebrow={copy.storyEyebrow}
          title={copy.storyTitle}
          text={copy.storyText}
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {workflowCards.map((card, index) => (
            <ImageStoryCard key={card.title} card={card} index={index} />
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

function LandingImageFrame({
  image,
  priority = false,
}: {
  image: LandingImage;
  priority?: boolean;
}) {
  return (
    <div className="home-image-stage relative aspect-[4/3] overflow-hidden rounded-2xl border theme-border theme-surface-muted">
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes="(min-width: 1024px) 520px, (min-width: 768px) 50vw, 100vw"
        priority={priority}
        className="home-isometric-image object-contain p-5"
      />
    </div>
  );
}

function ImageWorkflowSection({
  copy,
  workflowCards,
}: {
  copy: HomeCopy;
  workflowCards: Array<{
    title: string;
    text: string;
    image: LandingImage;
  }>;
}) {
  return (
    <section className="border-b theme-border">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.62fr_1.38fr] lg:items-start">
          <SectionHeader
            eyebrow={copy.workflowEyebrow}
            title={copy.workflowTitle}
            text={copy.workflowText}
          />
          <div className="grid gap-4 md:grid-cols-3">
            {workflowCards.map((card, index) => (
              <article
                key={card.title}
                className="bm-premium-card rounded-[1.4rem] border p-3 theme-surface"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <LandingImageFrame image={card.image} />
                <div className="p-2 pt-4">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] theme-success-text">
                    0{index + 1}
                  </p>
                  <h3 className="mt-2 text-sm font-semibold theme-foreground">{card.title}</h3>
                  <p className="mt-2 text-xs leading-5 theme-muted">{card.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  feature,
  index,
}: {
  feature: FeatureItem;
  index: number;
}) {
  const Icon = feature.icon;
  return (
    <article
      className="bm-premium-card bm-section-in rounded-[1.4rem] border p-4 theme-surface"
      style={{ animationDelay: `${index * 55}ms` }}
    >
      <LandingImageFrame image={feature.image} />
      <div className="mt-5">
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
  steps: StepItem[];
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

function ImageStoryCard({
  card,
  index,
}: {
  card: {
    title: string;
    text: string;
    image: LandingImage;
  };
  index: number;
}) {
  return (
    <article
      className="bm-premium-card rounded-[1.4rem] border p-4 theme-surface"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <LandingImageFrame image={card.image} />
      <div className="mt-5">
        <span className="rounded-full border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] theme-success-badge">
          0{index + 1}
        </span>
        <h3 className="mt-4 text-base font-semibold theme-foreground">{card.title}</h3>
        <p className="mt-2 text-[13px] leading-6 theme-muted">{card.text}</p>
      </div>
    </article>
  );
}
