"use client";

import { useState } from "react";
import { login } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async () => {
    try {
      console.log("Attempting login...");
      const response = await login(username, password);
      console.log("Login response:", response);

      if (!response.token) {
        throw new Error("No token received from API");
      }

      localStorage.setItem("token", response.token);
      setError("");
      router.push("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError("Invalid credentials");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <h1 className="text-3xl font-bold">Login</h1>

      <div className="mt-4 w-full max-w-sm">
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border p-2 mt-2 w-full rounded-md"
        />
        <div className="relative mt-2">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-2 w-full rounded-md"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        {error && <p className="text-red-500 mt-2 text-center">{error}</p>}

        <div className="flex justify-between mt-4">
          <button
            onClick={() => router.push("/")}
            className="bg-gray-500 text-white px-4 py-2 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleLogin}
            className="bg-blue-500 text-white px-4 py-2 rounded-md"
          >
            Login
          </button>
        </div>

        <p className="text-center mt-4">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-blue-500 underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}
