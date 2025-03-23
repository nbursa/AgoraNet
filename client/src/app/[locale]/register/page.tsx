"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { register } from "@/lib/api";
import { useLocale, useTranslations } from "next-intl";

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
  const locale = useLocale();
  const t = useTranslations("register");

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatar(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      setError(t("mismatch"));
      return;
    }

    const formData = new FormData();
    formData.append("username", username);
    if (avatar) formData.append("avatar", avatar);
    formData.append("password", password);

    try {
      await register(formData);
      setError("");
      router.push(`/${locale}/login`);
    } catch {
      setError(t("error"));
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center w-full px-4 py-6 overflow-y-auto">
      <div className="flex flex-col items-center justify-center w-full max-w-sm text-center">
        <h1 className="text-3xl font-bold">{t("title")}</h1>

        <div className="mt-4 w-full">
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
                  <span className="text-gray-600">{t("setAvatar")}</span>
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
            placeholder={t("username")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="border p-2 mt-2 w-full rounded-md"
          />

          <div className="relative mt-2">
            <input
              type={showPassword ? "text" : "password"}
              placeholder={t("password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border p-2 w-full rounded-md"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-3 flex items-center text-sm leading-5"
            >
              {showPassword ? t("hide") : t("show")}
            </button>
          </div>

          <div className="relative mt-2">
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder={t("confirm")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="border p-2 w-full rounded-md"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-3 flex items-center text-sm leading-5"
            >
              {showConfirmPassword ? t("hide") : t("show")}
            </button>
          </div>

          {error && <p className="text-red-500 mt-2 text-center">{error}</p>}

          {/* Buttons */}
          <div className="flex justify-between mt-4">
            <button
              onClick={() => router.push(`/${locale}`)}
              className="bg-gray-500 text-white px-4 py-2 rounded-md"
            >
              {t("cancel")}
            </button>
            <button
              onClick={handleRegister}
              className="bg-green-500 text-white px-4 py-2 rounded-md"
            >
              {t("registerBtn")}
            </button>
          </div>

          <p className="text-center mt-4">
            {t("haveAccount")}{" "}
            <Link href={`/${locale}/login`} className="text-blue-500 underline">
              {t("loginHere")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
