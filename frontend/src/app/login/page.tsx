"use client";

import { useState } from "react";
import { login } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async () => {
    try {
      const { token } = await login(username, password);
      localStorage.setItem("token", token); // Store JWT token
      setError("");
      router.push("/dashboard"); // Redirect after login
    } catch {
      setError("Invalid credentials");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold">Login</h1>
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="border p-2 mt-2"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border p-2 mt-2"
      />
      <button onClick={handleLogin} className="bg-blue-500 text-white p-2 mt-4">
        Login
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
}
