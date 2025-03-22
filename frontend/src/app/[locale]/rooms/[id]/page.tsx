"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useTranslations } from "next-intl";

export default function RoomPage() {
  const t = useTranslations("room");
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
    createVote,
    vote,
    activeVote,
    currentVotes,
    hostId,
    speakingUsers,
    sendSpeakingStatus,
  } = useWebRTC(id as string);

  const remoteAudioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(true);

  const analyserRefs = useRef<Record<string, AnalyserNode>>({});
  const audioContextRef = useRef<AudioContext | null>(null);

  const setupSpeakingDetection = useCallback(
    (userId: string, mediaStream: MediaStream) => {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const audioContext = audioContextRef.current;
      const source = audioContext.createMediaStreamSource(mediaStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      source.connect(analyser);
      analyserRefs.current[userId] = analyser;

      const detect = () => {
        analyser.getByteFrequencyData(dataArray);
        const volume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const isSpeaking = volume > 20;

        if (userId === localUserId) {
          sendSpeakingStatus(isSpeaking);
        }

        requestAnimationFrame(detect);
      };

      detect();
    },
    [localUserId, sendSpeakingStatus]
  );

  useEffect(() => {
    if (stream && localUserId) {
      const track = stream.getAudioTracks()[0];
      if (track) track.enabled = false;
      setupSpeakingDetection(localUserId, stream);
    }
  }, [stream, localUserId, setupSpeakingDetection]);

  useEffect(() => {
    remoteStreams.forEach(({ id, stream }) => {
      let audioEl = remoteAudioRefs.current[id];
      if (!audioEl) {
        audioEl = document.createElement("audio");
        audioEl.autoplay = true;
        audioEl.setAttribute("playsinline", "true");
        audioEl.className = "hidden";
        document.body.appendChild(audioEl);
        remoteAudioRefs.current[id] = audioEl;
      }
      if (stream && audioEl.srcObject !== stream) {
        audioEl.srcObject = stream;
        audioEl.onloadedmetadata = () => {
          audioEl.play().catch(console.error);
        };
        setupSpeakingDetection(id, stream);
      }
    });
  }, [remoteStreams, setupSpeakingDetection]);

  useEffect(() => {
    if (!activeVote) setHasVoted(false);
  }, [activeVote]);

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
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleLeaveRoom = () => {
    leaveRoom();
    router.push("/rooms");
  };

  const triggerFileSelect = () => fileInputRef.current?.click();

  const handleCopyRoomUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleVote = (val: "yes" | "no") => {
    vote(val);
    setHasVoted(true);
  };

  const toggleMic = () => {
    const audioTrack = stream?.getAudioTracks()[0];
    if (audioTrack) {
      const enabled = !audioTrack.enabled;
      audioTrack.enabled = enabled;
      setIsMicMuted(!enabled);
    }
  };

  if (!localUserId) {
    return (
      <div className="flex items-center justify-center w-full h-full text-white bg-black">
        <span className="animate-pulse text-lg">{t("loading")}...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-row w-full h-full overflow-hidden">
      <aside className="w-64 h-full bg-gray-900 text-white p-4 border-r border-gray-700 flex flex-col">
        <button
          onClick={handleCopyRoomUrl}
          className="mb-4 w-full bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-sm"
        >
          {copied ? t("copied") : t("copy")}
        </button>
        <div className="flex-1 overflow-y-auto pr-1">
          <ul className="space-y-2 text-sm font-mono">
            {participants.map((uid) => (
              <li
                key={uid}
                className={`flex items-center gap-2 ${
                  uid === localUserId ? "text-green-400" : "text-white"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    speakingUsers.has(uid)
                      ? "bg-green-500 animate-ping"
                      : "bg-gray-600"
                  }`}
                />
                {uid === localUserId
                  ? uid === hostId
                    ? `${t("you")} (${t("host")})`
                    : `${t("you")} (${t("guest")})`
                  : uid === hostId
                  ? `${t("host")} (${uid})`
                  : `${t("guest")} (${uid})`}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center justify-start min-h-full py-10 px-6 gap-6">
          <h1 className="text-2xl font-bold">
            {t("room")} {id}
          </h1>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 w-full max-w-3xl">
            <button
              onClick={toggleMic}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded text-sm"
            >
              {isMicMuted ? `🔇 ${t("mic-off")}` : `🎤 ${t("mic-on")}`}
            </button>

            <button
              onClick={triggerFileSelect}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
            >
              📁 {t("choose")}
            </button>

            {localUserId === hostId && !activeVote && (
              <button
                onClick={() => createVote("yes-no")}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm col-span-2 sm:col-span-1"
              >
                {t("vote.start")}
              </button>
            )}

            <button
              onClick={handleLeaveRoom}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm"
            >
              {t("leave")}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            className="hidden"
          />

          {sharedMediaUrl && sharedMediaType && (
            <div className="relative mt-6 max-w-3xl w-full text-center">
              <h2 className="text-lg font-semibold mb-2">{t("preview")}</h2>
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
                {localUserId === hostId && (
                  <button
                    onClick={handleClearMedia}
                    className="absolute top-2 right-2 bg-black bg-opacity-70 text-white px-3 py-1 rounded hover:bg-opacity-90"
                  >
                    ✖ {t("close")}
                  </button>
                )}
                <a
                  href={sharedMediaUrl}
                  download={`shared-content.${
                    sharedMediaType === "pdf" ? "pdf" : "jpg"
                  }`}
                  className="absolute bottom-2 right-2 bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                >
                  ⬇ {t("download")}
                </a>
              </div>
            </div>
          )}

          {activeVote && (
            <div className="w-full max-w-md text-center mt-8">
              <h2 className="text-xl font-semibold mb-4">
                🗳️ {t("vote.title")}
              </h2>
              {!hasVoted && (
                <div className="flex justify-center gap-4 mb-4">
                  <button
                    onClick={() => handleVote("yes")}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    👍 {t("vote.yes")}
                  </button>
                  <button
                    onClick={() => handleVote("no")}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                  >
                    👎 {t("vote.no")}
                  </button>
                </div>
              )}
              <div className="text-sm text-gray-300">
                ✅ {t("vote.yes")}:{" "}
                {Object.values(currentVotes).filter((v) => v === "yes").length}{" "}
                | ❌ {t("vote.no")}:{" "}
                {Object.values(currentVotes).filter((v) => v === "no").length}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
