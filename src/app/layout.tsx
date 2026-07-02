import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { I18nProvider } from "@/components/i18n-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trade82 | Korean-U.S. B2B Marketplace",
  description:
    "Trade82 connects Korean sellers with trusted American buyers and trade-ready product information.",
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
