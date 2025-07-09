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

  static getInstance(): SpeechManager {
    if (!SpeechManager.instance) {
      SpeechManager.instance = new SpeechManager();
    }
    return SpeechManager.instance;
  }

  async speak(text: string, options: SpeechOptions = {}): Promise<void> {
    if (this.isSpeaking) {
      await this.stop();
    }

    this.currentText = text;
    this.isSpeaking = true;

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
    }
  }

  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
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

export const isSpeaking = () => {
  return SpeechManager.getInstance().isCurrentlySpeaking();
};

// import { Audio } from 'expo-av';
// import { NetworkHelper } from '@autiverse-monorepo/ts-core';

// export interface SpeechOptions {
//   language?: string;
//   pitch?: number;
//   rate?: number;
//   voice?: string;
//   onDone?: () => void;
//   onError?: (error: any) => void;
// }

// export class SpeechManager {
//   private static instance: SpeechManager;
//   private isSpeaking: boolean = false;
//   private currentText: string = '';
//   private sound: Audio.Sound | null = null;

//   static getInstance(): SpeechManager {
//     if (!SpeechManager.instance) {
//       SpeechManager.instance = new SpeechManager();
//     }
//     return SpeechManager.instance;
//   }

//   async speak(text: string, options: SpeechOptions = {}): Promise<void> {
//     if (this.isSpeaking) {
//       await this.stop();
//     }

//     this.currentText = text;
//     this.isSpeaking = true;

//     try {
//       // CLOVA TTS API 호출
//       const response = await NetworkHelper.axiosClient.post(NetworkHelper.ENDPOINTS.APP.TTS.CLOVA, {
//         text: text,
//         voice: options.voice || 'vhyeri', // 기본 음성: nara (여성)
//         speed: options.rate || 0.8,        // 속도
//         pitch: options.pitch || 1.2        // 피치
//       });

//       // base64 오디오 데이터를 파일로 저장하고 재생
//       const audioBase64 = response.data.audio;
//       const audioUri = `data:audio/mp3;base64,${audioBase64}`;
      
//       const { sound } = await Audio.Sound.createAsync({ uri: audioUri });
//       this.sound = sound;
      
//       this.sound.setOnPlaybackStatusUpdate((status) => {
//         if (status.isLoaded && status.didJustFinish) {
//           this.isSpeaking = false;
//           this.currentText = '';
//           // TTS 완료 콜백 호출
//           options.onDone?.();
//         }
//       });
      
//       await this.sound.playAsync();
//     } catch (error: any) {
//       console.error('CLOVA TTS error details:', {
//         message: error?.message,
//         code: error?.code,
//         response: error?.response?.data,
//         status: error?.response?.status,
//         config: {
//           url: error?.config?.url,
//           method: error?.config?.method,
//           baseURL: error?.config?.baseURL
//         }
//       });
//       this.isSpeaking = false;
//       this.currentText = '';
//       // TTS 에러 콜백 호출
//       options.onError?.(error);
//     }
//   }

//   async stop(): Promise<void> {
//     if (this.isSpeaking && this.sound) {
//       await this.sound.stopAsync();
//       await this.sound.unloadAsync();
//       this.sound = null;
//       this.isSpeaking = false;
//       this.currentText = '';
//     }
//   }

//   isCurrentlySpeaking(): boolean {
//     return this.isSpeaking;
//   }

//   getCurrentText(): string {
//     return this.currentText;
//   }
// }

// // 편의 함수들
// export const speakText = (text: string, options?: SpeechOptions) => {
//   return SpeechManager.getInstance().speak(text, options);
// };

// export const stopSpeech = () => {
//   return SpeechManager.getInstance().stop();
// };

// export const isSpeaking = () => {
//   return SpeechManager.getInstance().isCurrentlySpeaking();
// }; 


