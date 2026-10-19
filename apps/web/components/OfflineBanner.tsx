"use client";

import { useOffline } from "next/offline";

export default function OfflineBanner() {
  const isOffline = useOffline();

  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="bg-amber-500 px-4 py-1 text-center text-sm font-medium text-amber-950"
    >
      You&apos;re offline — reconnecting when the connection returns.
    </div>
  );
}
