"use client";

import { useParams, useRouter } from "next/navigation";
import { useWebRTC } from "@/hooks/useWebRTC";

export default function RoomPage() {
  const { id } = useParams();
  const { stream, peers, leaveRoom } = useWebRTC(id as string);
  const router = useRouter();

  const handleLeave = () => {
    leaveRoom();
    router.push("/rooms");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold">Room {id}</h1>
      <audio
        autoPlay
        controls
        ref={(audio) => {
          if (audio && stream) audio.srcObject = stream;
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
                peer
                  .getReceivers()
                  .forEach((receiver) => remoteStream.addTrack(receiver.track));
                audio.srcObject = remoteStream;
              }
            }}
          />
        ))}
      </div>

      <button
        onClick={handleLeave}
        className="mt-6 bg-red-500 text-white px-6 py-2 rounded-md hover:bg-red-600 hover:cursor-pointer"
      >
        Leave Room
      </button>
    </div>
  );
}
