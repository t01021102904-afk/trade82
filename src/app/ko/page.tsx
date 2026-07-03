import type { Metadata } from "next";

import { HomeExperience } from "@/components/home-experience";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Trade82 | Korean-U.S. B2B Marketplace",
  description:
    "Connect Korean sellers with U.S. buyers and manage export workflows in one workspace.",
  path: "/ko",
  languages: {
    en: "/",
    ko: "/ko",
  },
});

export default function KoHome() {
  return <HomeExperience locale="ko" />;
}
