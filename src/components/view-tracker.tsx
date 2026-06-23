"use client";

import { useEffect } from "react";

export function ViewTracker({
  id,
  type,
}: {
  id: string;
  type: "product" | "company";
}) {
  useEffect(() => {
    const key = `bridgemarket:view:${type}:${id}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    void fetch("/api/public/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type }),
    });
  }, [id, type]);
  return null;
}
