import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export interface VoiceRecorder {
  recording: Audio.Recording | null;
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  transcribeAudio: (audioUri: string) => Promise<string>;
}

class VoiceRecorderImpl implements VoiceRecorder {
  recording: Audio.Recording | null = null;
  isRecording: boolean = false;

  async startRecording(): Promise<void> {
    try {
      // 오디오 권한 요청
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        throw new Error('오디오 녹음 권한이 필요합니다.');
      }

      // 오디오 모드 설정
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // 녹음 시작
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      this.recording = recording;
      this.isRecording = true;
    } catch (error) {
      throw error;
    }
  }

  async stopRecording(): Promise<string | null> {
    if (!this.recording) {
      return null;
    }

    try {
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;
      this.isRecording = false;
      return uri;
    } catch (error) {
      this.recording = null;
      this.isRecording = false;
      throw error;
    }
  }

  async transcribeAudio(audioUri: string): Promise<string> {
    try {
      // 오디오 파일을 base64로 인코딩
      const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Whisper API 호출
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
          'Content-Type': 'multipart/form-data',
        },
        body: (() => {
          const formData = new FormData();
          formData.append('file', {
            uri: audioUri,
            type: 'audio/m4a',
            name: 'recording.m4a',
          } as any);
          formData.append('model', 'whisper-1');
          formData.append('language', 'ko');
          return formData;
        })(),
      });

      if (!response.ok) {
        throw new Error(`Whisper API 오류: ${response.status}`);
      }

      const result = await response.json();
      console.log('음성 변환 결과:', result.text);
      return result.text;
    } catch (error) {
      console.error('음성 변환 실패:', error);
      throw error;
    }
  }
}

export const voiceRecorder = new VoiceRecorderImpl(); 