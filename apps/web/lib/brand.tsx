import { ImageResponse } from "next/og";

export function NoteMark({
  size,
  background = "#8b5cf6",
  note = "#ffffff",
  radius,
}: {
  size: number;
  background?: string;
  note?: string;
  radius?: number;
}) {
  const r = radius ?? Math.round(size * 0.24);
  const head = Math.round(size * 0.34);
  const stemW = Math.round(size * 0.075);
  const stemH = Math.round(size * 0.5);
  const left = Math.round(size * 0.3);
  const bottom = Math.round(size * 0.22);
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: size,
        height: size,
        borderRadius: r,
        background,
      }}
    >
      <div
        style={{
          display: "flex",
          position: "absolute",
          left,
          bottom,
          width: head,
          height: head,
          borderRadius: head / 2,
          background: note,
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: left + head - stemW,
          bottom: bottom + Math.round(head / 2),
          width: stemW,
          height: stemH,
          background: note,
        }}
      />
    </div>
  );
}

export function renderIcon(size: number, maskable = false) {
  if (!maskable) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%" }}>
          <NoteMark size={size} />
        </div>
      ),
      { width: size, height: size },
    );
  }

  const inner = Math.round(size * 0.62);
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
        }}
      >
        <NoteMark size={inner} />
      </div>
    ),
    { width: size, height: size },
  );
}
