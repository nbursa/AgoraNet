"use client";

import { useEffect, useRef } from "react";

type Props = {
  userId: string;
  stream: MediaStream;
  isLocal: boolean;
  sendSpeakingStatus?: (isSpeaking: boolean) => void;
  onAnalyserReady?: (analyser: AnalyserNode) => void;
};

export const SpeakingAnalyzer: React.FC<Props> = ({
  userId,
  stream,
  isLocal,
  sendSpeakingStatus,
  onAnalyserReady,
}) => {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!stream || analyserRef.current) return;

    // if (onAnalyserReady) onAnalyserReady(analyser);

    const init = async () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") await ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);
      analyserRef.current = analyser;

      // const analyser = audioContext.createAnalyser();
      if (onAnalyserReady) onAnalyserReady(analyser);

      let prevSpeaking = false;

      const detect = () => {
        analyser.getByteFrequencyData(dataArray);
        const volume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const isSpeaking = volume > 5;

        if (isLocal) {
          const track = stream.getAudioTracks()[0];
          const isMicEnabled = track?.enabled;
          const finalSpeaking = isMicEnabled && isSpeaking;
          if (finalSpeaking !== prevSpeaking) {
            sendSpeakingStatus?.(finalSpeaking);
            prevSpeaking = finalSpeaking;
          }
        } else {
          if (isSpeaking && !prevSpeaking) {
            window.dispatchEvent(
              new CustomEvent("remote-speaking", { detail: { userId } })
            );
            prevSpeaking = true;
          } else if (!isSpeaking && prevSpeaking) {
            prevSpeaking = false;
          }
        }

        requestAnimationFrame(detect);
      };

      detect();
    };

    init();
  }, [userId, stream, isLocal, sendSpeakingStatus, onAnalyserReady]);

  return null;
};
