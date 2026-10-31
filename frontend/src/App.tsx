import React, { useState } from 'react';
import { Canvas3D } from './components/Canvas3D';
import { DiagnosticBar } from './components/DiagnosticBar';
import { SettingsModal } from './components/SettingsModal';
import { SubtitleOverlay } from './components/SubtitleOverlay';
import { useLloydSocket, type VoiceInputMode } from './hooks/useLloydSocket';
import { useVoiceLoop } from './hooks/useVoiceLoop';

export const App: React.FC = () => {
  const [voiceMode, setVoiceMode] = useState<VoiceInputMode>('vad');

  const {
    connected,
    companionState,
    health,
    hardware,
    liveSubtitle,
    lastUserTranscript,
    audioMetrics,
    sendText,
    sendAudioChunk,
    startPushToTalk,
    releasePushToTalk,
    interrupt,
    clearHistory,
    refreshDiagnostics,
  } = useLloydSocket();

  const {
    micEnabled,
    micLevel,
    isPttHeld,
    toggleMicrophone,
    beginPushToTalk,
    endPushToTalk,
  } = useVoiceLoop({
    mode: voiceMode,
    onAudioChunk: sendAudioChunk,
    onPttStart: startPushToTalk,
    onPttRelease: releasePushToTalk,
  });

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#060811] select-none">
      {/* 3D Anime Companion & Cyber-Loft Simulation Scene */}
      <Canvas3D
        companionState={companionState}
        audioMetrics={audioMetrics}
        micLevel={micLevel}
      />

      {/* Top-Left Frosted-Glass Settings & Diagnostic Inspector */}
      <SettingsModal
        health={health}
        hardware={hardware}
        voiceMode={voiceMode}
        onVoiceModeChange={setVoiceMode}
        onRefreshDiagnostics={refreshDiagnostics}
        onClearHistory={clearHistory}
      />

      {/* Top-Right Live Hardware, STT, LLM, TTS Status Bar */}
      <DiagnosticBar
        connected={connected}
        companionState={companionState}
        health={health}
        hardware={hardware}
        micEnabled={micEnabled}
        voiceMode={voiceMode}
        onToggleMic={toggleMicrophone}
        onInterrupt={interrupt}
      />

      {/* Bottom-Center Live Cinematic Subtitles, Audio Visualizer, and Input Bar */}
      <SubtitleOverlay
        liveSubtitle={liveSubtitle}
        lastUserTranscript={lastUserTranscript}
        companionState={companionState}
        audioMetrics={audioMetrics}
        micLevel={micLevel}
        voiceMode={voiceMode}
        isPttHeld={isPttHeld}
        onSendText={sendText}
        onPttDown={beginPushToTalk}
        onPttUp={endPushToTalk}
      />
    </main>
  );
};

export default App;
