"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function HomePage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<string[]>([]);

  useEffect(() => {
    // Load active rooms from localStorage
    const activeRooms = JSON.parse(localStorage.getItem("activeRooms") || "[]");
    setRooms(activeRooms);
  }, []);

  const createRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 8);
    const updatedRooms = [...rooms, newRoomId];
    setRooms(updatedRooms);
    localStorage.setItem("activeRooms", JSON.stringify(updatedRooms));
    router.push(`/rooms/${newRoomId}`);
  };

  const closeRoom = (roomId: string) => {
    const updatedRooms = rooms.filter((room) => room !== roomId);
    setRooms(updatedRooms);
    localStorage.setItem("activeRooms", JSON.stringify(updatedRooms));
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 w-full max-w-3xl mx-auto overflow-auto">
      <h1 className="text-3xl font-bold text-center">
        Welcome to Decentralized Plenum
      </h1>
      <p className="mt-2 text-gray-600 text-center">
        Secure, decentralized meetings & discussions
      </p>

      <div className="mt-6 flex space-x-4">
        <Link href="/login">
          <button className="bg-blue-500 text-white px-4 py-2 rounded-md">
            Login
          </button>
        </Link>
        <Link href="/dashboard">
          <button className="bg-green-500 text-white px-4 py-2 rounded-md">
            Dashboard
          </button>
        </Link>
      </div>

      <h2 className="mt-8 text-xl font-semibold">Active Rooms</h2>
      <div className="mt-4 w-full space-y-2 text-center">
        {rooms.length > 0 ? (
          rooms.map((room) => (
            <div
              key={room}
              className="flex justify-between items-center p-2 rounded-md"
            >
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

      <button
        onClick={createRoom}
        className="mt-6 bg-purple-600 text-white px-6 py-2 rounded-md"
      >
        Create New Room
      </button>
    </div>
  );
}
