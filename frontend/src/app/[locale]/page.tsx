"use client";

import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState } from "react";

export default function HomePage() {
  const router = useRouter();
  const t = useTranslations("home");
  const locale = useLocale();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAuthenticated(!!token);
  }, []);

  const goTo = (path: string) => {
    router.push(`/${locale}${path}`);
  };

  return (
    <div className="flex-1 flex items-center justify-center w-full px-4 py-6">
      <div className="flex flex-col items-center w-full max-w-2xl text-center">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-gray-400">{t("description")}</p>

        {isAuthenticated ? (
          <div className="w-full mt-6 gap-4 flex flex-col xs:flex-row items-center justify-center">
            <button
              onClick={() => goTo("/rooms")}
              className="w-full xs:w-auto bg-blue-600 text-white px-6 py-2 rounded-md"
            >
              {t("viewRooms")}
            </button>
            <button
              onClick={() => goTo("/rooms/new")}
              className="w-full xs:w-auto bg-purple-600 text-white px-6 py-2 rounded-md"
            >
              {t("createRoom")}
            </button>
          </div>
        ) : (
          <div className="mt-6">
            <p className="text-gray-600 text-sm">🔒 {t("loginRequired")}</p>
            <button
              onClick={() => goTo("/login")}
              className="w-full xs:w-auto mt-4 bg-green-600 text-white px-6 py-2 rounded-md"
            >
              {t("loginBtn")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
