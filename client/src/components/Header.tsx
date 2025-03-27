"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { usePathname, useRouter, Link } from "@/i18n/navigation";
import { isAuthenticated, logout } from "@/lib/api";
import { Button } from "./Button";

export default function Header() {
  const t = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const [loggedIn, setLoggedIn] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkAuth = () => setLoggedIn(isAuthenticated());
    checkAuth();

    const handleStorage = () => checkAuth();
    window.addEventListener("storage", handleStorage);

    const handleClickOutside = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setShowLangMenu(false);
      }
    };
    window.addEventListener("click", handleClickOutside);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("click", handleClickOutside);
    };
  }, []);

  const switchLocale = (nextLocale: string) => {
    setShowLangMenu(false);
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <header className="bg-black text-white px-4 py-3 md:py-2 flex justify-between items-center text-sm">
      <Link href="/" className="hover:text-gray-300 font-bold text-lg">
        {t("title")}
      </Link>

      <nav className="hidden md:flex items-center gap-2 relative">
        <Button asChild variant="ghost" size="sm">
          <Link href="/rooms">{t("rooms")}</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard">{t("dashboard")}</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/about">{t("about")}</Link>
        </Button>
        {loggedIn ? (
          <Button onClick={logout} variant="ghost" size="sm">
            {t("logout")}
          </Button>
        ) : (
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">{t("login")}</Link>
          </Button>
        )}

        {/* Language Selector */}
        <div className="relative" ref={langRef}>
          <Button
            onClick={() => setShowLangMenu((prev) => !prev)}
            variant="ghost"
            size="sm"
            className="ring-0 outline-none focus:ring-0 focus:outline-none"
          >
            {locale.toUpperCase()}
          </Button>
          {showLangMenu && (
            <div className="absolute right-0 mt-1 bg-black border border-gray-700 rounded shadow-md z-50">
              <button
                onClick={() => switchLocale("en")}
                className="block w-full text-left px-4 py-2 hover:bg-white/10"
              >
                English
              </button>
              <button
                onClick={() => switchLocale("sr")}
                className="block w-full text-left px-4 py-2 hover:bg-white/10"
              >
                Srpski
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
