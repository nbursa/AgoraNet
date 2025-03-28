"use client";

import { useEffect, useState } from "react";
import { login } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/Button";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const t = useTranslations("login");
  const locale = useLocale();

  useEffect(() => {
    document.title = `${t("title")}`;
  }, [t]);

  const handleLogin = async () => {
    try {
      const response = await login(username, password);
      if (!response.token) throw new Error("No token");
      localStorage.setItem("token", response.token);
      setError("");
      router.push(`/${locale}`);
    } catch (err) {
      const error = err as Error;
      if (error.message === "invalid-credentials") {
        setError(t("invalidCredentials"));
      } else {
        setError(t("error"));
      }
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center w-full px-4 py-6 overflow-y-auto">
      <div className="flex flex-col items-center justify-center w-full max-w-sm text-center">
        <h1 className="text-3xl font-bold">{t("title")}</h1>

        <div className="mt-4 w-full">
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
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
            >
              {showPassword ? t("hide") : t("show")}
            </button>
          </div>

          {error && <p className="text-red-500 mt-2">{error}</p>}

          <div className="flex justify-between mt-4">
            <Button onClick={() => router.push(`/${locale}`)} variant="outline">
              {t("cancel")}
            </Button>
            <Button onClick={handleLogin}>{t("loginBtn")}</Button>
          </div>

          <p className="text-center mt-4">
            {t("noAccount")}{" "}
            <Link
              href={`/${locale}/register`}
              className="text-blue-500 underline"
            >
              {t("registerHere")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
