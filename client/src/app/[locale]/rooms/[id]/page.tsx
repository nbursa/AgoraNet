"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { VolumeMeter } from "@/components/VolumeMeter";
import { SpeakingAnalyzer } from "@/components/SpeakingAnalyzer";
import { VoteResult, useWebRTC } from "@/hooks/useWebRTC";

type LegacyVoteResult = VoteResult & {
  yesCount?: number;
  noCount?: number;
  totalVotes?: number;
};

export default function RoomPage() {
  const t = useTranslations("room");
  const { id } = useParams();
  const [hydrated, setHydrated] = useState(false);

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
    endVote,
    hostId,
    speakingUsers,
    setSpeakingUsers,
    sendSpeakingStatus,
    voteHistory,
  } = useWebRTC(id as string);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const normalizedVoteHistory = (voteHistory as LegacyVoteResult[]).map(
    (v) => ({
      question: v.question,
      yes: v.yes ?? v.yesCount ?? 0,
      no: v.no ?? v.noCount ?? 0,
      total: v.total ?? v.totalVotes ?? 0,
    })
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(true);
  const [voteQuestion, setVoteQuestion] = useState("");
  const [hasVoted, setHasVoted] = useState(false);
  const [showLastVote, setShowLastVote] = useState(false);
  const [showVoteHistory, setShowVoteHistory] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const prevVoteRef = useRef<string | null>(null);
  const analyserRefs = useRef<Record<string, AnalyserNode>>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    document.title = `${t("title")} - ${id}`;
  }, [id, t]);

  useEffect(() => {
    if (stream && streamAudio.current) {
      streamAudio.current.srcObject = stream;
      streamAudio.current
        .play()
        .then(() => {
          streamAudio.current!.muted = true;
          streamAudio.current!.volume = 1.0;
          console.log("▶️ Local stream audio playing");
        })
        .catch((err) => {
          console.error("❌ Local stream audio playback failed:", err);
        });
    }
  }, [stream]);

  useEffect(() => {
    if (typeof window !== "undefined" && stream && localUserId) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = false;
        setIsMicMuted(true);
      }
    }
  }, [stream, localUserId]);

  useEffect(() => {
    remoteStreams.forEach(({ id }) => {
      if (!analyserRefs.current[id]) {
        console.log("🔁 Force setting up analyser for", id);
      }
    });
  }, [remoteStreams]);

  useEffect(() => {
    const unlockAudio = () => {
      audioContextRef.current?.resume().catch(console.error);

      if (streamAudio.current?.paused) {
        streamAudio.current.play().catch(console.error);
      }
      window.removeEventListener("click", unlockAudio);
    };

    window.addEventListener("click", unlockAudio);
    return () => window.removeEventListener("click", unlockAudio);
  }, [id]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { userId } = (e as CustomEvent).detail;
      if (userId) {
        setSpeakingUsers((prev) => new Set(prev).add(userId));
        setTimeout(() => {
          setSpeakingUsers((prev) => {
            const updated = new Set(prev);
            updated.delete(userId);
            return updated;
          });
        }, 500);
      }
    };
    window.addEventListener("remote-speaking", handler);
    return () => window.removeEventListener("remote-speaking", handler);
  }, [setSpeakingUsers]);

  useEffect(() => {
    if (prevVoteRef.current && !activeVote) {
      setHasVoted(false);
      setShowLastVote(true);
    }
    prevVoteRef.current = activeVote;
  }, [activeVote]);

  useEffect(() => {
    if (localUserId && currentVotes[localUserId]) {
      setHasVoted(true);
    }
  }, [currentVotes, localUserId]);

  useEffect(() => {
    if (remoteStreams.length === 0) {
      console.warn("🚨 remoteStreams reset detected!");
    }
  }, [remoteStreams]);

  if (!hydrated) return null;

  const toggleMobileSidebar = () => setIsMobileSidebarOpen((prev) => !prev);

  const handleCreateVote = () => {
    if (!activeVote && voteQuestion.trim()) {
      createVote(voteQuestion.trim());
      setVoteQuestion("");
    }
  };

  const handleClearMedia = () => {
    sendSharedMedia(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleVote = (val: "yes" | "no") => {
    vote(val);
    setHasVoted(true);
  };

  const toggleMic = () => {
    const audioTrack = stream?.getAudioTracks()[0];
    if (audioTrack && localUserId && stream) {
      const enabled = !audioTrack.enabled;
      audioTrack.enabled = enabled;
      setIsMicMuted(!enabled);
    }
  };

  const triggerFileSelect = () => fileInputRef.current?.click();

  const handleCopyRoomUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleEndVote = () => {
    endVote();
  };

  const lastVote = normalizedVoteHistory[normalizedVoteHistory.length - 1];
  const showVoteSummary =
    showLastVote && localUserId === hostId && lastVote !== undefined;

  console.log("📡 remoteStreams", remoteStreams);

  return (
    <div className="flex flex-col sm:flex-row w-full h-full overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`bg-gray-900 text-white flex flex-col transition-all duration-300
    sm:h-full sm:w-64 w-full
    ${isMobileSidebarOpen ? "h-auto overflow-y-auto" : "h-auto"}`}
      >
        <div className="p-2 border-b border-gray-700 flex gap-2 flex-row sm:items-center sm:justify-start">
          <div className="flex w-full sm:w-full gap-2">
            <Button
              onClick={handleCopyRoomUrl}
              className="w-1/2 flex-1 text-sm sm:w-full font-bold sm:font-normal"
              variant="outline"
            >
              {copied ? t("copied") : t("copy")}
            </Button>

            <Button
              onClick={toggleMobileSidebar}
              className="w-1/2 flex-1 sm:hidden font-bold sm:font-normal"
              variant="outline"
            >
              {isMobileSidebarOpen
                ? t("hide-participants")
                : t("show-participants")}
            </Button>
          </div>
        </div>

        <div
          className={`overflow-y-auto px-4 transition-all duration-300 ${
            isMobileSidebarOpen
              ? "max-h-96 py-2"
              : "max-h-0 sm:max-h-full sm:py-2"
          }`}
        >
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
                  ? `${t("host")} (${uid.slice(0, 6)})`
                  : `${t("guest")} (${uid.slice(0, 6)})`}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {stream && localUserId && (
        <>
          <audio
            key={`${id}-${stream.id}-${stream.active}`}
            ref={streamAudio}
            autoPlay
            playsInline
            controls
            className="hidden"
          />
          <SpeakingAnalyzer
            userId={localUserId}
            stream={stream}
            isLocal={true}
            sendSpeakingStatus={sendSpeakingStatus}
            onAnalyserReady={(analyser) => {
              analyserRefs.current[localUserId] = analyser;
            }}
          />
        </>
      )}

      {remoteStreams
        .filter(({ id }) => id !== localUserId)
        .map(({ id, stream }) => (
          <>
            <audio
              key={`${id}-${stream.id}`}
              id={`remote-audio-${id}`}
              autoPlay
              playsInline
              ref={(el) => {
                if (!el || !stream) return;

                try {
                  el.srcObject = stream;
                  el.muted = false;
                  el.volume = 1.0;

                  const attemptPlay = () => {
                    el.play().catch((e) => {
                      console.warn(
                        "⚠️ play() blocked, waiting for user gesture",
                        id,
                        e
                      );
                      const unlock = () => {
                        el.play().catch(console.error);
                        window.removeEventListener("click", unlock);
                      };
                      window.addEventListener("click", unlock);
                    });
                  };

                  // Delay play() until stream has real audio tracks
                  const waitForTracks = () => {
                    if (stream.getAudioTracks().length === 0) {
                      setTimeout(waitForTracks, 100);
                    } else {
                      attemptPlay();
                    }
                  };
                  waitForTracks();
                } catch (err) {
                  console.error("❌ Remote audio binding failed:", id, err);
                }
              }}
              // className="hidden"
            />

            <SpeakingAnalyzer
              userId={id}
              stream={stream}
              isLocal={false}
              onAnalyserReady={(analyser) => {
                analyserRefs.current[id] = analyser;
              }}
            />
          </>
        ))}

      <main className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center justify-start min-h-full py-10 px-6 gap-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">
              {t("room")} {id}
            </h1>

            <Button
              onClick={handleCopyRoomUrl}
              className="flex-1 text-sm h-16 w-full font-bold sm:font-normal sm:h-8"
              variant="outline"
            >
              {copied ? t("copied") : t("copy")}
            </Button>
          </div>

          <div
            className={`grid grid-cols-2 gap-4 w-full max-w-3xl ${
              localUserId === hostId ? "sm:grid-cols-4" : "sm:grid-cols-3"
            }`}
          >
            <Button
              onClick={toggleMic}
              className="bg-yellow-600 hover:bg-yellow-700 text-white h-16 sm:h-8 px-4 py-2 rounded text-md sm:text-sm font-bold sm:font-medium"
              variant="ghost"
            >
              {isMicMuted ? `${t("mic-on")}` : `${t("mic-off")}`}
            </Button>

            <Button
              onClick={triggerFileSelect}
              className="bg-blue-600 hover:bg-blue-700 text-white h-16 sm:h-8 px-4 py-2 rounded text-md sm:text-sm font-bold sm:font-medium"
              variant="ghost"
            >
              {t("choose")}
            </Button>

            {localUserId === hostId && (
              <Button
                onClick={() => setShowVoteHistory((prev) => !prev)}
                className={`bg-purple-600 hover:bg-purple-700 text-white h-16 sm:h-8 px-4 py-2 rounded text-md sm:text-sm font-bold sm:font-medium ${
                  normalizedVoteHistory.length === 0
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
                variant="ghost"
                disabled={normalizedVoteHistory.length === 0}
              >
                {showVoteHistory ? t("hide-history") : t("show-history")}
              </Button>
            )}

            <Button
              onClick={() => {
                leaveRoom();
                window.location.href = "/rooms";
              }}
              className="bg-red-600 hover:bg-red-700 text-white h-16 sm:h-8 px-4 py-2 rounded text-md sm:text-sm font-bold sm:font-medium"
              variant="ghost"
            >
              {t("leave")}
            </Button>
          </div>

          {localUserId === hostId && !activeVote && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full max-w-3xl">
              <input
                type="text"
                placeholder={t("vote.placeholder")}
                value={voteQuestion}
                onChange={(e) => setVoteQuestion(e.target.value)}
                className="flex-1 px-3 py-4 sm:py-2 rounded bg-gray-800 text-white placeholder-gray-400 text-md sm:text-sm font-bold sm:font-medium"
              />
              <Button
                onClick={handleCreateVote}
                className="bg-green-600 hover:bg-green-700 text-white h-14 sm:h-8 px-4 rounded text-sm whitespace-nowrap text-md sm:text-sm font-bold sm:font-medium"
                variant="ghost"
              >
                {t("vote.start")}
              </Button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => {
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
            }}
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
              {!hasVoted && (
                <div className="flex flex-col gap-4 mb-6">
                  <div className="text-lg font-semibold">
                    🗳️ {t("vote.title")}:{" "}
                    <span className="underline">{activeVote}</span>
                  </div>
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
                </div>
              )}
              <div className="text-sm text-gray-300 mb-4">
                <h2 className="font-bold text-xl mb-2">{t("vote.results")}</h2>
                <div>
                  ✅ {t("vote.yes")}:{" "}
                  {
                    Object.values(currentVotes).filter((v) => v === "yes")
                      .length
                  }{" "}
                  | ❌ {t("vote.no")}:{" "}
                  {Object.values(currentVotes).filter((v) => v === "no").length}
                </div>
              </div>
              {localUserId === hostId && (
                <button
                  onClick={handleEndVote}
                  className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded text-sm"
                >
                  ✖ {t("vote.end")}
                </button>
              )}
            </div>
          )}

          {showVoteSummary && lastVote && (
            <div className="w-full max-w-md text-center mt-4 text-white bg-gray-800 p-4 rounded shadow">
              <div className="mb-2 text-lg font-bold">
                ✅ {t("vote.ended")} – {lastVote.question}
              </div>
              <div>
                ✅ {t("vote.yes")}: {lastVote.yes} | ❌ {lastVote.no} (
                {t("vote.total")}: {lastVote.total})
              </div>
              <button
                onClick={() => setShowLastVote(false)}
                className="mt-4 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
              >
                ✖ {t("close")}
              </button>
            </div>
          )}

          {showVoteHistory && (
            <div className="w-full max-w-md mt-6 text-white">
              <h2 className="text-lg font-bold mb-2">{t("vote.history")}</h2>
              <ul className="space-y-2 text-sm">
                {normalizedVoteHistory.map((v, idx) => (
                  <li key={idx} className="bg-gray-700 p-3 rounded">
                    <div className="font-semibold">{v.question}</div>
                    <div>
                      ✅ {t("vote.yes")}: {v.yes} | ❌ {v.no} ({t("vote.total")}
                      : {v.total})
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="block w-full sm:inline-flex sm:items-center sm:justify-center sm:flex-wrap sm:gap-4">
            {stream && localUserId && (
              <div
                key={localUserId}
                className="flex items-center justify-between gap-4 bg-gray-800 text-white rounded-full px-3 py-2 w-full mb-2 sm:max-w-fit"
              >
                <div className="text-sm font-mono">
                  <span className="mr-1">{t("you")}</span>
                  <span>
                    {hostId === localUserId
                      ? `(${t("host")})`
                      : `(${t("guest")})`}
                  </span>
                </div>
                {analyserRefs.current[localUserId] && (
                  <VolumeMeter analyser={analyserRefs.current[localUserId]} />
                )}
              </div>
            )}

            {remoteStreams
              .filter(({ id }) => id !== localUserId)
              .map(({ id, stream }) => (
                <div
                  key={`${id}-${stream.id}`}
                  className="flex items-center justify-between gap-4 bg-gray-800 text-white rounded-full px-3 py-2 w-full mb-2 sm:max-w-fit"
                >
                  <div className="text-sm font-mono">
                    <span className="mr-1">
                      {id === hostId ? t("host") : t("guest")}
                    </span>
                    <span>({id.slice(0, 6)})</span>
                  </div>
                  {analyserRefs.current[id] ? (
                    <VolumeMeter analyser={analyserRefs.current[id]} />
                  ) : (
                    <span className="text-xs text-gray-500 italic">
                      loading...
                    </span>
                  )}
                </div>
              ))}
          </div>
          {remoteStreams.length <= 1 && (
            <div className="text-red-500 font-mono text-sm">
              ⚠️ No remote streams available
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
