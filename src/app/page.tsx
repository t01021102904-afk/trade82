import type { Metadata } from "next";

import { HomeExperience } from "@/components/home-experience";
import {
  DEFAULT_HOME_DESCRIPTION,
  DEFAULT_HOME_TITLE,
  publicPageMetadata,
} from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: DEFAULT_HOME_TITLE,
  description: DEFAULT_HOME_DESCRIPTION,
  path: "/",
  languages: {
    en: "/",
    "x-default": "/",
    ko: "/ko",
  },
});

export default function Home() {
  return <HomeExperience locale="en" />;
}
