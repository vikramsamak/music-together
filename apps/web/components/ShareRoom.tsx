"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useOrigin } from "@/lib/origin";
import { copyRoomUrl, roomUrl, shareRoom, type ShareResult } from "@/lib/share";

function statusMessage(result: ShareResult): string | null {
  if (result === "copied") return "Link copied";
  if (result === "failed") return "Couldn't copy — select the link above.";
  return null;
}

export default function ShareRoom({ roomId }: { roomId: string }) {
  const origin = useOrigin();
  const url = origin ? roomUrl(roomId, origin) : "";
  const [status, setStatus] = useState<string | null>(null);
  const sharedOrigin = origin || undefined;

  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">
        Share
      </summary>
      <div className="absolute right-0 z-20 mt-2 flex w-64 flex-col items-center gap-3 rounded border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
        {url ? (
          <QRCodeSVG
            value={url}
            size={180}
            bgColor="#ffffff"
            fgColor="#18181b"
            title={`Room ${roomId} QR code`}
          />
        ) : (
          <div className="h-[180px] w-[180px] animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
        )}
        <p className="w-full break-all text-center text-xs text-zinc-500">
          {url || roomId}
        </p>
        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={async () =>
              setStatus(statusMessage(await copyRoomUrl(roomId, sharedOrigin)))
            }
            className="flex-1 rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Copy link
          </button>
          <button
            type="button"
            onClick={async () =>
              setStatus(statusMessage(await shareRoom(roomId, sharedOrigin)))
            }
            className="flex-1 rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            Share…
          </button>
        </div>
        {status && <p className="text-xs text-zinc-500">{status}</p>}
      </div>
    </details>
  );
}
