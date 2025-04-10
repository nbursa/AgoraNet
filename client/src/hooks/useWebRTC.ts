"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const SIGNALING_SERVER =
  process.env.NEXT_PUBLIC_SIGNALING_SERVER ||
  (typeof window !== "undefined" ? "ws://localhost:8081/ws" : "");

type SharedMediaType = "image" | "pdf";

export type VoteResult = {
  question: string;
  yes: number;
  no: number;
  total: number;
};

type SignalMessage =
  | { type: "init"; userId: string }
  | { type: "join"; roomId: string; isCreator: boolean }
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

  const [isHost, setIsHost] = useState(false);

  const LOCAL_STORAGE_KEY = `voteHistory-${roomId}`;

  useEffect(() => {
    const activeRooms = localStorage.getItem("activeRooms");
    const isInRoom = activeRooms && JSON.parse(activeRooms).includes(roomId);
    setIsHost(localUserId === hostId && isInRoom);
  }, [localUserId, hostId, roomId]);

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
      if (isHost && !activeVote) {
        send({ type: "create-vote", question });
        setActiveVote(question);
        setCurrentVotes({});
      }
    },
    [isHost, activeVote, send]
  );

  const endVote = useCallback(() => {
    if (isHost && activeVote) {
      send({ type: "end-vote" });
      setActiveVote(null);
      setCurrentVotes({});
    }
  }, [isHost, activeVote, send]);

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

      if (existing) {
        console.warn("⚠️ Tried to create duplicate peer for", userId);
        return existing;
      }

      const peer = new RTCPeerConnection();
      console.log(
        "🔧 Created peer for",
        userId,
        initiator ? "(initiator)" : "(receiver)"
      );

      if (!stream) {
        console.warn("🛑 No local stream yet, skipping peer setup for", userId);

        return peer;
      }

      stream.getTracks().forEach((track) => {
        console.log(
          "🎙️ Adding local track to peer:",
          userId,
          track.kind,
          peer.connectionState
        );
        peer.addTrack(track, stream);
      });

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("📡 Sending ICE candidate to", userId);

          send({
            type: "ice-candidate",
            userId,
            candidate: event.candidate.toJSON(),
          });
        } else {
          console.log("📡 ICE candidate gathering finished for", userId);
        }
      };

      peer.ontrack = (event) => {
        console.log("🎧 Remote track received:", event.track, event.streams);
        console.log("📥 Received remote track from", userId, event.track.kind);
        const remoteStream =
          event.streams?.[0] || new MediaStream([event.track]);
        console.log("🎧 ontrack called, remote stream:", remoteStream);

        if (remoteStream) {
          setRemoteStreams((prev) => {
            const exists = prev.some((s) => s.id === userId);
            return exists
              ? prev
              : [...prev, { id: userId, stream: remoteStream }];
          });
        }
      };

      peer.onconnectionstatechange = () => {
        console.log("🔄 Connection state:", peer.connectionState);
      };

      peer.oniceconnectionstatechange = () => {
        console.log("📡 ICE state for", userId, peer.iceConnectionState);
        if (peer.iceConnectionState === "connected") {
          console.log("✅ Peer connected:", userId);
        }
        if (peer.iceConnectionState === "failed") {
          console.error("❌ ICE connection failed for", userId);
          peer.restartIce();
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
          })
          .catch((err) => {
            console.error("Error creating offer:", err);
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

  const pendingPeersRef = useRef<{ userId: string; initiator: boolean }[]>([]);

  useEffect(() => {
    if (!stream) return;

    if (pendingPeersRef.current.length > 0) {
      console.log(
        "🎯 Running deferred peers after stream init:",
        pendingPeersRef.current
      );
      pendingPeersRef.current.forEach(({ userId, initiator }) => {
        createPeer(userId, initiator);
      });
      pendingPeersRef.current = [];
    }
  }, [stream, createPeer]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const connect = async () => {
      try {
        const localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        localStream.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });

        console.log("🎙️ Local stream tracks:", localStream.getAudioTracks());

        // ⏳ Set stream and wait for propagation though React
        await new Promise<void>((resolve) => {
          setStream(localStream);
          setTimeout(resolve, 50);
        });

        Object.entries(peersRef.current).forEach(([userId, peer]) => {
          localStream.getTracks().forEach((track) => {
            console.log("🔁 Late adding track to peer:", userId, track.kind);
            peer.addTrack(track, localStream);
          });
        });

        console.log("🎤 Local stream tracks:", localStream.getTracks());
        console.log("🎙️ Audio tracks:", localStream.getAudioTracks());

        const storedId = localStorage.getItem("clientId") || "";
        const socket = new WebSocket(SIGNALING_SERVER);
        socketRef.current = socket;

        // ⏳ Wait for web socket
        await new Promise<void>((resolve, reject) => {
          if (socket.readyState === WebSocket.OPEN) return resolve();

          const onOpen = () => {
            socket.removeEventListener("open", onOpen);
            resolve();
          };

          const onError = (err: Event) => {
            socket.removeEventListener("error", onError);
            reject(err);
          };

          socket.addEventListener("open", onOpen);
          socket.addEventListener("error", onError);
        });

        console.info("✅ WebSocket connected");
        socket.send(JSON.stringify({ type: "init", userId: storedId }));

        socket.onmessage = async (event) => {
          const message: SignalMessage = JSON.parse(event.data);

          switch (message.type) {
            case "init":
              localStorage.setItem("clientId", message.userId);
              userIdRef.current = message.userId;
              setLocalUserId(message.userId);
              isJoiningRef.current = true;
              const activeRooms = localStorage.getItem("activeRooms");
              const isCreator =
                activeRooms && JSON.parse(activeRooms).includes(roomId);
              send({ type: "join", roomId, isCreator });
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

              message.users.forEach((userId) => {
                if (userId !== userIdRef.current && !peersRef.current[userId]) {
                  const shouldInitiate = userIdRef.current! > userId;

                  if (stream) {
                    createPeer(userId, shouldInitiate);
                  } else {
                    console.warn(
                      "⚠️ Stream not ready yet, deferring peer creation for",
                      userId
                    );
                    pendingPeersRef.current.push({
                      userId,
                      initiator: shouldInitiate,
                    });
                  }
                }
              });
              break;

            case "offer": {
              const peer =
                peersRef.current[message.userId] ||
                createPeer(message.userId, false);

              console.log("📥 Got offer. Peer state:", peer.signalingState);

              if (
                peer.signalingState !== "stable" &&
                peer.signalingState !== "have-local-offer"
              ) {
                console.warn(
                  "⛔ Offer received in invalid state:",
                  peer.signalingState
                );
                return;
              }

              peer
                .setRemoteDescription(new RTCSessionDescription(message.offer))
                .then(() => peer.createAnswer())
                .then((answer) =>
                  peer.setLocalDescription(answer).then(() => answer)
                )
                .then((answer) => {
                  send({
                    type: "answer",
                    userId: message.userId,
                    answer,
                  });
                  console.log("📨 Sent answer to", message.userId);
                })
                .catch((err) => {
                  console.error("❌ Error during answer handshake:", err);
                });

              break;
            }

            case "answer":
              const peer = peersRef.current[message.userId];
              console.log("📥 Got answer. Peer state:", peer?.signalingState);

              if (peer && peer.signalingState === "have-local-offer") {
                peer
                  .setRemoteDescription(
                    new RTCSessionDescription(message.answer)
                  )
                  .catch((err) => {
                    console.error("❌ Failed to set remote answer:", err);
                  });
              } else {
                console.warn(
                  "⚠️ Skipping setRemoteDescription: peer in state",
                  peer?.signalingState
                );
              }
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

        socket.onclose = () => {
          console.info("🛑 WebSocket closed. Reconnecting...");
          setTimeout(connect, 1000);
        };

        socket.onerror = (err) => {
          console.error("🔥 WebSocket error:", err);
          socket.close();
        };
      } catch (err) {
        console.error("❌ Failed to connect:", err);
      }
    };

    connect();
    return () => {
      leaveRoom();
    };
  }, [roomId, createPeer, leaveRoom, send, LOCAL_STORAGE_KEY, stream]);

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
