"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, QrCode, Share2, X } from "lucide-react";
import { useOrigin } from "@/lib/origin";
import { copyRoomUrl, roomUrl, shareRoom, type ShareResult } from "@/lib/share";

function statusMessage(result: ShareResult): string | null {
  if (result === "copied") return "Link copied to clipboard!";
  if (result === "failed") return "Couldn't copy — select the link below.";
  return null;
}

export default function ShareRoom({ roomId }: { roomId: string }) {
  const origin = useOrigin();
  const url = origin ? roomUrl(roomId, origin) : "";
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const sharedOrigin = origin || undefined;

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleCopy = async () => {
    const res = await copyRoomUrl(roomId, sharedOrigin);
    setStatus(statusMessage(res));
    if (res === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    const res = await shareRoom(roomId, sharedOrigin);
    setStatus(statusMessage(res));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-all hover:bg-white/10 hover:border-violet-500/30 hover:text-white"
        title="Share room"
      >
        <Share2 className="h-3.5 w-3.5 text-violet-400" />
        <span>Share</span>
      </button>

      {open && (
        <div
          ref={modalRef}
          className="absolute right-0 top-full z-50 mt-3 w-72 rounded-2xl border border-white/10 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-2xl transition-all"
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-1.5">
              <QrCode className="h-4 w-4 text-violet-400" />
              <span className="text-sm font-semibold text-zinc-100">
                Invite Friends
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-3 pt-4">
            <div className="rounded-xl border border-white/10 bg-white p-3 shadow-inner">
              {url ? (
                <QRCodeSVG
                  value={url}
                  size={150}
                  bgColor="#ffffff"
                  fgColor="#09090b"
                  level="M"
                  title={`Room ${roomId} QR code`}
                />
              ) : (
                <div className="h-[150px] w-[150px] animate-pulse rounded-lg bg-zinc-800" />
              )}
            </div>

            <div className="w-full text-center">
              <span className="text-[10px] uppercase tracking-widest text-zinc-400">
                Room Code
              </span>
              <p className="font-mono text-xl font-bold tracking-widest text-violet-400">
                {roomId}
              </p>
            </div>

            <p className="w-full break-all rounded-lg bg-black/40 px-2 py-1.5 text-center font-mono text-[11px] text-zinc-400 border border-white/5">
              {url || roomId}
            </p>

            <div className="flex w-full gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-600/25 transition-all hover:bg-violet-500 active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 transition-all hover:bg-white/10 hover:text-white active:scale-95"
                title="Open native share menu"
              >
                <Share2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {status && (
              <p className="text-center text-xs text-zinc-400 animate-fade-in">
                {status}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
