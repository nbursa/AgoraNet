"use client";

import { useParams, useRouter } from "next/navigation";
import { useWebRTC } from "@/hooks/useWebRTC";

export default function RoomPage() {
  const { id } = useParams();
  const router = useRouter();
  const { stream, remoteStreams, leaveRoom } = useWebRTC(id as string);

  const handleLeave = () => {
    leaveRoom();
    router.push("/rooms");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Room {id}</h1>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">🔊 Local Audio</h2>
          <audio
            autoPlay
            controls
            ref={(audio) => {
              if (audio && stream) {
                audio.srcObject = stream;
              }
            }}
          />
        </div>

        {remoteStreams.map((entry) => (
          <div key={entry.id}>
            <h2 className="text-lg font-semibold">
              🎧 Remote Audio: {entry.id}
            </h2>
            <audio
              autoPlay
              controls
              ref={(audio) => {
                if (audio) {
                  audio.srcObject = entry.stream;
                }
              }}
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleLeave}
        className="mt-6 bg-red-500 text-white px-6 py-2 rounded-md hover:bg-red-600"
      >
        Leave Room
      </button>
    </div>
  );
}
