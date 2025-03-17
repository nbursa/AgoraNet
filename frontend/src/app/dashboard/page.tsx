"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const [message, setMessage] = useState("");
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
        localStorage.removeItem("token");
        router.push("/login");
      });
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-4">{message || "Loading..."}</p>
    </div>
  );
}
