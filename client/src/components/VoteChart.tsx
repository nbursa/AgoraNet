"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type VoteChartProps = {
  roomId: string;
  votes: {
    question: string;
    yesCount: number;
    noCount: number;
    totalVotes: number;
  }[];
};

export default function VoteChart({ roomId, votes }: VoteChartProps) {
  const chartData = votes.map((vote) => ({
    question: vote.question,
    Yes: vote.yesCount,
    No: vote.noCount,
  }));

  return (
    <div className="bg-gray-800 p-4 rounded shadow-md mb-6">
      <h3 className="text-white text-lg font-semibold mb-2">
        🧮 Vote Summary: {roomId}
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="question" style={{ fontSize: "0.8rem" }} />
          <YAxis />
          <Tooltip />
          <Bar dataKey="Yes" fill="#10b981" />
          <Bar dataKey="No" fill="#ef4444" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
