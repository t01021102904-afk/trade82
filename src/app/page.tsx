import Link from "next/link";

import { Badge } from "@/components/badge";
import { ProductCard } from "@/components/product-card";
import { SectionHeader } from "@/components/section-header";
import { SellerCard } from "@/components/seller-card";
import { publicProducts, publicSellers } from "@/lib/mock-data";
import { getDictionary } from "@/lib/i18n";

export default function Home() {
  const messages = getDictionary("en");
  const featuredProducts = publicProducts.slice(0, 3);
  const featuredSellers = publicSellers.slice(0, 3);

  const valueCards = [
    {
      title: messages.home.valueTitle1,
      description: messages.home.valueText1,
    },
    {
      title: messages.home.valueTitle2,
      description: messages.home.valueText2,
    },
    {
      title: messages.home.valueTitle3,
      description: messages.home.valueText3,
    },
  ];
  const steps = [messages.home.step1, messages.home.step2, messages.home.step3];
  const stepText = [messages.home.step1Text, messages.home.step2Text, messages.home.step3Text];

  return (
    <div className="bg-white">
      <section
        className="relative overflow-hidden bg-zinc-950"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(9,9,11,0.88), rgba(9,9,11,0.55), rgba(9,9,11,0.3)), url(https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1800&q=80)",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="mx-auto grid min-h-[560px] max-w-7xl content-center px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <Badge tone="blue">{messages.home.heroBadge}</Badge>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold text-white sm:text-6xl">
              {messages.home.headline}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-100">
              {messages.home.subheadline}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/marketplace"
                className="inline-flex items-center justify-center rounded-md bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-blue-50 hover:text-blue-700"
              >
                {messages.common.browseProducts}
              </Link>
              <Link
                href="/sellers"
                className="inline-flex items-center justify-center rounded-md border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10"
              >
                {messages.common.viewSellers}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-14 sm:px-6 lg:grid-cols-3 lg:px-8">
          {valueCards.map((card) => (
            <div key={card.title} className="rounded-lg border border-zinc-200 p-6">
              <h2 className="text-lg font-semibold text-zinc-950">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{card.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeader
          label={messages.home.featuredProducts}
          title={messages.home.catalogPreview}
          description={messages.home.catalogDescription}
          action={
            <Link href="/marketplace" className="text-sm font-semibold text-blue-700">
              {messages.home.viewAllProducts}
            </Link>
          }
        />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="bg-zinc-50">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeader
            label={messages.home.featuredSellers}
            title={messages.home.sellerPreview}
            description={messages.home.sellerDescription}
            action={
              <Link href="/sellers" className="text-sm font-semibold text-blue-700">
                {messages.home.viewAllSellers}
              </Link>
            }
          />
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {featuredSellers.map((seller) => (
              <SellerCard key={seller.id} seller={seller} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeader
          label={messages.home.howItWorks}
          title={messages.home.howTitle}
          description={messages.home.howDescription}
        />
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step} className="rounded-lg border border-zinc-200 bg-white p-6">
              <span className="flex size-9 items-center justify-center rounded-md bg-blue-50 text-sm font-semibold text-blue-700">
                {index + 1}
              </span>
              <h3 className="mt-5 text-lg font-semibold text-zinc-950">{step}</h3>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                {stepText[index]}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-zinc-200 bg-zinc-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <h2 className="text-3xl font-semibold text-white">
              {messages.home.ctaTitle}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
              {messages.home.ctaText}
            </p>
          </div>
          <Link
            href="/onboarding/buyer"
            className="inline-flex items-center justify-center rounded-md bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-blue-50 hover:text-blue-700"
          >
            {messages.common.joinAsBuyer}
          </Link>
        </div>
      </section>
    </div>
  );
}
