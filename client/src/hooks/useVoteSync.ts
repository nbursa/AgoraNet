"use client";

type VoteHistoryItem = {
  question: string;
  yesCount: number;
  noCount: number;
  totalVotes: number;
};

type VoteSyncPayload = {
  roomId: string;
  question: string;
  yes: number;
  no: number;
  total: number;
  username: string;
};

export async function syncVoteHistoryToDB(username: string): Promise<void> {
  const token = localStorage.getItem("token");
  const activeRooms: string[] = JSON.parse(
    localStorage.getItem("activeRooms") || "[]"
  );

  const data: VoteSyncPayload[] = activeRooms.flatMap((roomId) => {
    const history: VoteHistoryItem[] = JSON.parse(
      localStorage.getItem(`voteHistory-${roomId}`) || "[]"
    );
    return history.map((vote) => ({
      roomId,
      question: vote.question,
      yes: vote.yesCount,
      no: vote.noCount,
      total: vote.totalVotes,
      username,
    }));
  });

  const response = await fetch("/api/votes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    console.error("❌ Failed to sync votes:", await response.text());
  } else {
    console.log("✅ Vote results synced");
  }
}
