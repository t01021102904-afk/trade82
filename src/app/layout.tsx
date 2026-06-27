import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { I18nProvider } from "@/components/i18n-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trade82 | Korean-U.S. B2B Marketplace",
  description:
    "Trade82 connects Korean sellers with trusted American buyers and trade-ready product information.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col overflow-x-hidden antialiased">
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
