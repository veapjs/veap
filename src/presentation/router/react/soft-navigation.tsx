"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

export function SoftNavigationInterceptor({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Ignore clicks with modifiers
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) {
        return;
      }

      // Find the closest anchor tag
      let target = e.target as HTMLElement | null;
      while (target && target.tagName !== "A") {
        target = target.parentElement;
      }

      if (!target) return;

      const anchor = target as HTMLAnchorElement;
      const href = anchor.getAttribute("href");

      // Only intercept internal links
      if (
        href?.startsWith("/") &&
        !href.startsWith("//") &&
        anchor.target !== "_blank"
      ) {
        e.preventDefault();
        router.push(href);
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [router]);

  return <>{children}</>;
}
