import { useCallback, useEffect, useRef, useState } from 'react';

export type CompanionState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING';
export type VoiceInputMode = 'vad' | 'ptt';

export interface EngineDiag {
  status: string;
  ready: boolean;
  self_test_passed?: boolean;
  model_file: string;
  model_path: string;
  gguf_integrity?: boolean;
  gguf_detail?: string;
  file_detail?: string;
  metal_gpu_offload?: boolean;
  n_gpu_layers?: number;
  context_window?: number;
  sample_rate_hz?: number;
  vad_engine?: string;
  phonemizer?: string;
  load_time_ms: number;
  error: string | null;
}

export interface HardwareTelemetry {
  chip: string;
  arch: string;
  is_apple_silicon: boolean;
  metal_active: boolean;
  gpu_layers_offloaded: string;
  cpu_cores_total: number;
  cpu_usage_percent: number;
  thermal_state: string;
  memory: {
    process_rss_mb: number;
    system_used_gb: number;
    system_total_gb: number;
    system_percent: number;
  };
  latency: {
    avg_llm_ms: number;
    last_llm_ms: number;
    avg_stt_ms: number;
    last_stt_ms: number;
    avg_tts_ms: number;
    last_tts_ms: number;
    avg_tokens_per_sec: number;
    last_tokens_per_sec: number;
  };
  uptime_seconds: number;
}

export interface HealthSnapshot {
  status: string;
  all_checks_passed: boolean;
  creator: string;
  checks: {
    gguf_and_metal: { passed: boolean; detail: string; n_gpu_layers: number };
    whisper_stt_silent_test: { passed: boolean; detail: string };
    piper_tts_pulse_test: { passed: boolean; detail: string };
    system_prompt_validation: { passed: boolean; path: string; creator_verified: boolean };
  };
  engines: {
    llm: EngineDiag;
    stt: EngineDiag;
    tts: EngineDiag;
  };
  system_prompt: string;
  hardware: HardwareTelemetry;
}

export interface DialogueEntry {
  id: string;
  role: 'user' | 'lloyd';
  text: string;
  timestamp: number;
  latencyMs?: number;
  tokensPerSec?: number;
}

export interface AudioReactiveMetrics {
  mouthOpen: number;
  lowEnergy: number;
  midEnergy: number;
  highEnergy: number;
  frequencyBins: number[];
}

const BACKEND_HTTP = 'http://127.0.0.1:8000';
const BACKEND_WS = 'ws://127.0.0.1:8000/ws';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToInt16Array(base64: string): Int16Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

