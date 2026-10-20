"use client";

interface AudioVisualizerProps {
  playing?: boolean;
  size?: "sm" | "md" | "lg";
  barCount?: number;
}

export default function AudioVisualizer({
  playing = false,
  size = "md",
  barCount = 4,
}: AudioVisualizerProps) {
  const heights = [
    "animate-eq-1",
    "animate-eq-2",
    "animate-eq-3",
    "animate-eq-4",
    "animate-eq-2",
  ];

  const baseWidth = size === "sm" ? "w-0.5" : size === "lg" ? "w-1.5" : "w-1";
  const containerHeight =
    size === "sm" ? "h-3" : size === "lg" ? "h-6" : "h-4";

  return (
    <div
      className={`inline-flex items-end gap-0.5 ${containerHeight}`}
      aria-label={playing ? "Playing audio" : "Paused audio"}
    >
      {Array.from({ length: barCount }).map((_, i) => (
        <span
          key={i}
          className={`${baseWidth} rounded-full bg-gradient-to-t from-violet-500 to-cyan-400 transition-all duration-300 ${
            playing ? heights[i % heights.length] : "h-1 opacity-40"
          }`}
        />
      ))}
    </div>
  );
}
