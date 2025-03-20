"use client";

import { useEffect, useState } from "react";
import { api, logout } from "@/lib/api";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function DashboardPage() {
  const [user, setUser] = useState<{
    username: string;
    avatar?: string;
  } | null>(null);
  const [recentActivities, setRecentActivities] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    api
      .get("/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setUser(res.data))
      .catch(() => {
        logout();
      });

    setRecentActivities([
      "Joined a new discussion room",
      "Updated profile settings",
      "Sent a message in #general",
    ]);
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <div className="w-full max-w-4xl border border-gray-300 p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {user?.avatar ? (
              <Image
                src={user.avatar}
                alt="Avatar"
                width={48}
                height={48}
                className="rounded-full border"
              />
            ) : (
              <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-gray-600">?</span>
              </div>
            )}
            <h1 className="text-xl font-bold">
              Welcome, {user?.username || "User"} 👋
            </h1>
          </div>
          <button
            onClick={logout}
            className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 hover:cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="w-full max-w-4xl mt-6 grid grid-cols-3 gap-4">
        <div className="bg-blue-500 text-white p-4 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold">Rooms Joined</h2>
          <p className="text-2xl font-bold">5 (mock)</p>
        </div>
        <div className="bg-green-500 text-white p-4 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold">Messages Sent</h2>
          <p className="text-2xl font-bold">27 (mock)</p>
        </div>
        <div className="bg-purple-500 text-white p-4 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold">Active Discussions</h2>
          <p className="text-2xl font-bold">3 (mock)</p>
        </div>
      </div>

      <div className="w-full max-w-4xl mt-6 border border-gray-300 p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Recent Activity (mock)</h2>
        <ul className="list-disc list-inside space-y-2 text-gray-500">
          {recentActivities.map((activity, index) => (
            <li key={index}>{activity}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
