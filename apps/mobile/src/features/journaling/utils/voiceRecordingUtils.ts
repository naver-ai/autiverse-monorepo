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
    throw new Error('useAudioMetering must be used within AudioMeteringProvider');
  }
  return context.audioMetering;
};

// Global singleton for recording instance
let globalRecordingInstance: Audio.Recording | null = null;

// Zustand store for voice recording state
interface VoiceRecorderStore {
  isRecording: boolean;
  canRecord: boolean;
  setIsRecording: (recording: boolean) => void;
  setCanRecord: (canRecord: boolean) => void;
  reset: () => void;
}

export const useVoiceRecorderState = create<VoiceRecorderStore>((set) => ({
  isRecording: false,
  canRecord: false,
  setIsRecording: (recording) => set({ isRecording: recording }),
  setCanRecord: (canRecord) => set({ canRecord: canRecord }),
  reset: () => set({ isRecording: false, canRecord: false }),
}));

export function useVoiceRecorder() {
  const { isRecording, canRecord, setIsRecording, setCanRecord, reset } = useVoiceRecorderState();
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
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  }, [isRecording, setIsRecording]);

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
      console.error('Failed to stop recording', err);
      globalRecordingInstance = null;
      return null;
    }finally{
      setIsRecording(false);
      audioMetering.value = undefined;
    }
  }, [isRecording, setIsRecording]);

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
  try {
    // Validate audio file exists
    const fileInfo = await FileSystem.getInfoAsync(audioUri);
    if (!fileInfo.exists) {
      throw new Error('오디오 파일을 찾을 수 없습니다.');
    }

    console.log("Transcribing audio:", audioUri);

    // Create form data for backend API
    const formData = new FormData();
    formData.append('audio_file', {
      uri: audioUri,
      type: 'audio/m4a',
      name: 'recording.m4a',
    } as any);
    formData.append('people_names', JSON.stringify(peopleNames));
    formData.append('place_names', JSON.stringify(placeNames));
    
    // Call backend speech recognition API using NetworkHelper
    const response = await NetworkHelper.axiosClient.post(NetworkHelper.ENDPOINTS.APP.SPEECH.RECOGNIZE, formData, {
      headers: {
        ...(await NetworkHelper.getHeaders(token)),
        'Content-Type': 'multipart/form-data',
      },
    });

    console.log('음성 변환 결과:', response.data);
    
    const transcribedText = response.data.text || '';
    console.log('추출된 텍스트:', transcribedText);
    
    return transcribedText;
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error('음성 변환 실패:', error, axiosError.cause, axiosError.toJSON());
    throw error;
  }
}