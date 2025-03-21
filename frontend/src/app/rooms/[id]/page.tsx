"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useWebRTC } from "@/hooks/useWebRTC";

export default function RoomPage() {
  const { id } = useParams();
  const router = useRouter();

  const {
    stream,
    remoteStreams,
    leaveRoom,
    participants,
    sendSharedImage,
    sharedImageUrl,
    localUserId,
  } = useWebRTC(id as string);

  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRefs = useRef<
    Record<string, React.RefObject<HTMLAudioElement | null>>
  >({});

  // Ensure local audio plays correctly
  useEffect(() => {
    if (localAudioRef.current && stream) {
      localAudioRef.current.srcObject = stream;
    }
  }, [stream]);

  // Ensure remote audio plays correctly
  useEffect(() => {
    remoteStreams.forEach((entry) => {
      if (!remoteAudioRefs.current[entry.id]) {
        remoteAudioRefs.current[entry.id] = React.createRef();
      }
      const ref = remoteAudioRefs.current[entry.id];
      if (ref?.current) {
        ref.current.srcObject = entry.stream;
      }
    });
  }, [remoteStreams]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      if (reader.result) {
        sendSharedImage(reader.result as string);
      }
    };
  };

  const handleLeaveRoom = () => {
    leaveRoom();
    router.push("/rooms");
  };

  return (
    <div className="flex flex-row h-screen w-full">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white p-4 border-r border-gray-700 overflow-y-auto min-h-screen flex flex-col">
        <h2 className="text-xl font-semibold mb-4">🧑‍🤝‍🧑 Participants</h2>
        <ul className="space-y-2 text-sm font-mono flex-grow">
          {participants.map((uid, index) => (
            <li
              key={uid}
              className={uid === localUserId ? "text-green-400" : "text-white"}
            >
              {uid === localUserId
                ? `🟢 You (${uid})`
                : index === 0
                ? `👑 Host (${uid})`
                : `🔉 Guest (${uid})`}
            </li>
          ))}
        </ul>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Room {id}</h1>

        {/* Local Audio */}
        <div className="mb-6 text-center">
          <h2 className="text-lg font-semibold">🎙️ Your Microphone</h2>
          <audio autoPlay controls ref={localAudioRef} className="mt-2" />
        </div>

        {/* File Upload */}
        <div className="mb-6 text-center">
          <h2 className="text-lg font-semibold">📤 Share Image</h2>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="mt-2"
          />
        </div>

        {/* Shared Image Preview */}
        {sharedImageUrl && (
          <div className="mb-6 text-center">
            <h2 className="text-lg font-semibold">🖼️ Shared Image</h2>
            <Image
              src={sharedImageUrl}
              alt="Shared content"
              width={640}
              height={480}
              unoptimized
              className="w-auto h-auto max-w-full max-h-96 object-contain"
              onError={(e) => {
                console.error("Image failed to load:", e);
              }}
            />
          </div>
        )}

        {/* Hidden Remote Audio Players */}
        {remoteStreams.map((entry) => (
          <audio
            key={entry.id}
            autoPlay
            ref={remoteAudioRefs.current[entry.id]}
            className="hidden"
          />
        ))}

        <button
          onClick={handleLeaveRoom}
          className="mt-10 bg-red-600 text-white px-6 py-2 w-48 rounded-md hover:bg-red-700"
        >
          Leave Room
        </button>
      </div>
    </div>
  );
}
