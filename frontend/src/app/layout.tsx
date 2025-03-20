"use client";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { isAuthenticated, logout } from "@/lib/api";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(isAuthenticated());
  }, []);

  return (
    <html lang="en" className="h-full w-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col h-full w-full`}
      >
        <header className="bg-black text-white px-4 py-2 text-center flex justify-between items-center text-sm">
          <Link href="/" className="hover:text-gray-300 font-bold text-lg">
            Decentralized Plenum
          </Link>
          <nav>
            <Link href="/rooms" className="mx-2 hover:text-gray-300">
              Rooms
            </Link>
            <Link href="/dashboard" className="mx-2 hover:text-gray-300">
              Dashboard
            </Link>
            <Link href="/about" className="mx-2 hover:text-gray-300">
              About
            </Link>
            {loggedIn ? (
              <button
                onClick={logout}
                className="mx-2 hover:text-gray-300 hover:cursor-pointer"
              >
                Logout
              </button>
            ) : (
              <Link href="/login" className="mx-2 hover:text-gray-300">
                Login
              </Link>
            )}
          </nav>
        </header>

        <main className="flex-1 w-full overflow-auto bg-gradient-to-b from-black to-gray-900 p-4">
          {children}
        </main>

        <footer className="bg-gray-900 text-white text-center px-4 py-1 text-sm">
          &copy; {new Date().getFullYear()} Decentralized Plenum
        </footer>
      </body>
    </html>
  );
}
