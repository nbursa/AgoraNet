"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";

export default function AboutPage() {
  const t = useTranslations("about");
  const locale = useLocale();

  return (
    <div className="w-full min-h-full flex items-center justify-center px-4 py-12">
      <div className="max-w-3xl mx-auto flex flex-col items-center text-center">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mt-4 text-gray-400">
          {t("description.part1")} <strong>{t("description.strong")}</strong>{" "}
          {t("description.part2")}
        </p>

        <div className="mt-6 w-full border border-gray-500 p-4 mb-4 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-center">
            {t("features.title")}
          </h2>
          <ol className="mt-2 text-gray-300 list-decimal list-inside text-left mx-auto max-w-lg">
            <li>{t("features.items.0")}</li>
            <li>{t("features.items.1")}</li>
            <li>{t("features.items.2")}</li>
            <li>{t("features.items.3")}</li>
            <li>{t("features.items.4")}</li>
          </ol>
        </div>

        <div className="mb-6 w-full text-left">
          <h2 className="text-xl font-semibold">💡 {t("howItWorks.title")}</h2>
          <p className="mt-2 text-gray-400">{t("howItWorks.text")}</p>
        </div>

        <div className="mb-6 w-full text-left">
          <h2 className="text-xl font-semibold">🌍 {t("getInvolved.title")}</h2>
          <p className="mt-2 text-gray-400">{t("getInvolved.text")}</p>
        </div>

        <div className="mt-6">
          <Link href={`/${locale}`}>
            <button className="bg-purple-600 text-white px-6 py-2 rounded-md hover:bg-purple-700">
              {t("backToHome")}
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
