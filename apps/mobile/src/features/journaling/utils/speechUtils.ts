// import { Audio } from 'expo-audio';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useState, useEffect, useCallback, useRef } from 'react';
import { create } from 'zustand';
import { NetworkHelper } from '@autiverse-monorepo/ts-core';
import { useAuth } from '../../auth/hooks';

// Global singleton for audio instance
let globalSoundInstance: Audio.Sound | null = null;

// TTS 요청 추적을 위한 Map
const activeTTSRequests = new Map<string, {
  sound: Audio.Sound;
  startTime: number;
  text: string;
}>();

// Zustand store for speech state
interface SpeechStore {
  isSpeaking: boolean;
  currentText: string;
  activeRequestId: string | null;
  setIsSpeaking: (speaking: boolean) => void;
  setCurrentText: (text: string) => void;
  setActiveRequestId: (requestId: string | null) => void;
  reset: () => void;
}

export const useSpeechState = create<SpeechStore>((set) => ({
  isSpeaking: false,
  currentText: '',
  activeRequestId: null,
  setIsSpeaking: (speaking) => set({ isSpeaking: speaking }),
  setCurrentText: (text) => set({ currentText: text }),
  setActiveRequestId: (requestId) => set({ activeRequestId: requestId }),
  reset: () => set({ isSpeaking: false, currentText: '', activeRequestId: null }),
}));

// 기본 TTS 설정 (fallback)
export const FALLBACK_TTS_OPTIONS = {
  voice: 'vyuna',
  speed: 1.0,
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
    rate: agentConfig.speed || FALLBACK_TTS_OPTIONS.speed,
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
}

// TTS API 호출을 재시도하는 함수
const retryTTSRequest = async (
  text: string,
  options: SpeechOptions,
  jwt: string,
  maxRetries: number = 3
): Promise<{ audio: string; format: string }> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
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
          timeout: 3000, // 3초 타임아웃으로 단축
        }
      );
      
      return response.data;
      
    } catch (error: any) {
      lastError = error;
      
      // 마지막 시도가 아니면 잠시 대기 후 재시도
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * attempt, 3000); // 1초, 2초, 3초 (최대 3초)
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // 모든 시도 실패
  throw lastError;
};

export const useSpeech = () => {
  const { isSpeaking, currentText, setIsSpeaking, setCurrentText, setActiveRequestId, reset } = useSpeechState();
  const {jwt} = useAuth();

  // Cleanup function for specific sound instance
  const cleanupSound = useCallback(async (requestId?: string) => {
    if (requestId && activeTTSRequests.has(requestId)) {
      const request = activeTTSRequests.get(requestId);
      if (request?.sound) {
        await request.sound.stopAsync();
        await request.sound.unloadAsync();
      }
      activeTTSRequests.delete(requestId);
    } else if (globalSoundInstance) {
      await globalSoundInstance.stopAsync();
      await globalSoundInstance.unloadAsync();
      globalSoundInstance = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup all active requests
      activeTTSRequests.forEach((request, requestId) => {
        cleanupSound(requestId);
      });
    };
  }, [cleanupSound]);

  const stop = useCallback(async () => {
    if (isSpeaking) {
      await cleanupSound();
      reset();
    }
  }, [cleanupSound, isSpeaking, reset]);

  const speak = useCallback(async (text: string, options: SpeechOptions = {}) => {
    if(!jwt){
      return;
    }

    // Generate unique request ID
    const requestId = `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Stop any existing TTS
    await stop();

    setCurrentText(text);
    setIsSpeaking(true);
    setActiveRequestId(requestId);

    try {
      // 1. CLOVA TTS 요청 (재시도 로직 포함)
      const response = await retryTTSRequest(text, options, jwt, 3);
      const audioBase64 = response.audio;

      // 2. 파일로 저장 (캐시 최적화)
      const audioPath = `${FileSystem.cacheDirectory}clova_tts_${requestId}.mp3`;
      await FileSystem.writeAsStringAsync(audioPath, audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 3. 재생 (즉시 로드)
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioPath },
        { shouldPlay: false } // 즉시 재생하지 않고 설정 후 재생
      );
      
      // Store this request
      activeTTSRequests.set(requestId, {
        sound,
        startTime: Date.now(),
        text
      });

      // 볼륨 설정 (기본값 사용)
      const volume = options.volume !== undefined ? options.volume : FALLBACK_TTS_OPTIONS.volume;
      await sound.setVolumeAsync(volume);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          // Only update state if this is still the active request
          if (activeTTSRequests.has(requestId)) {
            setIsSpeaking(false);
            setCurrentText('');
            setActiveRequestId(null);
            activeTTSRequests.delete(requestId);
            options.onDone?.();
          }
        }
      });

      await sound.playAsync();
    } catch (error: any) {
      // TTS 실패 시 자동으로 다시 시도
      console.log('TTS 실패, 자동 재시도 중...');
      
      // 잠시 대기 후 다시 시도
      setTimeout(async () => {
        try {
          const retryResponse = await retryTTSRequest(text, options, jwt, 2); // 재시도는 2번만
          const audioBase64 = retryResponse.audio;

          const audioPath = `${FileSystem.cacheDirectory}clova_tts_retry_${requestId}.mp3`;
          await FileSystem.writeAsStringAsync(audioPath, audioBase64, {
            encoding: FileSystem.EncodingType.Base64,
          });

          const { sound } = await Audio.Sound.createAsync(
            { uri: audioPath },
            { shouldPlay: false }
          );
          
          // Update the stored request
          activeTTSRequests.set(requestId, {
            sound,
            startTime: Date.now(),
            text
          });

          const volume = options.volume !== undefined ? options.volume : FALLBACK_TTS_OPTIONS.volume;
          await sound.setVolumeAsync(volume);

          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              // Only update state if this is still the active request
              if (activeTTSRequests.has(requestId)) {
                setIsSpeaking(false);
                setCurrentText('');
                setActiveRequestId(null);
                activeTTSRequests.delete(requestId);
                options.onDone?.();
              }
            }
          });

          await sound.playAsync();
        } catch (retryError) {
          // 재시도도 실패하면 TTS를 완료된 것으로 처리
          activeTTSRequests.delete(requestId);
          setIsSpeaking(false);
          setCurrentText('');
          setActiveRequestId(null);
          options.onDone?.();
        }
      }, 1000); // 1초 후 재시도
    }
  }, [jwt, isSpeaking, setIsSpeaking, setCurrentText, setActiveRequestId, stop]);

  return {
    isSpeaking,
    currentText,
    startSpeech: speak,
    stopSpeech: stop,
    clearSpeech: cleanupSound,
  };
};