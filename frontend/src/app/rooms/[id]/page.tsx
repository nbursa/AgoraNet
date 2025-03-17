"use client";

import { useParams } from "next/navigation";
import { useWebRTC } from "@/hooks/useWebRTC";

export default function RoomPage() {
  const { id } = useParams();
  const { stream, peers } = useWebRTC(id as string);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold">Room {id}</h1>
      <audio
        autoPlay
        controls
        ref={(audio) => {
          if (audio && stream) {
            audio.srcObject = stream;
          }
        }}
      />

      <div className="mt-4">
        {Object.values(peers).map((peer, i) => (
          <audio
            key={i}
            autoPlay
            controls
            ref={(audio) => {
              if (audio) {
                const remoteStream = new MediaStream();
                peer.getReceivers().forEach((receiver) => {
                  if (receiver.track) remoteStream.addTrack(receiver.track);
                });
                audio.srcObject = remoteStream;
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}
