import { renderIcon } from "@/lib/brand";

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const requested = Number(params.get("size") ?? 512);
  const size = Math.min(1024, Math.max(48, Math.round(Number.isFinite(requested) ? requested : 512)));
  return renderIcon(size, params.get("maskable") === "1");
}
