"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { usePathname, useRouter, Link } from "@/i18n/navigation";
import { isAuthenticated, logout } from "@/lib/api";

export default function Header() {
  const t = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(isAuthenticated());
  }, []);

  // const switchLocale = (nextLocale: string) => {
  //   const newPath = pathname.replace(`/${locale}`, `/${nextLocale}`);
  //   router.push(newPath);
  // };

  const switchLocale = (nextLocale: string) => {
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <header className="bg-black text-white px-4 py-2 flex justify-between items-center text-sm">
      <Link href="/" className="hover:text-gray-300 font-bold text-lg">
        {t("title")}
      </Link>
      <nav className="flex items-center gap-2">
        <Link href="/rooms" className="hover:text-gray-300">
          {t("rooms")}
        </Link>
        <Link href="/dashboard" className="hover:text-gray-300">
          {t("dashboard")}
        </Link>
        <Link href="/about" className="hover:text-gray-300">
          {t("about")}
        </Link>
        {loggedIn ? (
          <button
            onClick={logout}
            className="hover:text-gray-300 cursor-pointer"
          >
            {t("logout")}
          </button>
        ) : (
          <Link href="/login" className="hover:text-gray-300">
            {t("login")}
          </Link>
        )}
        <select
          value={locale}
          onChange={(e) => switchLocale(e.target.value)}
          className="bg-black border border-gray-700 text-white px-2 py-1 rounded"
        >
          <option value="en">EN</option>
          <option value="sr">SR</option>
        </select>
      </nav>
    </header>
  );
}
