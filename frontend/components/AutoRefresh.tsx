"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();
  const countRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function startPolling() {
      if (timerRef.current) return; // already running
      timerRef.current = setInterval(() => {
        countRef.current += 1;
        router.refresh();
        if (countRef.current >= 3) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
        }
      }, intervalMs);
    }

    window.addEventListener("rider-photo-needed", startPolling);
    return () => {
      window.removeEventListener("rider-photo-needed", startPolling);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [router, intervalMs]);

  return null;
}
