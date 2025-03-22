"use client";

import { useTranslations } from "next-intl";

export default function Footer() {
  const t = useTranslations("common");

  return (
    <footer className="bg-gray-900 text-white text-center px-4 py-1 text-sm">
      &copy; {new Date().getFullYear()} {t("title")}
    </footer>
  );
}
