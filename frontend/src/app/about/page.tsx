"use client";

import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 w-full max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-center">
        About Decentralized Plenum
      </h1>
      <p className="mt-4 text-gray-400 text-center">
        Decentralized Plenum is a secure, censorship-resistant platform for
        **voice-based discussions and collective decision-making**. It empowers
        communities, activists, and individuals to engage in free, anonymous,
        and democratic discussions.
      </p>

      <div className="mt-6 w-full space-y-4 flex flex-col justify-center items-center">
        <div className="w-full max-w-md border border-gray-300 p-4 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-center">🔹 Key Features</h2>
          <ul className="mt-2 text-gray-400 text-left">
            <li>✅ **Real-time voice rooms** using P2P WebRTC technology</li>
            <li>✅ **Decentralized & censorship-resistant**</li>
            <li>✅ **No registration required**, ensuring full anonymity</li>
            <li>✅ **Integrated voting system** for decision-making</li>
            <li>✅ **Self-hosted or public instance support**</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold">💡 How It Works</h2>
          <p className="mt-2 text-gray-400">
            Users can create secure **voice discussion rooms**, invite
            participants, and optionally conduct polls or votes within the
            platform. The system is designed to operate without a central
            authority, ensuring privacy and free speech.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold">🌍 Get Involved</h2>
          <p className="mt-2 text-gray-400">
            This project is open-source, and contributions are welcome! You can
            check out the source code, report issues, and suggest features.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <Link href="/">
          <button className="bg-purple-600 text-white px-6 py-2 rounded-md hover:bg-purple-700 hover:cursor-pointer">
            Back to Home
          </button>
        </Link>
      </div>
    </div>
  );
}
