"use client";

import React, { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useWebRTC } from "@/hooks/useWebRTC";

export default function RoomPage() {
  const { id } = useParams();
  const router = useRouter();

  const {
    stream,
    remoteStreams,
    leaveRoom,
    participants,
    sendSharedMedia,
    sharedMediaUrl,
    sharedMediaType,
    localUserId,
  } = useWebRTC(id as string);

  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRefs = useRef<
    Record<string, React.MutableRefObject<HTMLAudioElement | null>>
  >({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (localAudioRef.current && stream) {
      localAudioRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    remoteStreams.forEach(({ id, stream }) => {
      if (!remoteAudioRefs.current[id]) {
        remoteAudioRefs.current[id] = React.createRef<HTMLAudioElement>();
      }

      const ref = remoteAudioRefs.current[id];
      if (ref.current) {
        ref.current.srcObject = stream;
      }
    });
  }, [remoteStreams]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (!result.startsWith("data:")) return;

      const ext = file.name.split(".").pop()?.toLowerCase();
      const mediaType = ext === "pdf" ? "pdf" : "image";
      sendSharedMedia(result, mediaType);
    };

    reader.readAsDataURL(file);
  };

  const handleClearMedia = () => {
    sendSharedMedia(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleLeaveRoom = () => {
    leaveRoom();
    router.push("/rooms");
  };

  return (
    <div className="flex flex-row h-screen w-full">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white p-4 border-r border-gray-700 overflow-y-auto min-h-screen">
        <h2 className="text-xl font-semibold mb-4">🧑‍🤝‍🧑 Participants</h2>
        <ul className="space-y-2 text-sm font-mono">
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
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col justify-center items-center p-6 min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Room {id}</h1>

        {/* Local Audio */}
        <div className="mb-6 text-center">
          <h2 className="text-lg font-semibold">🎙️ Your Microphone</h2>
          <audio autoPlay controls ref={localAudioRef} className="mt-2" />
        </div>

        {/* Upload */}
        <div className="mb-6 text-center">
          <h2 className="text-lg font-semibold">📤 Share Visual Document</h2>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            className="mt-2"
          />
        </div>

        {/* Preview */}
        {sharedMediaUrl && sharedMediaType && (
          <div className="mb-6 text-center relative">
            <h2 className="text-lg font-semibold">📎 Shared Preview</h2>
            <div className="relative inline-block">
              {sharedMediaType === "pdf" ? (
                <iframe
                  src={sharedMediaUrl}
                  width="640"
                  height="480"
                  className="border max-w-full max-h-96"
                />
              ) : (
                <Image
                  src={sharedMediaUrl}
                  alt="Shared"
                  width={640}
                  height={480}
                  unoptimized
                  className="w-auto h-auto max-w-full max-h-96 object-contain"
                />
              )}

              {/* Close */}
              {localUserId === participants[0] && (
                <button
                  onClick={handleClearMedia}
                  className="absolute top-2 right-2 bg-black bg-opacity-70 text-white px-3 py-1 rounded hover:bg-opacity-90"
                >
                  ✖ Close
                </button>
              )}

              {/* Download */}
              <a
                href={sharedMediaUrl}
                download={`shared-content.${
                  sharedMediaType === "pdf" ? "pdf" : "jpg"
                }`}
                className="absolute bottom-2 right-2 bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                ⬇ Download
              </a>
            </div>
          </div>
        )}

        {/* Remote Audios */}
        {remoteStreams.map((entry) => {
          if (!remoteAudioRefs.current[entry.id]) {
            remoteAudioRefs.current[entry.id] =
              React.createRef<HTMLAudioElement>();
          }

          return (
            <audio
              key={entry.id}
              autoPlay
              ref={remoteAudioRefs.current[entry.id]}
              className="hidden"
            />
          );
        })}

        {/* Leave */}
        <button
          onClick={handleLeaveRoom}
          className="mt-10 bg-red-600 text-white px-6 py-2 w-48 rounded-md hover:bg-red-700"
        >
          Leave Room
        </button>
      </main>
    </div>
  );
}
