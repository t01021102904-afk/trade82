import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { I18nProvider } from "@/components/i18n-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  DEFAULT_HOME_DESCRIPTION,
  DEFAULT_HOME_TITLE,
  DEFAULT_OG_IMAGE_URL,
  SITE_URL,
  organizationJsonLd,
  siteNavigationJsonLd,
  websiteJsonLd,
} from "@/lib/seo";
import "./globals.css";

const structuredData = [
  organizationJsonLd(),
  websiteJsonLd(),
  siteNavigationJsonLd(),
];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: DEFAULT_HOME_TITLE,
  description: DEFAULT_HOME_DESCRIPTION,
  alternates: {
    canonical: SITE_URL,
    languages: {
      en: SITE_URL,
      ko: `${SITE_URL}/ko`,
      "x-default": SITE_URL,
    },
  },
  openGraph: {
    title: DEFAULT_HOME_TITLE,
    description: DEFAULT_HOME_DESCRIPTION,
    url: "https://trade82.com",
    siteName: "Trade82",
    type: "website",
    images: [
      {
        url: DEFAULT_OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "Trade82 global B2B marketplace for Korean products",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_HOME_TITLE,
    description: DEFAULT_HOME_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE_URL],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" },
    ],
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full"
      data-theme="light"
      data-theme-preference="light"
    >
      <body className="flex min-h-full flex-col overflow-x-hidden antialiased theme-bg">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
        <ClerkProvider>
          <I18nProvider>
            <SiteHeader />
            <main className="min-w-0 flex-1">{children}</main>
            <SiteFooter />
          </I18nProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
