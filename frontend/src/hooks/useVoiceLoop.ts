import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceInputMode } from './useLloydSocket';

interface UseVoiceLoopOptions {
  mode: VoiceInputMode;
  onAudioChunk: (pcm16Buffer: ArrayBuffer, mode: VoiceInputMode) => void;
  onPttStart: () => void;
  onPttRelease: () => void;
}

function downsampleTo16kHzPcm16(
  inputFloat32: Float32Array,
  inputSampleRate: number
): ArrayBuffer {
  const targetRate = 16000;
  if (inputSampleRate === targetRate) {
    const out = new Int16Array(inputFloat32.length);
    for (let i = 0; i < inputFloat32.length; i++) {
      const s = Math.max(-1, Math.min(1, inputFloat32[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out.buffer;
  }

  const ratio = inputSampleRate / targetRate;
  const newLength = Math.round(inputFloat32.length / ratio);
  const result = new Int16Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < inputFloat32.length; i++) {
      accum += inputFloat32[i];
      count++;
    }
    const sample = count > 0 ? accum / count : 0;
    const clamped = Math.max(-1, Math.min(1, sample));
    result[offsetResult] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result.buffer;
}

export function useVoiceLoop({
  mode,
  onAudioChunk,
  onPttStart,
  onPttRelease,
}: UseVoiceLoopOptions) {
  const [micEnabled, setMicEnabled] = useState<boolean>(false);
  const [isPttHeld, setIsPttHeld] = useState<boolean>(false);
  const [micLevel, setMicLevel] = useState<number>(0);
  const [micError, setMicError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const modeRef = useRef<VoiceInputMode>(mode);
  const pttHeldRef = useRef<boolean>(false);
  const micEnabledRef = useRef<boolean>(false);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    pttHeldRef.current = isPttHeld;
  }, [isPttHeld]);

  useEffect(() => {
    micEnabledRef.current = micEnabled;
  }, [micEnabled]);

  const startMicrophone = useCallback(async () => {
    if (streamRef.current) {
      setMicEnabled(true);
      return true;
    }
    try {
      setMicError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;

      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        if (!micEnabledRef.current) return;
        const inputData = event.inputBuffer.getChannelData(0);

        let sumSq = 0;
        for (let i = 0; i < inputData.length; i++) {
          sumSq += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sumSq / inputData.length);
        setMicLevel(Math.min(1, rms * 5.2));

        const currentMode = modeRef.current;
        if (currentMode === 'vad' || (currentMode === 'ptt' && pttHeldRef.current)) {
          const pcm16Buf = downsampleTo16kHzPcm16(inputData, ctx.sampleRate);
          onAudioChunk(pcm16Buf, currentMode);
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      setMicEnabled(true);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microphone permission denied';
      setMicError(msg);
      setMicEnabled(false);
      return false;
    }
  }, [onAudioChunk]);

  const stopMicrophone = useCallback(() => {
    setMicEnabled(false);
    setMicLevel(0);
    setIsPttHeld(false);
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const toggleMicrophone = useCallback(async () => {
    if (micEnabled) {
      stopMicrophone();
    } else {
      await startMicrophone();
    }
  }, [micEnabled, startMicrophone, stopMicrophone]);

  const beginPushToTalk = useCallback(async () => {
    if (!micEnabledRef.current) {
      const ok = await startMicrophone();
      if (!ok) return;
    }
    if (!pttHeldRef.current) {
      pttHeldRef.current = true;
      setIsPttHeld(true);
      onPttStart();
    }
  }, [onPttStart, startMicrophone]);

  const endPushToTalk = useCallback(() => {
    if (pttHeldRef.current) {
      pttHeldRef.current = false;
      setIsPttHeld(false);
      onPttRelease();
    }
  }, [onPttRelease]);

  // Global Spacebar Push-to-Talk listener when mode === 'ptt'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (modeRef.current !== 'ptt') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        beginPushToTalk();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (modeRef.current !== 'ptt') return;
      if (e.code === 'Space') {
        e.preventDefault();
        endPushToTalk();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [beginPushToTalk, endPushToTalk]);

  useEffect(() => {
    return () => {
      stopMicrophone();
    };
  }, [stopMicrophone]);

  return {
    micEnabled,
    micLevel,
    micError,
    isPttHeld,
    startMicrophone,
    stopMicrophone,
    toggleMicrophone,
    beginPushToTalk,
    endPushToTalk,
  };
}
