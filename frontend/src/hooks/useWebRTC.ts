"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const SIGNALING_SERVER =
  process.env.NEXT_PUBLIC_SIGNALING_SERVER || "ws://localhost:8081/ws";

type SignalMessage =
  | { type: "join"; roomId: string }
  | { type: "init"; userId: string }
  | { type: "user-joined"; userId: string }
  | { type: "offer"; userId: string; offer: RTCSessionDescriptionInit }
  | { type: "answer"; userId: string; answer: RTCSessionDescriptionInit }
  | { type: "ice-candidate"; userId: string; candidate: RTCIceCandidateInit }
  | { type: "leave"; userId: string };

type RemoteStreamEntry = {
  id: string;
  stream: MediaStream;
};

export function useWebRTC(roomId: string) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreamEntry[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<{ [id: string]: RTCPeerConnection }>({});
  const userIdRef = useRef<string | null>(null);
  const hasLeft = useRef(false);
  const isConnecting = useRef(false);

  const send = useCallback((msg: SignalMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    } else {
      console.warn("❌ WebSocket not open. Skipped:", msg);
    }
  }, []);

  const createPeer = useCallback(
    (userId: string, initiator: boolean): RTCPeerConnection => {
      if (peersRef.current[userId]) return peersRef.current[userId];

      const peer = new RTCPeerConnection();

      stream?.getTracks().forEach((track) => {
        peer.addTrack(track, stream!);
      });

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
            const alreadyExists = prev.some(
              (s) => s.stream.id === remoteStream.id
            );
            if (alreadyExists) return prev;
            return [...prev, { id: userId, stream: remoteStream }];
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
    if (hasLeft.current) return;
    hasLeft.current = true;

    send({ type: "leave", userId: userIdRef.current || "self" });
    setTimeout(() => socketRef.current?.close(), 100);

    Object.values(peersRef.current).forEach((peer) => peer.close());
    peersRef.current = {};
    setRemoteStreams([]);
  }, [send]);

  useEffect(() => {
    let cancelled = false;
    hasLeft.current = false;

    if (socketRef.current || isConnecting.current) return;
    isConnecting.current = true;

    const tryConnect = async () => {
      try {
        const localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (cancelled) return;
        setStream(localStream);
        console.log("🎙️ Got local audio stream");

        socketRef.current = new WebSocket(SIGNALING_SERVER);

        socketRef.current.onopen = () => {
          console.log("✅ Connected to signaling server");
        };

        socketRef.current.onmessage = async (event) => {
          const message: SignalMessage = JSON.parse(event.data);
          console.log("📨 Message:", message);

          switch (message.type) {
            case "init":
              userIdRef.current = message.userId;
              send({ type: "join", roomId });
              break;

            case "user-joined":
              if (message.userId !== userIdRef.current) {
                createPeer(message.userId, true);
              }
              break;

            case "offer": {
              const peer = createPeer(message.userId, false);
              await peer.setRemoteDescription(
                new RTCSessionDescription(message.offer)
              );
              const answer = await peer.createAnswer();
              await peer.setLocalDescription(answer);
              send({ type: "answer", userId: message.userId, answer });
              break;
            }

            case "answer": {
              const peer = peersRef.current[message.userId];
              if (peer) {
                console.log("🤝 Answer from", message.userId);
                await peer.setRemoteDescription(
                  new RTCSessionDescription(message.answer)
                );
              }
              break;
            }

            case "ice-candidate": {
              const peer = peersRef.current[message.userId];
              if (peer && message.candidate) {
                try {
                  await peer.addIceCandidate(
                    new RTCIceCandidate(message.candidate)
                  );
                } catch (e) {
                  console.warn("❌ Failed to add ICE candidate", e);
                }
              }
              break;
            }

            case "leave": {
              const peer = peersRef.current[message.userId];
              if (peer) peer.close();
              delete peersRef.current[message.userId];
              setRemoteStreams((prev) =>
                prev.filter((s) => s.id !== message.userId)
              );
              console.log(`👋 Peer ${message.userId} left`);
              break;
            }
          }
        };

        socketRef.current.onerror = (e) => {
          console.error("WebSocket error:", e);
        };

        socketRef.current.onclose = () => {
          console.warn("🔌 WebSocket closed");
          isConnecting.current = false;
        };
      } catch (err) {
        console.error("❌ Error in tryConnect:", err);
        isConnecting.current = false;
      }
    };

    tryConnect();

    return () => {
      cancelled = true;
      leaveRoom();
      isConnecting.current = false;
    };
  }, [roomId, createPeer, leaveRoom, send]);

  return { stream, remoteStreams, leaveRoom };
}
