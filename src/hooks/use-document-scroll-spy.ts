"use client";

import { useEffect, useMemo, useState } from "react";

export function useDocumentScrollSpy(sectionIds: string[]) {
  const sectionIdKey = sectionIds.join("|");
  const stableSectionIds = useMemo(
    () => (sectionIdKey ? sectionIdKey.split("|") : []),
    [sectionIdKey],
  );
  const [activeSectionId, setActiveSectionId] = useState(stableSectionIds[0] ?? "");

  useEffect(() => {
    const updateFromHash = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (!stableSectionIds.includes(hash)) return;

      setActiveSectionId(hash);
      document.getElementById(hash)?.scrollIntoView({ behavior: "auto", block: "start" });
    };

    updateFromHash();
    window.addEventListener("hashchange", updateFromHash);
    window.addEventListener("popstate", updateFromHash);
    return () => {
      window.removeEventListener("hashchange", updateFromHash);
      window.removeEventListener("popstate", updateFromHash);
    };
  }, [stableSectionIds]);

  useEffect(() => {
    const sections = stableSectionIds
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));

    let frameId: number | undefined;
    const updateActiveSection = () => {
      const marker = window.innerHeight * 0.25;
      const next =
        sections.filter((section) => section.getBoundingClientRect().top <= marker).at(-1) ?? sections[0];

      if (next) {
        setActiveSectionId((current) => (current === next.id ? current : next.id));
      }
    };

    const scheduleActiveSectionUpdate = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        frameId = undefined;
        updateActiveSection();
      });
    };

    const observer = new IntersectionObserver(
      scheduleActiveSectionUpdate,
      { rootMargin: "-18% 0px -65% 0px", threshold: [0, 0.01, 0.25] },
    );

    sections.forEach((section) => observer.observe(section));
    window.addEventListener("scroll", scheduleActiveSectionUpdate, { passive: true });
    window.addEventListener("resize", scheduleActiveSectionUpdate);
    updateActiveSection();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", scheduleActiveSectionUpdate);
      window.removeEventListener("resize", scheduleActiveSectionUpdate);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [stableSectionIds]);

  return { activeSectionId, setActiveSectionId };
}
