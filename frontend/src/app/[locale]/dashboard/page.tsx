"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { syncVoteHistoryToDB } from "@/hooks/useVoteSync";
import VoteChart from "@/components/VoteChart";

type VoteHistoryItem = {
  question: string;
  totalVotes: number;
  yesCount: number;
  noCount: number;
};

type RoomSummary = {
  roomId: string;
  votes: VoteHistoryItem[];
};

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const [user, setUser] = useState<{
    username: string;
    avatar?: string;
  } | null>(null);
  const [guestName, setGuestName] = useState<string | null>(null);
  const [guestAvatar, setGuestAvatar] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [syncing, setSyncing] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      fetch(`${API}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (!data.error) {
            setUser({ username: data.username, avatar: data.avatar });
          }
        });
    } else {
      const anonName = localStorage.getItem("guestName");
      const anonAvatar = localStorage.getItem("guestAvatar");
      if (anonName) setGuestName(anonName);
      if (anonAvatar) setGuestAvatar(anonAvatar);
    }

    const activeRooms: string[] = JSON.parse(
      localStorage.getItem("activeRooms") || "[]"
    );

    const summaries: RoomSummary[] = activeRooms.map((roomId) => {
      const votes: VoteHistoryItem[] = JSON.parse(
        localStorage.getItem(`voteHistory-${roomId}`) || "[]"
      );
      return { roomId, votes };
    });

    setRooms(summaries);
  }, []);

  const handleSync = async () => {
    if (!user) return;
    setSyncing(true);
    await syncVoteHistoryToDB(user.username);
    setSyncing(false);
  };

  return (
    <div className="w-full min-h-full px-4 py-6 text-white flex flex-col items-center">
      <div className="max-w-5xl w-full">
        {user ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4 text-center sm:text-left">
            <div className="flex items-center gap-4">
              {user.avatar && (
                <Image
                  src={user.avatar}
                  alt="avatar"
                  width={64}
                  height={64}
                  className="rounded-full"
                />
              )}
              <h1 className="text-2xl font-bold">👤 {user.username}</h1>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white disabled:opacity-50"
            >
              {syncing ? "🔄 Syncing..." : "🧠 Sync Vote Results to DB"}
            </button>
          </div>
        ) : guestName ? (
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold mb-2">🕶️ {guestName}</h1>
            {guestAvatar && (
              <Image
                src={guestAvatar}
                alt="guest avatar"
                width={64}
                height={64}
                className="rounded-full mx-auto"
              />
            )}
            <p className="text-gray-400 mt-2">Anonymous user</p>
          </div>
        ) : null}

        <h2 className="text-2xl font-semibold mb-4">{t("rooms.title")}</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rooms.length === 0 ? (
            <p className="text-gray-400">{t("rooms.noRooms")}</p>
          ) : (
            rooms.map((room) => (
              <div
                key={room.roomId}
                className="bg-gray-800 p-4 rounded-lg shadow-md"
              >
                <h3 className="text-lg font-bold mb-2">
                  🏠 Room: {room.roomId}
                </h3>

                {room.votes.length > 0 && (
                  <VoteChart roomId={room.roomId} votes={room.votes} />
                )}

                {room.votes.length === 0 ? (
                  <p className="text-sm text-gray-400">{t("votes.none")}</p>
                ) : (
                  <div className="space-y-2">
                    {room.votes.map((vote, i) => (
                      <div key={i} className="bg-gray-700 p-3 rounded text-sm">
                        <p className="font-semibold">🗳️ {vote.question}</p>
                        <p className="text-green-400">
                          ✅ Yes: {vote.yesCount}
                        </p>
                        <p className="text-red-400">❌ No: {vote.noCount}</p>
                        <p className="text-gray-400">
                          📊 Total: {vote.totalVotes}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
