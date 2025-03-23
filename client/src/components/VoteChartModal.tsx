"use client";

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTranslations } from "next-intl";

type VoteHistoryItem = {
  question: string;
  totalVotes: number;
  yesCount: number;
  noCount: number;
};

type Props = {
  roomId: string;
  votes: VoteHistoryItem[];
  onClose: () => void;
};

export default function VoteChartModal({ roomId, votes, onClose }: Props) {
  const t = useTranslations("modal");

  return (
    <Dialog
      open={true}
      onClose={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />

      <DialogPanel className="relative bg-gray-900 rounded-xl shadow-xl p-6 max-w-4xl w-full z-10 overflow-hidden max-h-[80vh]">
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-gray-900 z-10">
          <DialogTitle className="text-xl font-semibold text-white">
            {t("title")} <span className="text-green-400">{roomId}</span>
          </DialogTitle>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-sm"
          >
            ✖ {t("close")}
          </button>
        </div>

        <div
          className="overflow-y-auto space-y-6 pr-2"
          style={{ maxHeight: "calc(80vh - 3rem)" }}
        >
          {votes.length === 0 ? (
            <div className="text-center text-gray-400 py-8">{t("empty")}</div>
          ) : (
            votes.map((vote, index) => {
              const notVoted = Math.max(
                vote.totalVotes - vote.yesCount - vote.noCount,
                0
              );
              const chartData = [
                { name: t("labels.yes"), value: vote.yesCount },
                { name: t("labels.no"), value: vote.noCount },
                { name: t("labels.notVoted"), value: notVoted },
              ];

              return (
                <div
                  key={index}
                  className="bg-gray-800 rounded-lg p-4 text-sm text-gray-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="flex-1">
                    <p className="mb-1">
                      <span className="font-semibold text-white">
                        #{index + 1}:
                      </span>{" "}
                      {vote.question}
                    </p>
                    <p>
                      ✅ {t("labels.yes")}: {vote.yesCount} | ❌{" "}
                      {t("labels.no")}: {vote.noCount} | 👤{" "}
                      {t("labels.notVoted")}: {notVoted} | 👥{" "}
                      {t("labels.total")}: {vote.totalVotes}
                    </p>
                  </div>

                  <div className="w-full sm:w-64 h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <XAxis dataKey="name" tick={{ fill: "#ccc" }} />
                        <YAxis allowDecimals={false} tick={{ fill: "#ccc" }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1f2937",
                            border: "none",
                          }}
                        />
                        <Bar dataKey="value" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogPanel>
    </Dialog>
  );
}
