"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const SIGNALING_SERVER =
  process.env.NEXT_PUBLIC_SIGNALING_SERVER || "ws://localhost:8081/ws";

type SharedMediaType = "image" | "pdf";

export type VoteResult = {
  question: string;
  yes: number;
  no: number;
  total: number;
};

type SignalMessage =
  | { type: "init"; userId: string }
  | { type: "join"; roomId: string }
  | {
      type: "room-state";
      users: string[];
      hostId: string;
      activeVote?: string | null;
      currentVotes?: Record<string, "yes" | "no">;
      sharedMedia?: {
        type: "shared-media";
        userId: string;
        url: string;
        mediaType: SharedMediaType;
      };
      voteHistory?: VoteResult[];
    }
  | { type: "offer"; userId: string; offer: RTCSessionDescriptionInit }
  | { type: "answer"; userId: string; answer: RTCSessionDescriptionInit }
  | { type: "ice-candidate"; userId: string; candidate: RTCIceCandidateInit }
  | { type: "leave"; userId: string }
  | {
      type: "share-media";
      url: string;
      mediaType: SharedMediaType;
    }
  | { type: "create-vote"; question: string }
  | { type: "vote"; userId: string; value: "yes" | "no" }
  | { type: "end-vote" }
  | { type: "speaking"; userId: string; isSpeaking: boolean };

type RemoteStreamEntry = {
  id: string;
  stream: MediaStream;
};

