import React from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useCallback, useEffect, createContext, useContext } from 'react';
import { create } from 'zustand';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NetworkHelper } from '@autiverse-monorepo/ts-core';
import { SharedValue, useSharedValue } from 'react-native-reanimated';
import { AxiosError } from 'axios';

// AudioMetering Context
interface AudioMeteringContextType {
  audioMetering: SharedValue<number | undefined>;
}

const AudioMeteringContext = createContext<AudioMeteringContextType | null>(null);

export const AudioMeteringProvider = ({ children }: { children: React.ReactNode }) => {
  const audioMetering = useSharedValue<number | undefined>(undefined);
  
  return React.createElement(AudioMeteringContext.Provider, { value: { audioMetering } }, children);
};

export const useAudioMetering = (): SharedValue<number | undefined> => {
  const context = useContext(AudioMeteringContext);
  if (!context) {
    console.log('useAudioMetering must be used within AudioMeteringProvider');
    return useSharedValue<number | undefined>(undefined);
  }
  return context.audioMetering;
};

// Global singleton for recording instance
let globalRecordingInstance: Audio.Recording | null = null;

// Zustand store for voice recording state
interface VoiceRecorderStore {
  isRecording: boolean;
  canRecord: boolean;
  retryCount: number;
  maxRetries: number;
  setIsRecording: (recording: boolean) => void;
  setCanRecord: (canRecord: boolean) => void;
  setRetryCount: (count: number) => void;
  reset: () => void;
}

export const useVoiceRecorderState = create<VoiceRecorderStore>((set) => ({
  isRecording: false,
  canRecord: false,
  retryCount: 0,
  maxRetries: 3,
  setIsRecording: (recording) => set({ isRecording: recording }),
  setCanRecord: (canRecord) => set({ canRecord: canRecord }),
  setRetryCount: (count) => set({ retryCount: count }),
  reset: () => set({ isRecording: false, canRecord: false, retryCount: 0 }),
}));

export function useVoiceRecorder() {
  const { isRecording, canRecord, retryCount, maxRetries, setIsRecording, setCanRecord, setRetryCount, reset } = useVoiceRecorderState();
  const { t } = useTranslation();

  const audioMetering = useAudioMetering();

  useEffect(() => {
    (async () => {
      console.log("Requesting audio permissions.");
      const { status } = await Audio.requestPermissionsAsync();
      if (status === 'granted') {
        setCanRecord(true);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
      } else {
        Alert.alert('Permission required', 'Audio recording permission is required.');
      }
    })();

    // Cleanup function to release recording when component unmounts
    return () => {
      if (globalRecordingInstance) {
        globalRecordingInstance.stopAndUnloadAsync().catch(err => {
          console.error('Error stopping recording during cleanup:', err);
        });
        globalRecordingInstance = null;
      }
    };
  }, [setCanRecord]);

  const startRecording = useCallback(async () => {
    await stopRecording();
    
    try {
      console.log("Start recording.");
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          audioMetering.value = status.metering;
        },
        150
      );
      globalRecordingInstance = recording;
      setIsRecording(true);
      // 녹음 시작 시 리트라이 카운트 초기화
      setRetryCount(0);
    } catch (err) {
      console.log('Failed to start recording:', err);
      // 녹음 시작 실패 시 리트라이 카운트 증가
      setRetryCount(retryCount + 1);
    }
  }, [isRecording, setIsRecording, retryCount, setRetryCount]);

  const stopRecording = useCallback(async () => {
    if (!isRecording || !globalRecordingInstance) {
      return null;
    }
    
    try {
      await globalRecordingInstance.stopAndUnloadAsync();
      const uri = globalRecordingInstance.getURI();
      globalRecordingInstance = null;
      setIsRecording(false);
      return uri;
    } catch (err) {
      console.log('Failed to stop recording:', err);
      globalRecordingInstance = null;
      // 녹음 중지 실패 시 리트라이 카운트 증가
      setRetryCount(retryCount + 1);
      return null;
    }finally{
      setIsRecording(false);
      audioMetering.value = undefined;
    }
  }, [isRecording, setIsRecording, retryCount, setRetryCount]);

  const cleanupRecording = useCallback(async () => {
    if (globalRecordingInstance) {
      await globalRecordingInstance.stopAndUnloadAsync();
      globalRecordingInstance = null;
      reset();
    }
  }, [reset]);

  return {
    isRecording,
    canRecord,
    retryCount,
    maxRetries,
    setRetryCount,
    audioMetering,
    startRecording,
    stopRecording,
    clearRecording: cleanupRecording,
  };
}

export async function transcribeAudio(
  token: string,
  audioUri: string, 
  peopleNames: string[] = [], 
  placeNames: string[] = []
): Promise<string> {
  const maxRetries = 3;
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`음성 인식 API 호출 시도 ${attempt}/${maxRetries}`);
      
      // audioUri가 문자열인지 확인
      console.log('transcribeAudio 호출됨, audioUri:', audioUri, '타입:', typeof audioUri);
      if (typeof audioUri !== 'string') {
        console.log('audioUri가 문자열이 아님:', audioUri);
        throw new Error('오디오 파일 경로가 올바르지 않습니다.');
      }

      // Validate audio file exists
      try {
        const fileInfo = await FileSystem.getInfoAsync(audioUri);
        if (!fileInfo.exists) {
          console.log('오디오 파일을 찾을 수 없습니다.');
          throw new Error('오디오 파일을 찾을 수 없습니다.');
        }
      } catch (fileError) {
        console.log('파일 존재 여부 확인 실패:', fileError);
        // 파일 확인 실패해도 계속 진행 (파일이 실제로 존재할 수 있음)
      }

      // Create form data for backend API
      const formData = new FormData();
      formData.append('audio_file', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);
      formData.append('people_names', JSON.stringify(peopleNames));
      formData.append('place_names', JSON.stringify(placeNames));
      
      // Call backend speech recognition API using NetworkHelper with timeout
      const response = await NetworkHelper.axiosClient.post(
        NetworkHelper.ENDPOINTS.APP.SPEECH.RECOGNIZE, 
        formData, 
        {
          headers: {
            ...(await NetworkHelper.getHeaders(token)),
            'Content-Type': 'multipart/form-data',
          },
          timeout: 7000, // 7초 타임아웃 (음성 인식은 시간이 더 걸릴 수 있음)
        }
      );

      console.log(`음성 인식 API 호출 성공 (시도 ${attempt}/${maxRetries})`);
      console.log('음성 변환 결과:', response.data);
      
      const transcribedText = response.data.text || '';
      console.log('추출된 텍스트:', transcribedText);
      
      return transcribedText;
      
    } catch (error: any) {
      lastError = error;
      const axiosError = error as AxiosError;
      console.log(`음성 인식 API 호출 실패 (시도 ${attempt}/${maxRetries}):`, {
        message: error?.message,
        response: axiosError?.response?.data,
        status: axiosError?.response?.status,
        cause: axiosError?.cause,
      });
      
      // 마지막 시도가 아니면 잠시 대기 후 재시도
      if (attempt < maxRetries) {
        const delay = Math.min(2000 * attempt, 6000); // 2초, 4초, 6초 (최대 6초)
        console.log(`${delay}ms 후 음성 인식 재시도...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // 모든 시도 실패
  console.log('음성 인식 모든 재시도 실패');
  throw lastError;
}