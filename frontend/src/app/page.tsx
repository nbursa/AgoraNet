"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function HomePage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAuthenticated(!!token);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 w-full max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-center">Decentralized Plenum</h1>
      <p className="mt-2 text-gray-600 text-center">
        Secure, decentralized meetings & discussions
      </p>

      {isAuthenticated ? (
        <div className="mt-6 space-x-4">
          <button
            onClick={() => router.push("/rooms")}
            className="bg-blue-600 text-white px-6 py-2 rounded-md"
          >
            View Active Rooms
          </button>
          <button
            onClick={() => router.push("/rooms/new")}
            className="bg-purple-600 text-white px-6 py-2 rounded-md"
          >
            Create New Room
          </button>
        </div>
      ) : (
        <div className="mt-6 text-center text-gray-600">
          <p>🔒 You must be logged in to access rooms.</p>
          <button
            onClick={() => router.push("/login")}
            className="mt-4 bg-green-600 text-white px-6 py-2 rounded-md"
          >
            Login / Register
          </button>
        </div>
      )}
    </div>
  );
}
