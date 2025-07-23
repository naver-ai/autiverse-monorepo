// import { Audio } from 'expo-audio';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useState, useEffect, useCallback, useRef } from 'react';
import { create } from 'zustand';
import { NetworkHelper } from '@autiverse-monorepo/ts-core';
import { useAuth } from '../../auth/hooks';

// Global singleton for audio instance
let globalSoundInstance: Audio.Sound | null = null;

// Zustand store for speech state
interface SpeechStore {
  isSpeaking: boolean;
  currentText: string;
  setIsSpeaking: (speaking: boolean) => void;
  setCurrentText: (text: string) => void;
  reset: () => void;
}

export const useSpeechState = create<SpeechStore>((set) => ({
  isSpeaking: false,
  currentText: '',
  setIsSpeaking: (speaking) => set({ isSpeaking: speaking }),
  setCurrentText: (text) => set({ currentText: text }),
  reset: () => set({ isSpeaking: false, currentText: '' }),
}));

// 기본 TTS 설정 (fallback)
export const FALLBACK_TTS_OPTIONS = {
  voice: 'nsabina',
  speed: 0.8,
  pitch: 1.2,
  volume: 1.0,
} as const;

// agent_config에서 TTS 설정을 가져오는 함수
export const getTTSOptionsFromAgentConfig = (agentConfig?: Record<string, any>) => {
  if (!agentConfig) {
    return FALLBACK_TTS_OPTIONS;
  }

  return {
    voice: agentConfig.voice || FALLBACK_TTS_OPTIONS.voice,
    speed: agentConfig.speed || FALLBACK_TTS_OPTIONS.speed,
    pitch: agentConfig.pitch || FALLBACK_TTS_OPTIONS.pitch,
    volume: agentConfig.volume || FALLBACK_TTS_OPTIONS.volume,
  };
};

export interface SpeechOptions {
  language?: string;
  pitch?: number;
  rate?: number;
  voice?: string;
  volume?: number;
  onDone?: () => void;
  onError?: (error: any) => void;
}

export const useSpeech = () => {
  const { isSpeaking, currentText, setIsSpeaking, setCurrentText, reset } = useSpeechState();
  const {jwt} = useAuth();

  // Cleanup function for global sound instance
  const cleanupSound = useCallback(async () => {
    if (globalSoundInstance) {
      await globalSoundInstance.stopAsync();
      await globalSoundInstance.unloadAsync();
      globalSoundInstance = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Only cleanup if this is the last component using the hook
      // We'll keep the global instance alive for other components
    };
  }, []);

  const stop = useCallback(async () => {
    if (isSpeaking && globalSoundInstance) {
      await cleanupSound();
      reset()
    }
  }, [cleanupSound, isSpeaking, cleanupSound]);

  const speak = useCallback(async (text: string, options: SpeechOptions = {}) => {

    if(!jwt){
      return;
    }

    await stop();

    setCurrentText(text);
    setIsSpeaking(true);

    try {
      // 1. CLOVA TTS 요청
      const response = await NetworkHelper.axiosClient.post(
        NetworkHelper.ENDPOINTS.APP.SPEECH.CLOVA,
        {
          text: text,
          voice: options.voice || FALLBACK_TTS_OPTIONS.voice,
          speed: options.rate || FALLBACK_TTS_OPTIONS.speed,
          pitch: options.pitch || FALLBACK_TTS_OPTIONS.pitch,
        },
        {
          headers: {
            ...(await NetworkHelper.getHeaders(jwt)),
          },
        }
      );
      const audioBase64 = response.data.audio;

      // 2. 파일로 저장
      const audioPath = `${FileSystem.cacheDirectory}clova_tts.mp3`;
      await FileSystem.writeAsStringAsync(audioPath, audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 3. 재생
      const { sound } = await Audio.Sound.createAsync({ uri: audioPath });
      globalSoundInstance = sound;

      // 볼륨 설정 (기본값 사용)
      const volume = options.volume !== undefined ? options.volume : FALLBACK_TTS_OPTIONS.volume;
      await sound.setVolumeAsync(volume);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsSpeaking(false);
          setCurrentText('');
          options.onDone?.();
        }
      });

      await sound.playAsync();
    } catch (error: any) {
      console.error('Clova TTS Error:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
      });
      setIsSpeaking(false);
      setCurrentText('');
      options.onError?.(error);
    }
  }, [jwt, isSpeaking, setIsSpeaking, setCurrentText, stop]);

  return {
    isSpeaking,
    currentText,
    startSpeech: speak,
    stopSpeech: stop,
    clearSpeech: cleanupSound,
  };
};
