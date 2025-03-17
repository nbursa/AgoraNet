"use client";

import { useEffect, useState } from "react";
import { api, logout } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const [message, setMessage] = useState("Loading...");
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login"); // Redirect if not logged in
      return;
    }

    api
      .get("/api/protected", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setMessage(res.data.message))
      .catch(() => {
        logout(); // Clear session and redirect
      });
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-4">{message}</p>
      <button onClick={logout} className="bg-red-500 text-white px-4 py-2 mt-4">
        Logout
      </button>
    </div>
  );
}
