import { ImageResponse } from "next/og";

export function BrandMark({
  size,
  background = "linear-gradient(135deg, #7c3aed 0%, #9333ea 50%, #06b6d4 100%)",
  radius,
  border = true,
}: {
  size: number;
  background?: string;
  radius?: number;
  border?: boolean;
}) {
  const r = radius ?? Math.round(size * 0.24);
  const iconSize = Math.round(size * 0.58);

  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: r,
        background,
        border: border ? "1px solid rgba(255, 255, 255, 0.2)" : undefined,
      }}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        style={{ display: "flex" }}
      >
        {/* Headphone Arch & Contour */}
        <path
          d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Left earpiece pill */}
        <rect
          x="3.2"
          y="14.4"
          width="2.4"
          height="4.8"
          rx="1.2"
          fill="#ffffff"
        />
        {/* Right earpiece pill */}
        <rect
          x="18.4"
          y="14.4"
          width="2.4"
          height="4.8"
          rx="1.2"
          fill="#ffffff"
        />

        {/* Dynamic Center Equalizer Audio Bars */}
        <rect
          x="9.2"
          y="12.5"
          width="1.6"
          height="5.5"
          rx="0.8"
          fill="#ffffff"
        />
        <rect
          x="12"
          y="9.5"
          width="1.6"
          height="8.5"
          rx="0.8"
          fill="#ffffff"
        />
        <rect
          x="14.8"
          y="11.5"
          width="1.6"
          height="6.5"
          rx="0.8"
          fill="#ffffff"
        />
      </svg>
    </div>
  );
}

// Backward compatibility alias
export const NoteMark = BrandMark;

export function renderIcon(size: number, maskable = false) {
  if (!maskable) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BrandMark size={size} />
        </div>
      ),
      { width: size, height: size },
    );
  }

  const inner = Math.round(size * 0.72);
  const innerRadius = Math.round(size * 0.18);
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "#07080c",
        }}
      >
        <BrandMark size={inner} radius={innerRadius} />
      </div>
    ),
    { width: size, height: size },
  );
}
