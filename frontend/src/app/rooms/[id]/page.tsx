"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWebRTC } from "@/hooks/useWebRTC";

type RemoteStreamEntry = {
  id: string;
  stream: MediaStream;
};

type WebRTCResponse = {
  stream: MediaStream | null;
  remoteStreams: RemoteStreamEntry[];
  leaveRoom: () => void;
  participants: string[];
};

export default function RoomPage() {
  const { id } = useParams();
  const router = useRouter();

  const { stream, remoteStreams, leaveRoom, participants }: WebRTCResponse =
    useWebRTC(id as string);

  const [localUserId, setLocalUserId] = useState<string | null>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRefs = useRef<
    Record<string, React.RefObject<HTMLAudioElement>>
  >({});

  useEffect(() => {
    if (localAudioRef.current && stream) {
      localAudioRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    remoteStreams.forEach((entry) => {
      if (!remoteAudioRefs.current[entry.id]) {
        remoteAudioRefs.current[entry.id] =
          React.createRef() as React.RefObject<HTMLAudioElement>;
      }
      const ref = remoteAudioRefs.current[entry.id];
      if (ref?.current) {
        ref.current.srcObject = entry.stream;
      }
    });
  }, [remoteStreams]);

  useEffect(() => {
    const handleUserId = (e: CustomEvent<{ userId: string }>) => {
      if (e.detail?.userId) setLocalUserId(e.detail.userId);
    };

    window.addEventListener("plenum-user-id", handleUserId as EventListener);
    return () => {
      window.removeEventListener(
        "plenum-user-id",
        handleUserId as EventListener
      );
    };
  }, []);

  const handleLeave = () => {
    leaveRoom();
    router.push("/rooms");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`${window.location.origin}/rooms/${id}`);
  };

  return (
    <div className="flex flex-row h-screen w-full">
      <div className="w-64 bg-gray-900 text-white p-4 border-r border-gray-700 overflow-y-auto min-h-screen flex flex-col">
        <h2 className="text-xl font-semibold mb-4">🧑‍🤝‍🧑 Participants</h2>
        <ul className="space-y-2 text-sm font-mono flex-grow">
          {participants.map((uid) => (
            <li
              key={uid}
              className={uid === localUserId ? "text-green-400" : "text-white"}
            >
              {uid === localUserId ? `🟢 You (${uid})` : `🔉 ${uid}`}
            </li>
          ))}
        </ul>

        {localUserId && localUserId === participants[0] && (
          <button
            onClick={handleCopy}
            className="mt-auto w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 text-sm"
          >
            Copy Room Link
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center items-center p-6 min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Room {id}</h1>

        <div className="mb-6 text-center">
          <h2 className="text-lg font-semibold">🎙️ Your Microphone</h2>
          <audio autoPlay controls ref={localAudioRef} className="mt-2" />
        </div>

        {remoteStreams.map((entry) => (
          <audio
            key={entry.id}
            autoPlay
            ref={remoteAudioRefs.current[entry.id]}
            className="hidden"
          />
        ))}

        <button
          onClick={handleLeave}
          className="mt-10 bg-red-600 text-white px-6 py-2 w-48 rounded-md hover:bg-red-700"
        >
          Leave Room
        </button>
      </div>
    </div>
  );
}
