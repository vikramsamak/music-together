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
      fallback={<div className="p-8 text-zinc-500">Loading room...</div>}
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
