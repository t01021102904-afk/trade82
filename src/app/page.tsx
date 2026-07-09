import type { Metadata } from "next";

import { HomeExperience } from "@/components/home-experience";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Trade82 | Korean-Global B2B Marketplace",
  description:
    "Connect Korean sellers with buyers worldwide and manage export workflows in one workspace.",
  path: "/",
  languages: {
    en: "/",
    ko: "/ko",
  },
});

export default function Home() {
  return <HomeExperience locale="en" />;
}
