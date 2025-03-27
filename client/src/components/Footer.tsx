"use client";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white text-center px-4 py-1 text-xs">
      &copy; {new Date().getFullYear()} Nenad Bursać. All rights reserved.
    </footer>
  );
}
