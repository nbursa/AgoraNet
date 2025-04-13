import { useEffect } from "react";

export const useSpeakingAnalyzer = (
  userId: string,
  mediaStream: MediaStream,
  isLocal: boolean,
  analyserRefs: React.MutableRefObject<Record<string, AnalyserNode>>,
  audioContextRef: React.MutableRefObject<AudioContext | null>,
  sendSpeakingStatus: (isSpeaking: boolean) => void
) => {
  useEffect(() => {
    if (!mediaStream || analyserRefs.current[userId]) return;

    const init = async () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") await ctx.resume();

      const source = ctx.createMediaStreamSource(mediaStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);
      analyserRefs.current[userId] = analyser;

      let prevSpeaking = false;
      const detect = () => {
        analyser.getByteFrequencyData(dataArray);
        const volume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const isSpeaking = volume > 5;

        if (isLocal) {
          const track = mediaStream.getAudioTracks()[0];
          const isMicEnabled = track?.enabled;
          const finalSpeaking = isMicEnabled && isSpeaking;
          if (finalSpeaking !== prevSpeaking) {
            sendSpeakingStatus(finalSpeaking);
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
  }, [
    userId,
    mediaStream,
    analyserRefs,
    audioContextRef,
    isLocal,
    sendSpeakingStatus,
  ]);
};
