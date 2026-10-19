import { Suspense } from "react";
import RoomClient from "@/components/RoomClient";

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
