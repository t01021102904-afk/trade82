import type { Metadata } from "next";

import { HomeExperience } from "@/components/home-experience";
import { publicPageMetadata } from "@/lib/seo";
import {
  DEFAULT_HOME_DESCRIPTION,
  DEFAULT_HOME_TITLE,
} from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: DEFAULT_HOME_TITLE,
  description: DEFAULT_HOME_DESCRIPTION,
  path: "/en",
  languages: {
    en: "/en",
    "x-default": "/",
    ko: "/ko",
  },
});

export default function EnHome() {
  return <HomeExperience locale="en" />;
}
