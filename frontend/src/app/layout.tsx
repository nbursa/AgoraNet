import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Decentralized Plenum",
  description: "Secure, decentralized meetings & discussions",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full w-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col h-full w-full`}
      >
        {/* 🔹 Global Navbar */}
        <header className="bg-gray-900 text-white px-4 py-2 text-center text-lg font-semibold flex justify-between">
          <Link href="/" className="hover:text-gray-300">
            Decentralized Plenum
          </Link>
          <nav>
            <Link href="/dashboard" className="mx-2 hover:text-gray-300">
              Dashboard
            </Link>
            <Link href="/login" className="mx-2 hover:text-gray-300">
              Login
            </Link>
          </nav>
        </header>

        {/* 📌 Main Content - Now it fits between header & footer and scrolls if necessary */}
        <main className="flex-1 w-full overflow-auto">{children}</main>

        {/* 🔹 Global Footer */}
        <footer className="bg-gray-900 text-white text-center px-4 py-1  text-sm">
          &copy; {new Date().getFullYear()} Decentralized Plenum
        </footer>
      </body>
    </html>
  );
}
