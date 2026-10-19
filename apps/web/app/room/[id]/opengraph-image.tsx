import { ImageResponse } from "next/og";
import { NoteMark } from "@/lib/brand";

export const alt = "Join a music-together room";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const code = id.toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          justifyContent: "space-between",
          background: "#09090b",
          color: "#fafafa",
          padding: 80,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <NoteMark size={96} />
          <span style={{ fontSize: 48, fontWeight: 700 }}>music-together</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 48, color: "#a1a1aa" }}>Join room</span>
          <span
            style={{
              fontSize: 160,
              fontWeight: 800,
              letterSpacing: 12,
              lineHeight: 1,
            }}
          >
            {code}
          </span>
          <span style={{ fontSize: 40, color: "#a1a1aa" }}>
            Listen to YouTube together, in sync.
          </span>
        </div>
      </div>
    ),
    size,
  );
}
