import type { Metadata } from "next";
import { Suspense } from "react";
import RoomClient from "@/components/RoomClient";

export async function generateMetadata(
  props: PageProps<"/room/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const code = id.toUpperCase();
  return {
    title: `Join room ${code}`,
    description: `Join room ${code} and listen to YouTube together in sync.`,
    openGraph: {
      title: `Join room ${code}`,
      description: "Listen to YouTube together, in sync.",
      url: `/room/${code}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Join room ${code}`,
    },
  };
}

export default function RoomPage(props: PageProps<"/room/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex flex-col items-center justify-center bg-[#07080c] text-zinc-400 gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
          <span className="text-xs font-mono tracking-wider uppercase">Loading room...</span>
        </div>
      }
    >
      <RoomContent params={props.params} />
    </Suspense>
  );
}

async function RoomContent({
  params,
}: {
  params: PageProps<"/room/[id]">["params"];
}) {
  const { id } = await params;
  return <RoomClient roomId={id.toUpperCase()} />;
}
