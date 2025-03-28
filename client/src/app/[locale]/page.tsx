"use client";

import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";

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
    <div className="flex-1 flex items-center justify-center w-full px-4 py-8">
      <div className="flex flex-col items-center w-full max-w-3xl text-center">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">{t("title")}</h1>
        <p className="text-gray-400 text-lg max-w-2xl">{t("description")}</p>

        <p className="mt-6 text-gray-500 text-sm max-w-xl leading-relaxed">
          {t("longDescription")}
        </p>

        {isAuthenticated ? (
          <div className="w-full mt-8 gap-4 flex flex-col sm:flex-row items-center justify-center">
            <Button onClick={() => goTo("/rooms")} className="w-full sm:w-auto">
              {t("viewRooms")}
            </Button>
            <Button
              onClick={() => goTo("/rooms/new")}
              className="w-full sm:w-auto"
              variant="outline"
            >
              {t("createRoom")}
            </Button>
          </div>
        ) : (
          <div className="mt-8">
            <p className="text-gray-600 text-sm mb-2">{t("loginRequired")}</p>
            <Button
              onClick={() => goTo("/login")}
              className="w-full sm:w-auto bg-green-600 text-white px-6 py-3 rounded-md text-lg"
              variant="ghost"
            >
              {t("loginBtn")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
