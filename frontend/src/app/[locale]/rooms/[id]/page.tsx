"use client";

import React, { useEffect, useRef, useState } from "react";
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
  } = useWebRTC(id as string);

  const remoteAudioRefs = useRef<
    Record<string, React.RefObject<HTMLAudioElement | null>>
  >({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());

  // Audio analysis map
  const analyserRefs = useRef<Record<string, AnalyserNode>>({});
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (stream && localUserId) {
      const track = stream.getAudioTracks()[0];
      if (track) track.enabled = false;
      setupSpeakingDetection(localUserId, stream);
    }
  }, [stream, localUserId]);

  useEffect(() => {
    remoteStreams.forEach(({ id, stream }) => {
      if (!remoteAudioRefs.current[id]) {
        remoteAudioRefs.current[id] = React.createRef<HTMLAudioElement>();
      }
      const ref = remoteAudioRefs.current[id];
      if (ref.current) {
        ref.current.srcObject = stream;
        setupSpeakingDetection(id, stream);
      }
    });
  }, [remoteStreams]);

  useEffect(() => {
    if (!activeVote) setHasVoted(false);
  }, [activeVote]);

  const setupSpeakingDetection = (userId: string, mediaStream: MediaStream) => {
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

      setSpeakingUsers((prev) => {
        const updated = new Set(prev);
        if (volume > 30) {
          updated.add(userId);
        } else {
          updated.delete(userId);
        }
        return new Set(updated);
      });

      requestAnimationFrame(detect);
    };

    detect();
  };

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

  const toggleMute = () => {
    const audioTrack = stream?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
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
            {localUserId &&
              participants.map((uid) => (
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
        <div className="flex flex-col items-center justify-center min-h-full py-10 px-6">
          <h1 className="text-2xl font-bold mb-6">
            {t("room")} {id}
          </h1>

          <div className="mb-6 text-center">
            <h2 className="text-lg font-semibold">{t("mic")}</h2>
            <button
              onClick={toggleMute}
              className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 mt-2"
            >
              {isMuted ? `🔇 ${t("unmute")}` : `🎤 ${t("mute")}`}
            </button>
          </div>

          <div className="mb-6 text-center">
            <h2 className="text-lg font-semibold mb-2">{t("share")}</h2>
            <button
              onClick={triggerFileSelect}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              📁 {t("choose")}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {sharedMediaUrl && sharedMediaType && (
            <div className="mb-6 text-center relative">
              <h2 className="text-lg font-semibold">{t("preview")}</h2>
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

          <div className="mb-8 w-full max-w-md text-center">
            <h2 className="text-xl font-semibold mb-2">🗳️ {t("vote.title")}</h2>
            {localUserId && hostId && localUserId === hostId && !activeVote && (
              <button
                onClick={() => createVote("yes-no")}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                {t("vote.start")}
              </button>
            )}

            {activeVote && (
              <div className="mt-4 space-y-4">
                {!hasVoted && (
                  <div className="flex justify-center gap-4">
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
                  {
                    Object.values(currentVotes).filter((v) => v === "yes")
                      .length
                  }{" "}
                  | ❌ {t("vote.no")}:{" "}
                  {Object.values(currentVotes).filter((v) => v === "no").length}
                </div>
              </div>
            )}
          </div>

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

          <button
            onClick={handleLeaveRoom}
            className="mt-10 bg-red-600 text-white px-6 py-2 w-48 rounded-md hover:bg-red-700"
          >
            {t("leave")}
          </button>
        </div>
      </main>
    </div>
  );
}
