"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const SIGNALING_SERVER =
  process.env.NEXT_PUBLIC_SIGNALING_SERVER || "ws://localhost:8081/ws";

type SignalMessage =
  | { type: "join"; roomId: string }
  | { type: "init"; userId: string }
  | { type: "participants"; users: string[] }
  | { type: "user-joined"; userId: string }
  | { type: "offer"; userId: string; offer: RTCSessionDescriptionInit }
  | { type: "answer"; userId: string; answer: RTCSessionDescriptionInit }
  | { type: "ice-candidate"; userId: string; candidate: RTCIceCandidateInit }
  | { type: "leave"; userId: string }
  | { type: "shared-image"; userId: string; imageUrl: string }
  | { type: "share-image"; imageUrl: string };

type RemoteStreamEntry = {
  id: string;
  stream: MediaStream;
};

let wasInitialized = false;

export function useWebRTC(roomId: string): {
  stream: MediaStream | null;
  remoteStreams: RemoteStreamEntry[];
  leaveRoom: () => void;
  participants: string[];
  sendSharedImage: (imageUrl: string) => void;
  sharedImageUrl: string | null;
  localUserId: string | null;
} {
  const router = useRouter();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreamEntry[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [sharedImageUrl, setSharedImageUrl] = useState<string | null>(null);
  const [localUserId, setLocalUserId] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<{ [id: string]: RTCPeerConnection }>({});
  const userIdRef = useRef<string | null>(null);
  const isJoiningRef = useRef(false);

  const send = useCallback((msg: SignalMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    } else {
      console.warn("❌ WebSocket not open. Skipped:", msg);
    }
  }, []);

  // const sendSharedImage = useCallback(
  //   (imageUrl: string) => {
  //     send({ type: "share-image", imageUrl });
  //   },
  //   [send]
  // );
  const sendSharedImage = useCallback(
    (imageUrl: string | null) => {
      send({ type: "share-image", imageUrl: imageUrl || "" });
    },
    [send]
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
          })
          .catch(console.error);
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
    setSharedImageUrl(null);

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
    if (wasInitialized) return;

    wasInitialized = true;
    isJoiningRef.current = false;
    peersRef.current = {};
    setRemoteStreams([]);
    setParticipants([]);

    const connect = async () => {
      try {
        const localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        setStream(localStream);

        const socket = new WebSocket(SIGNALING_SERVER);
        socketRef.current = socket;

        socket.onopen = () => {
          console.log("✅ Connected to signaling server");
        };

        socket.onmessage = async (event) => {
          const message: SignalMessage = JSON.parse(event.data);

          switch (message.type) {
            case "init":
              userIdRef.current = message.userId;
              setLocalUserId(message.userId);
              isJoiningRef.current = true;
              send({ type: "join", roomId });
              break;

            case "participants":
              setParticipants(message.users);
              break;

            case "user-joined":
              if (message.userId !== userIdRef.current) {
                createPeer(message.userId, true);
              }
              break;

            case "shared-image":
              setSharedImageUrl(message.imageUrl || null);
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
              break;
          }
        };

        socket.onclose = () => {
          socketRef.current = null;
        };

        socket.onerror = (e) => {
          console.error("WebSocket error:", e);
        };
      } catch (err) {
        console.error("❌ Failed to connect:", err);
      }
    };

    connect();

    return () => {
      leaveRoom();
    };
  }, [roomId, createPeer, leaveRoom, send]);

  return {
    stream,
    remoteStreams,
    leaveRoom,
    participants,
    sendSharedImage,
    sharedImageUrl,
    localUserId,
  };
}
