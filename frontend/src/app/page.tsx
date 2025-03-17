"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function HomePage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<string[]>([]);

  useEffect(() => {
    const activeRooms = JSON.parse(localStorage.getItem("activeRooms") || "[]");
    setRooms(activeRooms);
  }, []);

  const createRoom = async () => {
    const newRoomId = Math.random().toString(36).substring(2, 8);
    const updatedRooms = [...rooms, newRoomId];
    setRooms(updatedRooms);
    localStorage.setItem("activeRooms", JSON.stringify(updatedRooms));

    // ✅ Register room in backend
    try {
      await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
        }/create-room`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: newRoomId }),
        }
      );
    } catch (error) {
      console.error("Failed to notify backend about room creation:", error);
    }

    router.push(`/rooms/${newRoomId}`);
  };

  const closeRoom = async (roomId: string) => {
    const updatedRooms = rooms.filter((room) => room !== roomId);
    setRooms(updatedRooms);
    localStorage.setItem("activeRooms", JSON.stringify(updatedRooms));

    try {
      await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
        }/close-room`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId }),
        }
      );
    } catch (error) {
      console.error("Failed to notify backend about room closure:", error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 w-full max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-center">Decentralized Plenum</h1>
      <p className="mt-2 text-gray-600 text-center">
        Secure, decentralized meetings & discussions
      </p>

      <div className="mt-6">
        <button
          onClick={createRoom}
          className="bg-purple-600 text-white px-6 py-2 rounded-md"
        >
          Create New Room
        </button>
      </div>

      <h2 className="mt-8 text-xl font-semibold">Active Rooms</h2>
      <div className="mt-4 w-full space-y-2 flex flex-col items-center">
        {rooms.length > 0 ? (
          rooms.map((room) => (
            <div key={room} className="flex justify-between p-2 rounded-md">
              <Link href={`/rooms/${room}`} className="flex-1 text-left px-2">
                Room {room}
              </Link>
              <button
                onClick={() => closeRoom(room)}
                className="bg-red-500 text-white px-3 py-1 rounded-md"
              >
                ✖
              </button>
            </div>
          ))
        ) : (
          <p className="text-gray-500">No active rooms</p>
        )}
      </div>
    </div>
  );
}
