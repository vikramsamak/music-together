import { ImageResponse } from "next/og";
import { NoteMark } from "@/lib/brand";

export const alt = "music-together — listen to YouTube together";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
          <span style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05 }}>
            Listen to YouTube together
          </span>
          <span style={{ fontSize: 40, color: "#a1a1aa" }}>
            Create a room, share the code, play in sync.
          </span>
        </div>
      </div>
    ),
    size,
  );
}
