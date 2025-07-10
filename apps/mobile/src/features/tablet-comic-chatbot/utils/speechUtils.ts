// import { Audio } from 'expo-audio';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { NetworkHelper } from '@autiverse-monorepo/ts-core';

export interface SpeechOptions {
  language?: string;
  pitch?: number;
  rate?: number;
  voice?: string;
  volume?: number;
  onDone?: () => void;
  onError?: (error: any) => void;
}

export class SpeechManager {
  private static instance: SpeechManager;
  private isSpeaking: boolean = false;
  private currentText: string = '';
  private sound: Audio.Sound | null = null;
  private onStateChangeCallbacks: ((isSpeaking: boolean) => void)[] = [];

  static getInstance(): SpeechManager {
    if (!SpeechManager.instance) {
      SpeechManager.instance = new SpeechManager();
    }
    return SpeechManager.instance;
  }

  // TTS 상태 변경 구독
  subscribeToStateChange(callback: (isSpeaking: boolean) => void): () => void {
    this.onStateChangeCallbacks.push(callback);
    // 초기 상태 전달
    callback(this.isSpeaking);
    
    // 구독 해제 함수 반환
    return () => {
      const index = this.onStateChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.onStateChangeCallbacks.splice(index, 1);
      }
    };
  }

  // 상태 변경 알림
  private notifyStateChange() {
    this.onStateChangeCallbacks.forEach(callback => callback(this.isSpeaking));
  }

  // 현재 TTS 상태 확인
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  async speak(text: string, options: SpeechOptions = {}): Promise<void> {
    if (this.isSpeaking) {
      await this.stop();
    }

    this.currentText = text;
    this.isSpeaking = true;
    this.notifyStateChange();

    try {
      // 1. CLOVA TTS 요청
      const response = await NetworkHelper.axiosClient.post(
        NetworkHelper.ENDPOINTS.APP.TTS.CLOVA,
        {
          text: text,
          voice: options.voice || 'vhyeri',
          speed: options.rate || 1.4,
          pitch: options.pitch || 1.2,
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
      this.sound = sound;

      // 볼륨 설정 (기본값: 1.0)
      const volume = options.volume !== undefined ? options.volume : 1.0;
      await sound.setVolumeAsync(volume);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          this.isSpeaking = false;
          this.currentText = '';
          this.notifyStateChange();
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
      this.isSpeaking = false;
      this.currentText = '';
      this.notifyStateChange();
      options.onError?.(error);
    }
  }

  async stop(): Promise<void> {
    if (this.isSpeaking && this.sound) {
      await this.sound.stopAsync();
      await this.sound.unloadAsync();
      this.sound = null;
      this.isSpeaking = false;
      this.currentText = '';
      this.notifyStateChange();
    }
  }

  getCurrentText(): string {
    return this.currentText;
  }
}

// 편의 함수
export const speakText = (text: string, options?: SpeechOptions) => {
  return SpeechManager.getInstance().speak(text, options);
};

export const stopSpeech = () => {
  return SpeechManager.getInstance().stop();
};

export const getSpeechManager = () => {
  return SpeechManager.getInstance();
}; 


