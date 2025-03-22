"use client";

import { useTranslations } from "next-intl";

export default function DashboardPage() {
  const t = useTranslations("dashboard");

  return (
    <div className="w-full min-h-full flex items-center justify-center px-4 py-6">
      <div className="flex flex-col items-center w-full max-w-5xl text-center">
        <h1 className="text-3xl font-bold mb-4">📊 {t("title")}</h1>

        <p className="text-gray-400 mb-6">{t("description")}</p>

        <div className="w-full grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 text-left">
          <div className="bg-gray-800 p-4 rounded-lg shadow-md text-white">
            <h2 className="text-xl font-semibold mb-2">{t("rooms.title")}</h2>
            <p className="text-gray-400">{t("rooms.description")}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg shadow-md text-white">
            <h2 className="text-xl font-semibold mb-2">{t("votes.title")}</h2>
            <p className="text-gray-400">{t("votes.description")}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg shadow-md text-white">
            <h2 className="text-xl font-semibold mb-2">{t("files.title")}</h2>
            <p className="text-gray-400">{t("files.description")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
