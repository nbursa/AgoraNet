"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { register } from "@/lib/api";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatar(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const formData = new FormData();
    formData.append("username", username);
    if (avatar) formData.append("avatar", avatar);
    formData.append("password", password);

    try {
      await register(formData);
      setError("");
      router.push("/login");
    } catch {
      setError("Registration failed. Try again.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <h1 className="text-3xl font-bold">Register</h1>

      <div className="mt-4 w-full max-w-sm">
        {/* Avatar Upload */}
        <div className="flex flex-col items-center">
          <label htmlFor="avatar-upload" className="cursor-pointer">
            {avatarPreview ? (
              <Image
                src={avatarPreview}
                alt="Avatar Preview"
                width={80}
                height={80}
                className="w-20 h-20 rounded-full object-cover border mb-2"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-300 flex items-center justify-center mb-2">
                <span className="text-gray-600">Set Avatar</span>
              </div>
            )}
          </label>
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>

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
            className="absolute inset-y-0 right-3 flex items-center text-sm leading-5"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        <div className="relative mt-2">
          <input
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="border p-2 w-full rounded-md"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-3 flex items-center text-sm leading-5"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            {showConfirmPassword ? "Hide" : "Show"}
          </button>
        </div>

        {error && <p className="text-red-500 mt-2 text-center">{error}</p>}

        {/* Buttons */}
        <div className="flex justify-between mt-4">
          <button
            onClick={() => router.push("/")}
            className="bg-gray-500 text-white px-4 py-2 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleRegister}
            className="bg-green-500 text-white px-4 py-2 rounded-md"
          >
            Register
          </button>
        </div>

        <p className="text-center mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-500 underline">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}
