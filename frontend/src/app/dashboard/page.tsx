"use client";

export default function DashboardPage() {
  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="flex flex-col items-center justify-center min-h-full max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-4">📊 Dashboard</h1>

        <p className="text-gray-400 text-center mb-6">
          Welcome to your decentralized dashboard. Here you can monitor your
          rooms, votes, shared files, and manage your presence in the plenum.
        </p>

        {/* Example section */}
        <div className="w-full grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <div className="bg-gray-800 p-4 rounded-lg shadow-md text-white">
            <h2 className="text-xl font-semibold mb-2">Active Rooms</h2>
            <p className="text-gray-400">You have 3 ongoing discussions.</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg shadow-md text-white">
            <h2 className="text-xl font-semibold mb-2">Recent Votes</h2>
            <p className="text-gray-400">2 new results available.</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg shadow-md text-white">
            <h2 className="text-xl font-semibold mb-2">Shared Files</h2>
            <p className="text-gray-400">5 new documents shared this week.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
