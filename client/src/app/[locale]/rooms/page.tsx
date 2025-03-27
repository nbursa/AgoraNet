"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/Button";

export default function RoomsPage() {
  const router = useRouter();
  const t = useTranslations("rooms");
  const locale = useLocale();
  const [rooms, setRooms] = useState<string[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push(`/${locale}/login`);
      return;
    }

    const activeRooms = JSON.parse(localStorage.getItem("activeRooms") || "[]");
    setRooms(activeRooms);
  }, [router, locale]);

  const createRoom = async () => {
    const newRoomId = Math.random().toString(36).substring(2, 8);
    const updatedRooms = [...rooms, newRoomId];
    setRooms(updatedRooms);
    localStorage.setItem("activeRooms", JSON.stringify(updatedRooms));
  };

  const closeRoom = async (roomId: string) => {
    const updatedRooms = rooms.filter((room) => room !== roomId);
    setRooms(updatedRooms);
    localStorage.setItem("activeRooms", JSON.stringify(updatedRooms));

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/close-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
    } catch (error) {
      console.error("Failed to notify backend about room closure:", error);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center w-full px-4 py-6 overflow-y-auto">
      <div className="w-full max-w-3xl flex flex-col items-center text-center">
        <h1 className="text-4xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-gray-400">{t("description")}</p>

        <div className="mt-6 w-full">
          <Button onClick={createRoom} className="w-full xs:w-auto">
            {t("create")}
          </Button>
        </div>

        <h2 className="mt-8 text-xl font-semibold">{t("available")}</h2>

        <div className="mt-4 w-full space-y-2 flex flex-col items-center">
          {rooms.length > 0 ? (
            rooms.map((room) => (
              <div
                key={room}
                className="group flex justify-between items-center w-full max-w-md p-2 border border-gray-100 rounded-md hover:bg-gray-900 transition"
              >
                <Link
                  href={`/${locale}/rooms/${room}`}
                  className="block px-2 py-1 w-full"
                >
                  {room}
                </Link>
                <Button
                  onClick={(event) => {
                    event.stopPropagation();
                    closeRoom(room);
                  }}
                  className="bg-red-500/50 text-white px-3 py-1 rounded-md hover:bg-red-600"
                  variant="ghost"
                >
                  {t("delete")}
                </Button>
              </div>
            ))
          ) : (
            <p className="text-gray-400">{t("noRooms")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
