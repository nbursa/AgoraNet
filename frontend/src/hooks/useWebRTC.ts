"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const SIGNALING_SERVER =
  process.env.NEXT_PUBLIC_SIGNALING_SERVER || "http://localhost:8080";

export function useWebRTC(roomId: string) {
  const [peers, setPeers] = useState<{ [id: string]: RTCPeerConnection }>({});
  const [stream, setStream] = useState<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    async function start() {
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      setStream(localStream);

      // Initialize socket connection
      if (!socketRef.current) {
        socketRef.current = io(SIGNALING_SERVER);
      }
      const socket = socketRef.current;

      socket.emit("join-room", roomId);

      socket.on("user-joined", async (userId: string) => {
        const peer = new RTCPeerConnection();
        localStream
          .getTracks()
          .forEach((track) => peer.addTrack(track, localStream));

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit("offer", { userId, offer });

        peer.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("ice-candidate", {
              userId,
              candidate: event.candidate,
            });
          }
        };

        setPeers((prev) => ({ ...prev, [userId]: peer }));
      });

      socket.on("offer", async ({ userId, offer }) => {
        const peer = new RTCPeerConnection();
        localStream
          .getTracks()
          .forEach((track) => peer.addTrack(track, localStream));

        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        socket.emit("answer", { userId, answer });

        peer.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("ice-candidate", {
              userId,
              candidate: event.candidate,
            });
          }
        };

        setPeers((prev) => ({ ...prev, [userId]: peer }));
      });

      socket.on("answer", ({ userId, answer }) => {
        if (peers[userId]) {
          peers[userId].setRemoteDescription(new RTCSessionDescription(answer));
        }
      });

      socket.on("ice-candidate", ({ userId, candidate }) => {
        if (peers[userId]) {
          peers[userId].addIceCandidate(new RTCIceCandidate(candidate));
        }
      });

      socket.on("user-left", (userId: string) => {
        setPeers((prev) => {
          const newPeers = { ...prev };
          if (newPeers[userId]) {
            newPeers[userId].close();
            delete newPeers[userId];
          }
          return newPeers;
        });
      });

      return () => {
        Object.values(peers).forEach((peer) => peer.close());
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      };
    }

    start();
  }, [peers, roomId]);

  return { stream, peers };
}
