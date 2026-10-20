import { ImageResponse } from "next/og";
import { BrandMark } from "@/lib/brand";

export const alt = "music-together — sync your sound, listen together in real time";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
            top: -100,
            left: 250,
            width: 700,
            height: 400,
            borderRadius: 350,
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.28) 0%, rgba(139, 92, 246, 0) 70%)",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: -100,
            right: -50,
            width: 600,
            height: 400,
            borderRadius: 300,
            background: "radial-gradient(circle, rgba(6, 182, 212, 0.22) 0%, rgba(6, 182, 212, 0) 70%)",
          }}
        />

        {/* Top Header Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <BrandMark size={80} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: -0.5 }}>
                music-together
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    display: "flex",
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    background: "#34d399",
                  }}
                />
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: "#a1a1aa",
                    letterSpacing: 0.5,
                  }}
                >
                  Realtime Audio Studio
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 24px",
              borderRadius: 999,
              border: "1px solid rgba(255, 255, 255, 0.12)",
              background: "rgba(255, 255, 255, 0.05)",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 4,
                alignItems: "flex-end",
                height: 18,
              }}
            >
              <div style={{ width: 4, height: 8, background: "#8b5cf6", borderRadius: 2 }} />
              <div style={{ width: 4, height: 18, background: "#ec4899", borderRadius: 2 }} />
              <div style={{ width: 4, height: 12, background: "#06b6d4", borderRadius: 2 }} />
              <div style={{ width: 4, height: 16, background: "#8b5cf6", borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 18, fontWeight: 600, color: "#e4e4e7" }}>
              Sync v2 Online
            </span>
          </div>
        </div>

        {/* Main Hero Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: -1,
            }}
          >
            <span>Sync your sound.</span>
            <span
              style={{
                color: "#c084fc",
              }}
            >
              Listen together in real time.
            </span>
          </div>
          <span style={{ fontSize: 32, color: "#a1a1aa", maxWidth: 960 }}>
            Shared YouTube listening rooms in frame-perfect sync with live queue and chat.
          </span>
        </div>

        {/* Bottom Feature Badges */}
        <div style={{ display: "flex", gap: 16 }}>
          {[
            "⚡ Frame-Perfect Sync",
            "🎶 Shared Live Queue",
            "💬 Synchronized Chat",
            "🎧 Free & No Account Needed",
          ].map((text) => (
            <div
              key={text}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 22px",
                borderRadius: 16,
                border: "1px solid rgba(255, 255, 255, 0.08)",
                background: "rgba(18, 20, 29, 0.75)",
                fontSize: 20,
                fontWeight: 600,
                color: "#d4d4d8",
              }}
            >
              {text}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