export function useWebRTC(roomId: string) {
  const router = useRouter();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreamEntry[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [sharedMediaUrl, setSharedMediaUrl] = useState<string | null>(null);
  const [sharedMediaType, setSharedMediaType] =
    useState<SharedMediaType | null>(null);
  const [localUserId, setLocalUserId] = useState<string | null>(null);
  const [activeVote, setActiveVote] = useState<string | null>(null);
  const [currentVotes, setCurrentVotes] = useState<
    Record<string, "yes" | "no">
  >({});
  const [hostId, setHostId] = useState<string | null>(null);
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());
  const [voteHistory, setVoteHistory] = useState<VoteResult[]>([]);

  const socketRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<{ [id: string]: RTCPeerConnection }>({});
  const userIdRef = useRef<string | null>(null);
  const isJoiningRef = useRef(false);
  const initializedRef = useRef(false);

  const LOCAL_STORAGE_KEY = `voteHistory-${roomId}`;

  const send = useCallback((msg: SignalMessage) => {
    const json = JSON.stringify(msg);
    const ws = socketRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(json);
    }
  }, []);

  const sendSpeakingStatus = useCallback(
    (isSpeaking: boolean) => {
      if (localUserId) {
        send({ type: "speaking", userId: localUserId, isSpeaking });
      }
    },
    [send, localUserId]
  );

  const sendSharedMedia = useCallback(
    (url: string | null, mediaType: SharedMediaType = "image") => {
      send({ type: "share-media", url: url || "", mediaType });
    },
    [send]
  );

  const createVote = useCallback(
    (question: string) => {
      if (localUserId === hostId && !activeVote) {
        send({ type: "create-vote", question });
        setActiveVote(question);
        setCurrentVotes({});
      }
    },
    [send, localUserId, hostId, activeVote]
  );

  const endVote = useCallback(() => {
    if (localUserId === hostId && activeVote) {
      send({ type: "end-vote" });
      setActiveVote(null);
      setCurrentVotes({});
    }
  }, [send, localUserId, hostId, activeVote]);

  const vote = useCallback(
    (value: "yes" | "no") => {
      if (localUserId && activeVote) {
        send({ type: "vote", userId: localUserId, value });
      }
    },
    [send, localUserId, activeVote]
  );

  const createPeer = useCallback(
    (userId: string, initiator: boolean): RTCPeerConnection => {
      const existing = peersRef.current[userId];
      if (existing) return existing;

      const peer = new RTCPeerConnection();

      if (stream) {
        stream.getTracks().forEach((track) => {
          peer.addTrack(track, stream);
        });
      }

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          send({
            type: "ice-candidate",
            userId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      peer.ontrack = (event) => {
        const remoteStream = event.streams[0];
        if (remoteStream) {
          setRemoteStreams((prev) => {
            const exists = prev.some((s) => s.id === userId);
            return exists
              ? prev
              : [...prev, { id: userId, stream: remoteStream }];
          });
        }
      };

      if (initiator) {
        peer
          .createOffer()
          .then((offer) => peer.setLocalDescription(offer))
          .then(() => {
            if (peer.localDescription) {
              send({ type: "offer", userId, offer: peer.localDescription });
            }
          });
      }

      peersRef.current[userId] = peer;
      return peer;
    },
    [stream, send]
  );

  const leaveRoom = useCallback(() => {
    if (!isJoiningRef.current || !userIdRef.current) return;

    send({ type: "leave", userId: userIdRef.current });

    Object.values(peersRef.current).forEach((peer) => peer.close());
    peersRef.current = {};
    setRemoteStreams([]);
    setParticipants([]);
    setSharedMediaUrl(null);
    setSharedMediaType(null);
    setActiveVote(null);
    setCurrentVotes({});
    setHostId(null);
    setSpeakingUsers(new Set());
    setVoteHistory([]);

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    isJoiningRef.current = false;
    userIdRef.current = null;
    setLocalUserId(null);

    router.push("/rooms");
  }, [send, router]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const connect = async () => {
      try {
        const localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        setStream(localStream);

        const storedId = localStorage.getItem("clientId") || "";
        const socket = new WebSocket(SIGNALING_SERVER);
        socketRef.current = socket;

        socket.onopen = () => {
          socket.send(JSON.stringify({ type: "init", userId: storedId }));
        };

        socket.onmessage = async (event) => {
          const message: SignalMessage = JSON.parse(event.data);

          switch (message.type) {
            case "init":
              localStorage.setItem("clientId", message.userId);
              userIdRef.current = message.userId;
              setLocalUserId(message.userId);
              isJoiningRef.current = true;
              send({ type: "join", roomId });
              break;

            case "room-state":
              setParticipants(message.users);
              setHostId(message.hostId);
              setActiveVote(message.activeVote || null);
              setCurrentVotes(message.currentVotes || {});
              if (message.sharedMedia) {
                setSharedMediaUrl(message.sharedMedia.url);
                setSharedMediaType(message.sharedMedia.mediaType);
              }

              if (message.voteHistory && userIdRef.current === message.hostId) {
                const combined = [
                  ...message.voteHistory,
                  ...(JSON.parse(
                    localStorage.getItem(LOCAL_STORAGE_KEY) || "[]"
                  ) as VoteResult[]),
                ];
                const deduped = Array.from(
                  new Map(combined.map((v) => [v.question, v])).values()
                );
                setVoteHistory(deduped);
                localStorage.setItem(
                  LOCAL_STORAGE_KEY,
                  JSON.stringify(deduped)
                );
              } else {
                setVoteHistory([]);
              }
              break;

            case "offer": {
              const peer =
                peersRef.current[message.userId] ||
                createPeer(message.userId, false);
              await peer.setRemoteDescription(
                new RTCSessionDescription(message.offer)
              );
              const answer = await peer.createAnswer();
              await peer.setLocalDescription(answer);
              send({ type: "answer", userId: message.userId, answer });
              break;
            }

            case "answer":
              peersRef.current[message.userId]?.setRemoteDescription(
                new RTCSessionDescription(message.answer)
              );
              break;

            case "ice-candidate":
              peersRef.current[message.userId]?.addIceCandidate(
                new RTCIceCandidate(message.candidate)
              );
              break;

            case "leave":
              peersRef.current[message.userId]?.close();
              delete peersRef.current[message.userId];
              setRemoteStreams((prev) =>
                prev.filter((s) => s.id !== message.userId)
              );
              setParticipants((prev) =>
                prev.filter((id) => id !== message.userId)
              );
              setSpeakingUsers((prev) => {
                const updated = new Set(prev);
                updated.delete(message.userId);
                return updated;
              });
              break;

            case "speaking":
              setSpeakingUsers((prev) => {
                const updated = new Set(prev);
                if (message.isSpeaking) {
                  updated.add(message.userId);
                } else {
                  updated.delete(message.userId);
                }
                return updated;
              });
              break;
          }
        };

        socket.onclose = () => console.warn("🛑 WebSocket closed.");
        socket.onerror = (err) => console.error("🔥 WebSocket error:", err);
      } catch (err) {
        console.error("❌ Failed to connect:", err);
      }
    };

    connect();
    return () => {
      leaveRoom();
    };
  }, [roomId, createPeer, leaveRoom, send, LOCAL_STORAGE_KEY]);

  return {
    stream,
    remoteStreams,
    leaveRoom,
    participants,
    sendSharedMedia,
    sharedMediaUrl,
    sharedMediaType,
    localUserId,
    createVote,
    endVote,
    vote,
    activeVote,
    currentVotes,
    hostId,
    speakingUsers,
    setSpeakingUsers,
    sendSpeakingStatus,
    voteHistory,
  };
}
