import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { I18nProvider } from "@/components/i18n-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { DEFAULT_OG_IMAGE_URL, SITE_URL } from "@/lib/seo";
import "./globals.css";

const defaultTitle = "Trade82 | Korean-U.S. B2B Marketplace";
const defaultDescription =
  "Connect Korean sellers with U.S. buyers and manage export workflows in one workspace.";
const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Trade82",
    url: SITE_URL,
    logo: `${SITE_URL}/trade82-logo.png`,
    sameAs: [],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Trade82",
    url: SITE_URL,
  },
  {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Trade82 primary navigation",
    itemListElement: [
      { "@type": "SiteNavigationElement", position: 1, name: "Login", url: `${SITE_URL}/login` },
      { "@type": "SiteNavigationElement", position: 2, name: "Sign up", url: `${SITE_URL}/signup` },
      { "@type": "SiteNavigationElement", position: 3, name: "Marketplace", url: `${SITE_URL}/marketplace` },
      { "@type": "SiteNavigationElement", position: 4, name: "Sellers", url: `${SITE_URL}/sellers` },
    ],
  },
];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: defaultTitle,
  description: defaultDescription,
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    url: "https://trade82.com",
    siteName: "Trade82",
    type: "website",
    images: [
      {
        url: DEFAULT_OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "Trade82 Korean-U.S. B2B Marketplace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: [DEFAULT_OG_IMAGE_URL],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="flex min-h-full flex-col overflow-x-hidden antialiased theme-bg">
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var key='trade82-theme';var saved=localStorage.getItem(key)||'system';if(saved!=='light'&&saved!=='dark'&&saved!=='system')saved='system';var system=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';var theme=saved==='system'?system:saved;document.documentElement.dataset.theme=theme;document.documentElement.dataset.themePreference=saved;document.documentElement.style.colorScheme=theme;}catch(e){document.documentElement.dataset.theme='dark';document.documentElement.dataset.themePreference='system';document.documentElement.style.colorScheme='dark';}})();",
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
        <ClerkProvider>
          <ThemeProvider>
            <I18nProvider>
              <SiteHeader />
              <main className="min-w-0 flex-1">{children}</main>
              <SiteFooter />
            </I18nProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
