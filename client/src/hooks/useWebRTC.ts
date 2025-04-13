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
  const localStreamRef = useRef<MediaStream | null>(null);
  const deferredPeersRef = useRef<Set<string>>(new Set());

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

  useEffect(() => {
    console.log("🔁 remoteStreams updated from hook:", remoteStreams);
  }, [remoteStreams]);

  const createPeer = useCallback(
    (userId: string, initiator: boolean): RTCPeerConnection => {
      if (userId === userIdRef.current) return peersRef.current[userId]!;

      if (peersRef.current[userId]) return peersRef.current[userId];

      const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      let negotiationLock = false;

      peer.onnegotiationneeded = async () => {
        if (negotiationLock) return;
        negotiationLock = true;

        try {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          send({ type: "offer", userId, offer });
        } catch (err) {
          console.error("❌ Negotiation failed:", err);
        } finally {
          setTimeout(() => {
            negotiationLock = false;
          }, 1000);
        }
      };

      peer.onicecandidate = (e) => {
        if (e.candidate) {
          send({
            type: "ice-candidate",
            userId,
            candidate: e.candidate.toJSON(),
          });
        }
      };

      peer.ontrack = (event) => {
        console.log("🔊 ontrack fired for", userId, event);
        const stream = event.streams?.[0];
        if (!stream) return;
        setRemoteStreams((prev) => {
          const exists = prev.some(
            (s) => s.id === userId && s.stream.id === stream.id
          );
          if (exists) return prev;
          return [
            ...prev.filter((s) => s.id !== userId),
            { id: userId, stream },
          ];
        });
      };

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          const alreadySent = peer
            .getSenders()
            .some((s) => s.track?.id === track.id);
          if (!alreadySent) {
            console.log("🎤 Adding local track to peer:", userId, track.kind);
            peer.addTrack(track, localStreamRef.current!);
          }
        });
      }

      peersRef.current[userId] = peer;

      if (initiator) {
        setTimeout(() => {
          console.log("📞 onnegotiationneeded trigger (noop)");
        }, 0);
      }

      return peer;
    },
    [send]
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
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        localStreamRef.current = localStream;

        localStream.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });

        console.log("🎙️ Local stream tracks:", localStream.getAudioTracks());

        setStream(localStream);

        await new Promise<void>((resolve) => {
          Object.entries(peersRef.current).forEach(([userId, peer]) => {
            peer.getReceivers().forEach((receiver) => {
              const track = receiver.track;
              if (track) {
                const newStream = new MediaStream([track]);
                setRemoteStreams((prev) => {
                  const exists = prev.find((s) => s.id === userId);
                  if (exists) return prev;
                  return [...prev, { id: userId, stream: newStream }];
                });
                console.log("REMOTESTREAMS-2:", remoteStreams);
              }
            });
          });

          console.log("✅ setStream called");

          Object.entries(peersRef.current).forEach(([userId, peer]) => {
            if (!peer.getSenders().length && localStream) {
              localStream.getTracks().forEach((track) => {
                console.log(
                  "🔁 [RETRY] Adding track late for",
                  userId,
                  track.kind
                );
                peer.addTrack(track, localStream);
              });
            }
          });

          setTimeout(() => {
            console.log("✅ setStream done, stream should now be available");
            resolve();
          }, 100);
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

              const waitForStream = () =>
                new Promise<void>((resolve) => {
                  const check = () => {
                    if (
                      localStreamRef.current &&
                      localStreamRef.current.active
                    ) {
                      resolve();
                      deferredPeersRef.current.forEach((uid) => {
                        console.log(
                          "🔁 Creating deferred peer after stream ready:",
                          uid
                        );
                        const shouldInitiate = userIdRef.current! > uid;
                        createPeer(uid, shouldInitiate);
                      });
                      deferredPeersRef.current.clear();
                    } else {
                      setTimeout(check, 100);
                    }
                  };
                  check();
                });

              await waitForStream();

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
                    deferredPeersRef.current.add(userId);
                    console.warn(
                      "⚠️ Stream not ready yet, deferring peer creation for",
                      userId
                    );
                  }
                }
              });

              // 🧠 FORCE PEER SYNC after everyone joined
              setTimeout(() => {
                const myId = userIdRef.current;
                if (!myId) return;

                message.users.forEach((otherId) => {
                  if (otherId !== myId) {
                    const peer = peersRef.current[otherId];
                    if (peer && peer.connectionState !== "connected") {
                      console.log("🔁 Retrying peer negotiation with", otherId);
                      peer
                        .createOffer()
                        .then((offer) => peer.setLocalDescription(offer))
                        .then(() => {
                          if (peer.localDescription) {
                            send({
                              type: "offer",
                              userId: otherId,
                              offer: peer.localDescription,
                            });
                          }
                        });
                    }
                  }
                });
              }, 1000);
              break;

            case "offer": {
              if (message.userId === userIdRef.current) {
                console.warn("🛑 Skipping self offer from", message.userId);
                return;
              }

              const peer =
                peersRef.current[message.userId] ||
                createPeer(message.userId, false);

              console.log("📥 Got offer. Peer state:", peer.signalingState);

              if (peer.signalingState === "have-local-offer") {
                console.warn("⏪ Rolling back before applying new offer");
                await peer.setLocalDescription({ type: "rollback" });
              }

              await peer.setRemoteDescription(
                new RTCSessionDescription(message.offer)
              );

              const answer = await peer.createAnswer();
              await peer.setLocalDescription(answer);

              send({
                type: "answer",
                userId: message.userId,
                answer,
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
              if (message.userId === userIdRef.current) {
                console.warn(
                  "🛑 Skipping self ICE candidate from",
                  message.userId
                );
                return;
              }

              const targetPeer = peersRef.current[message.userId];
              if (
                targetPeer?.remoteDescription &&
                targetPeer.remoteDescription.type
              ) {
                targetPeer
                  .addIceCandidate(new RTCIceCandidate(message.candidate))
                  .catch(console.error);
              } else {
                console.warn(
                  "🧊 Skipping ICE candidate, remoteDescription not ready for",
                  message.userId
                );
              }
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
  }, [
    roomId,
    createPeer,
    leaveRoom,
    send,
    LOCAL_STORAGE_KEY,
    stream,
    remoteStreams,
  ]);

  useEffect(() => {
    const retryDeferredPeers = () => {
      const myId = userIdRef.current;
      if (!stream || !myId) return;

      participants.forEach((uid) => {
        if (uid === myId) return;

        if (!peersRef.current[uid]) {
          console.log("🔁 Retrying deferred peer for", uid);
          const shouldInitiate = myId > uid;
          createPeer(uid, shouldInitiate);
        }
      });
    };

    const interval = setInterval(retryDeferredPeers, 1500);
    return () => clearInterval(interval);
  }, [participants, stream, createPeer]);

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
