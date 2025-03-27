"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { syncVoteHistoryToDB } from "@/hooks/useVoteSync";
import VoteChartModal from "@/components/VoteChartModal";
import { Button } from "@/components/Button";

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
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (!data.error) {
            setUser({ username: data.username, avatar: data.avatar });
          }
        });
    } else {
      setGuestName(localStorage.getItem("guestName"));
      setGuestAvatar(localStorage.getItem("guestAvatar"));
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
  }, [API]);

  const handleSync = async () => {
    if (!user) return;
    setSyncing(true);
    await syncVoteHistoryToDB(user.username);
    setSyncing(false);
  };

  return (
    <div className="w-full h-full grid grid-rows-[auto_1fr] text-white overflow-hidden">
      {/* User Info Bar */}
      <div className="w-full max-w-3xl mx-auto px-4 py-6">
        {user ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-center sm:text-left">
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
            <Button
              onClick={handleSync}
              disabled={syncing}
              className=" bg-green-600/50 hover:bg-green-700 disabled:opacity-50"
              variant="ghost"
            >
              {syncing ? t("user.syncing") : t("user.sync")}
            </Button>
          </div>
        ) : guestName ? (
          <div className="text-center">
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
            <p className="text-gray-400 mt-2">{t("guest.label")}</p>
          </div>
        ) : null}
      </div>

      {/* Main Scrollable Content */}
      <div className="overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-4 py-10 flex flex-col items-center">
          <h2 className="w-full text-2xl text-left font-semibold mb-6">
            {t("rooms.title")}
          </h2>
          <div className="flex flex-col gap-4 w-full">
            {rooms.length === 0 ? (
              <p className="text-gray-400">{t("rooms.noRooms")}</p>
            ) : (
              rooms.map((room) => (
                <div
                  key={room.roomId}
                  onClick={() => setSelectedRoom(room.roomId)}
                  className="bg-gray-800 p-4 rounded-lg shadow-md cursor-pointer hover:ring-2 ring-blue-600 transition-all relative"
                >
                  <h3 className="text-lg font-bold mb-1">
                    {t("room")}: {room.roomId}
                  </h3>
                  <p className="text-sm text-gray-300">
                    {room.votes.length} {t("votes.recorded")}
                  </p>
                  <span className="absolute bottom-2 right-3 text-xs text-gray-400">
                    ℹ️ {t("rooms.viewDetails")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedRoom && (
        <VoteChartModal
          roomId={selectedRoom}
          votes={rooms.find((r) => r.roomId === selectedRoom)?.votes || []}
          onClose={() => setSelectedRoom(null)}
        />
      )}
    </div>
  );
}
