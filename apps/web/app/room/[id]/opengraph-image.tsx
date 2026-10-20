import { ImageResponse } from "next/og";
import { BrandMark } from "@/lib/brand";

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
          position: "relative",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          justifyContent: "space-between",
          background: "#07080c",
          color: "#ffffff",
          padding: 72,
          overflow: "hidden",
        }}
      >
        {/* Ambient background glows */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: -120,
            left: 200,
            width: 700,
            height: 400,
            borderRadius: 350,
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0) 70%)",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: -100,
            right: 100,
            width: 600,
            height: 400,
            borderRadius: 300,
            background: "radial-gradient(circle, rgba(6, 182, 212, 0.25) 0%, rgba(6, 182, 212, 0) 70%)",
          }}
        />

        {/* Top Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <BrandMark size={72} />
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 36, fontWeight: 800 }}>music-together</span>
              <span style={{ fontSize: 18, color: "#a1a1aa", fontWeight: 600 }}>
                Realtime Audio Studio
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 20px",
              borderRadius: 999,
              border: "1px solid rgba(139, 92, 246, 0.3)",
              background: "rgba(139, 92, 246, 0.15)",
              color: "#c084fc",
              fontSize: 18,
              fontWeight: 600,
            }}
          >
            <span>Listening Room</span>
          </div>
        </div>

        {/* Center Room Code Display Card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: "40px 60px",
            borderRadius: 32,
            border: "1px solid rgba(255, 255, 255, 0.12)",
            background: "rgba(18, 20, 29, 0.85)",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)",
          }}
        >
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 3,
              color: "#a1a1aa",
              textTransform: "uppercase",
            }}
          >
            You are invited to join room
          </span>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "12px 48px",
              borderRadius: 20,
              border: "1px solid rgba(139, 92, 246, 0.4)",
              background: "linear-gradient(180deg, rgba(139, 92, 246, 0.2) 0%, rgba(6, 182, 212, 0.1) 100%)",
            }}
          >
            <span
              style={{
                fontSize: 110,
                fontWeight: 900,
                letterSpacing: 16,
                color: "#ffffff",
                lineHeight: 1,
              }}
            >
              {code}
            </span>
          </div>

          <span style={{ fontSize: 26, color: "#d4d4d8", fontWeight: 500 }}>
            Listen to YouTube together in sync · Live Queue & Chat
          </span>
        </div>

        {/* Bottom Status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            color: "#71717a",
            fontSize: 18,
            fontWeight: 500,
          }}
        >
          <span>Free · No login required · Works on mobile & desktop</span>
          <span>music-together</span>
        </div>
      </div>
    ),
    size,
  );
}
