import type { Metadata } from "next";

import { HomeExperience } from "@/components/home-experience";
import {
  KOREAN_HOME_DESCRIPTION,
  KOREAN_HOME_TITLE,
  publicPageMetadata,
} from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: KOREAN_HOME_TITLE,
  description: KOREAN_HOME_DESCRIPTION,
  path: "/ko",
  languages: {
    en: "/en",
    "x-default": "/",
    ko: "/ko",
  },
});

export default function KoHome() {
  return <HomeExperience locale="ko" />;
}
