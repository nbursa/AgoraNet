"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { usePathname, useRouter, Link } from "@/i18n/navigation";
import { isAuthenticated, logout } from "@/lib/api";
import { Menu, X } from "lucide-react";

const MobileSidebar = () => {
  const t = useTranslations("navigation");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(isAuthenticated());
  }, []);

  const toggleSidebar = () => setOpen(!open);

  const switchLocale = (nextLocale: string) => {
    router.replace(pathname, { locale: nextLocale });
    setOpen(false);
  };

  const navItems = [
    { href: "/", label: t("home") },
    { href: "/rooms", label: t("rooms") },
    { href: "/dashboard", label: t("dashboard") },
    { href: "/about", label: t("about") },
  ];

  return (
    <>
      <button
        className="fixed top-1.5 right-4 z-50 p-2 bg-gray-800 rounded-md md:hidden"
        onClick={toggleSidebar}
        aria-label="Toggle Sidebar"
      >
        {open ? <X className="text-white" /> : <Menu className="text-white" />}
      </button>

      <div
        className={`fixed top-0 right-0 h-full w-64 bg-gray-900 shadow-lg z-40 transform transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        } md:hidden`}
      >
        <nav className="flex flex-col p-4 mt-16 space-y-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={toggleSidebar}
              className={`px-3 py-2 rounded-md ${
                pathname === item.href ? "bg-gray-700" : "hover:bg-gray-800"
              } text-gray-200`}
            >
              {item.label}
            </Link>
          ))}

          {loggedIn ? (
            <button
              onClick={() => {
                logout();
                setOpen(false);
              }}
              className="px-3 py-2 rounded-md hover:bg-gray-800 text-gray-200 text-left"
            >
              {t("logout")}
            </button>
          ) : (
            <Link
              href="/login"
              onClick={toggleSidebar}
              className={`px-3 py-2 rounded-md ${
                pathname === "/login" ? "bg-gray-700" : "hover:bg-gray-800"
              } text-gray-200`}
            >
              {t("login")}
            </Link>
          )}

          <select
            value={locale}
            onChange={(e) => switchLocale(e.target.value)}
            className="mt-4 bg-gray-800 border border-gray-700 text-white px-2 py-1 rounded"
          >
            <option value="en">EN</option>
            <option value="sr">SR</option>
          </select>
        </nav>
      </div>

      {open && (
        <div
          className="fixed inset-0 bg-black opacity-50 z-30 md:hidden"
          onClick={toggleSidebar}
        />
      )}
    </>
  );
};

export default MobileSidebar;