export function useLloydSocket() {
  const [connected, setConnected] = useState<boolean>(false);
  const [companionState, setCompanionState] = useState<CompanionState>('IDLE');
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [hardware, setHardware] = useState<HardwareTelemetry | null>(null);
  const [liveSubtitle, setLiveSubtitle] = useState<string>(
    'Systems initialized on Apple Silicon Metal. Ready when you are, Enes.'
  );
  const [lastUserTranscript, setLastUserTranscript] = useState<string>('');
  const [dialogueLog, setDialogueLog] = useState<DialogueEntry[]>([]);
  const [audioMetrics, setAudioMetrics] = useState<AudioReactiveMetrics>({
    mouthOpen: 0,
    lowEnergy: 0,
    midEnergy: 0,
    highEnergy: 0,
    frequencyBins: new Array(24).fill(0),
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const backendDoneRef = useRef<boolean>(true);
  const companionStateRef = useRef<CompanionState>('IDLE');

  useEffect(() => {
    companionStateRef.current = companionState;
  }, [companionState]);

  const ensureAudioContext = useCallback((): AudioContext => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass({ sampleRate: 22050 });
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.72;
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  const stopAllPlayback = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // Ignore already stopped sources
      }
    });
    activeSourcesRef.current.clear();
    if (audioCtxRef.current) {
      nextPlayTimeRef.current = audioCtxRef.current.currentTime;
    }
  }, []);

  const schedulePcmPlayback = useCallback(
    (pcmBase64: string, sampleRate = 22050) => {
      const ctx = ensureAudioContext();
      const analyser = analyserRef.current;
      if (!analyser) return;

      const pcmInt16 = base64ToInt16Array(pcmBase64);
      if (pcmInt16.length === 0) return;

      const float32 = new Float32Array(pcmInt16.length);
      for (let i = 0; i < pcmInt16.length; i++) {
        float32[i] = pcmInt16[i] / 32768.0;
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, sampleRate);
      audioBuffer.copyToChannel(float32, 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(analyser);

      const now = ctx.currentTime;
      const startAt = Math.max(now + 0.015, nextPlayTimeRef.current);
      nextPlayTimeRef.current = startAt + audioBuffer.duration;

      activeSourcesRef.current.add(source);
      setCompanionState('SPEAKING');

      source.onended = () => {
        activeSourcesRef.current.delete(source);
        if (activeSourcesRef.current.size === 0 && backendDoneRef.current) {
          setCompanionState((prev) => (prev === 'SPEAKING' ? 'IDLE' : prev));
        }
      };

      source.start(startAt);
    },
    [ensureAudioContext]
  );

  // Real-time 60fps Web Audio API frequency & amplitude analyzer loop for 3D lip-sync and visualizer
  useEffect(() => {
    let rafId = 0;
    const freqData = new Uint8Array(64);
    const timeData = new Uint8Array(64);

    const updateAudioMetrics = () => {
      const analyser = analyserRef.current;
      const isPlaying = activeSourcesRef.current.size > 0;

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(freqData);
        analyser.getByteTimeDomainData(timeData);

        let sumSquares = 0;
        for (let i = 0; i < timeData.length; i++) {
          const norm = (timeData[i] - 128) / 128;
          sumSquares += norm * norm;
        }
        const rms = Math.sqrt(sumSquares / timeData.length);

        let lowSum = 0;
        let midSum = 0;
        let highSum = 0;
        for (let i = 1; i <= 6; i++) lowSum += freqData[i];
        for (let i = 7; i <= 18; i++) midSum += freqData[i];
        for (let i = 19; i <= 36; i++) highSum += freqData[i];

        const lowEnergy = Math.min(1, lowSum / (6 * 210));
        const midEnergy = Math.min(1, midSum / (12 * 190));
        const highEnergy = Math.min(1, highSum / (18 * 160));
        const mouthOpen = Math.min(1, Math.max(rms * 3.8, midEnergy * 0.85 + lowEnergy * 0.35));

        const bins: number[] = [];
        for (let i = 0; i < 24; i++) {
          bins.push(Math.round((freqData[i + 1] / 255) * 100) / 100);
        }

        setAudioMetrics({
          mouthOpen,
          lowEnergy,
          midEnergy,
          highEnergy,
          frequencyBins: bins,
        });
      } else {
        setAudioMetrics((prev) => {
          if (prev.mouthOpen < 0.01) return prev;
          return {
            mouthOpen: prev.mouthOpen * 0.7,
            lowEnergy: prev.lowEnergy * 0.7,
            midEnergy: prev.midEnergy * 0.7,
            highEnergy: prev.highEnergy * 0.7,
            frequencyBins: prev.frequencyBins.map((v) => v * 0.72),
          };
        });
      }

      rafId = requestAnimationFrame(updateAudioMetrics);
    };

    rafId = requestAnimationFrame(updateAudioMetrics);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const refreshDiagnostics = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/health`);
      if (res.ok) {
        const data: HealthSnapshot = await res.json();
        setHealth(data);
        setHardware(data.hardware);
      }
    } catch {
      // Daemon still booting
    }
  }, []);

  // Connect and maintain WebSocket session
  useEffect(() => {
    let unmounted = false;

    const connect = () => {
      if (unmounted) return;
      const ws = new WebSocket(BACKEND_WS);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmounted) return;
        setConnected(true);
        refreshDiagnostics();
      };

      ws.onmessage = (event) => {
        if (unmounted) return;
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'connected':
              if (msg.health) {
                setHealth(msg.health);
                setHardware(msg.health.hardware);
              }
              break;

            case 'state':
              if (msg.state === 'IDLE' && activeSourcesRef.current.size > 0) {
                // Keep SPEAKING state until Web Audio buffer finishes playing
                break;
              }
              setCompanionState(msg.state as CompanionState);
              break;

            case 'vad_event':
              if (msg.event === 'speech_start') {
                stopAllPlayback();
                setCompanionState('LISTENING');
              }
              break;

            case 'stt_result':
              if (msg.text) {
                setLastUserTranscript(msg.text);
                setDialogueLog((prev) => [
                  ...prev.slice(-19),
                  {
                    id: `user-${Date.now()}`,
                    role: 'user',
                    text: msg.text,
                    timestamp: Date.now(),
                  },
                ]);
              }
              break;

            case 'llm_token':
              backendDoneRef.current = false;
              if (msg.full_text) {
                setLiveSubtitle(msg.full_text);
              }
              break;

            case 'tts_chunk':
              if (msg.pcm_base64) {
                schedulePcmPlayback(msg.pcm_base64, msg.sample_rate || 22050);
              }
              break;

            case 'turn_complete':
              backendDoneRef.current = true;
              if (msg.text) {
                setLiveSubtitle(msg.text);
                setDialogueLog((prev) => [
                  ...prev.slice(-19),
                  {
                    id: `lloyd-${Date.now()}`,
                    role: 'lloyd',
                    text: msg.text,
                    timestamp: Date.now(),
                    latencyMs: msg.latency_ms,
                    tokensPerSec: msg.tokens_per_sec,
                  },
                ]);
              }
              if (msg.hardware) {
                setHardware(msg.hardware);
              }
              if (activeSourcesRef.current.size === 0) {
                setCompanionState('IDLE');
              }
              break;

            case 'pong':
              if (msg.hardware) {
                setHardware(msg.hardware);
              }
              break;

            case 'history_cleared':
              setDialogueLog([]);
              setLiveSubtitle('Conversation memory cleared. Ready for a fresh start, Enes.');
              break;
          }
        } catch {
          // Ignore malformed packet
        }
      };

      ws.onclose = () => {
        if (unmounted) return;
        setConnected(false);
        reconnectTimerRef.current = window.setTimeout(connect, 1800);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    const pingInterval = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      } else {
        refreshDiagnostics();
      }
    }, 3500);

    return () => {
      unmounted = true;
      window.clearInterval(pingInterval);
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [refreshDiagnostics, schedulePcmPlayback, stopAllPlayback]);

  const sendText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      ensureAudioContext();
      stopAllPlayback();
      backendDoneRef.current = false;
      setLastUserTranscript(trimmed);
      setLiveSubtitle('...');
      setCompanionState('THINKING');

      setDialogueLog((prev) => [
        ...prev.slice(-19),
        {
          id: `user-${Date.now()}`,
          role: 'user',
          text: trimmed,
          timestamp: Date.now(),
        },
      ]);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'user_text', text: trimmed }));
      } else {
        // HTTP fallback if WS is reconnecting
        fetch(`${BACKEND_HTTP}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed, synthesize_audio: true }),
        })
          .then((r) => r.json())
          .then((data) => {
            backendDoneRef.current = true;
            if (data.reply) {
              setLiveSubtitle(data.reply);
            }
            if (Array.isArray(data.audio_chunks)) {
              for (const chunk of data.audio_chunks) {
                if (chunk.pcm_base64) {
                  schedulePcmPlayback(chunk.pcm_base64, chunk.sample_rate || 22050);
                }
              }
            }
            if (activeSourcesRef.current.size === 0) {
              setCompanionState('IDLE');
            }
          })
          .catch(() => {
            setCompanionState('IDLE');
          });
      }
    },
    [ensureAudioContext, schedulePcmPlayback, stopAllPlayback]
  );

  const sendAudioChunk = useCallback((pcm16Buffer: ArrayBuffer, mode: VoiceInputMode) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    // Prevent echo feedback while Lloyd is actively speaking unless in Push-to-Talk mode
    if (mode === 'vad' && activeSourcesRef.current.size > 0) return;

    const pcmBase64 = arrayBufferToBase64(pcm16Buffer);
    wsRef.current.send(
      JSON.stringify({
        type: 'audio_chunk',
        pcm_base64: pcmBase64,
        mode,
      })
    );
  }, []);

  const startPushToTalk = useCallback(() => {
    ensureAudioContext();
    stopAllPlayback();
    setCompanionState('LISTENING');
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ptt_start' }));
    }
  }, [ensureAudioContext, stopAllPlayback]);

  const releasePushToTalk = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ptt_release' }));
    } else {
      setCompanionState('IDLE');
    }
  }, []);

  const interrupt = useCallback(() => {
    stopAllPlayback();
    setCompanionState('IDLE');
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
    }
  }, [stopAllPlayback]);

  const clearHistory = useCallback(() => {
    stopAllPlayback();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'clear_history' }));
    } else {
      fetch(`${BACKEND_HTTP}/api/reset`, { method: 'POST' }).catch(() => {});
      setDialogueLog([]);
    }
  }, [stopAllPlayback]);

  return {
    connected,
    companionState,
    setCompanionState,
    health,
    hardware,
    liveSubtitle,
    lastUserTranscript,
    dialogueLog,
    audioMetrics,
    sendText,
    sendAudioChunk,
    startPushToTalk,
    releasePushToTalk,
    interrupt,
    clearHistory,
    refreshDiagnostics,
  };
}
