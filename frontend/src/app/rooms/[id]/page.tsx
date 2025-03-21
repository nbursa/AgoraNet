"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWebRTC } from "@/hooks/useWebRTC";

export default function RoomPage() {
  const { id } = useParams();
  const router = useRouter();
  const { stream, remoteStreams, leaveRoom } = useWebRTC(id as string);

  const [localUserId, setLocalUserId] = useState<string | null>(null);

  const localAudioRef = useRef<HTMLAudioElement | null>(null);

  // Ref to store remote audio elements dynamically
  const remoteAudioRefs = useRef<{ [id: string]: HTMLAudioElement | null }>({});

  // Set local audio stream
  useEffect(() => {
    if (localAudioRef.current && stream) {
      localAudioRef.current.srcObject = stream;
    }
  }, [stream]);

  // Set remote audio streams for each peer
  useEffect(() => {
    remoteStreams.forEach((entry) => {
      const ref = remoteAudioRefs.current[entry.id];
      if (ref && entry.stream) {
        ref.srcObject = entry.stream; // Assign the stream to the audio element
      }
    });
  }, [remoteStreams]);

  // Listen for local user ID
  useEffect(() => {
    const handleUserId = (e: CustomEvent<{ userId: string }>) => {
      if (e.detail?.userId) setLocalUserId(e.detail.userId);
    };

    window.addEventListener("plenum-user-id", handleUserId as EventListener);

    return () =>
      window.removeEventListener(
        "plenum-user-id",
        handleUserId as EventListener
      );
  }, []);

  const handleLeave = () => {
    leaveRoom();
    router.push("/rooms");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <h1 className="text-2xl font-bold mb-2">Room {id}</h1>

      <div className="space-y-6 w-full max-w-xl">
        <div>
          <h2 className="text-lg font-semibold">🔊 Local Audio</h2>
          {localUserId && (
            <p className="text-xs text-gray-400 mb-1 font-mono">
              ID: {localUserId}
            </p>
          )}
          <audio autoPlay controls ref={localAudioRef} className="w-full" />
        </div>

        {remoteStreams.map((entry) => (
          <div key={entry.id}>
            <h2 className="text-lg font-semibold">🎧 Remote Audio</h2>
            <p className="text-xs text-gray-400 mb-1 font-mono">
              ID: {entry.id}
            </p>
            <audio
              autoPlay
              controls
              ref={(el) => {
                if (el) remoteAudioRefs.current[entry.id] = el; // Assign remote audio element ref
              }}
              className="w-full"
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
