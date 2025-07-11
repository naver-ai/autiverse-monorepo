import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

// 프롬프트 생성 함수
export const generateWhisperPrompt = (peopleNames: string[] = [], placeNames: string[] = []): string => {
  const peopleList = peopleNames.length > 0 ? peopleNames.join(', ') : 'none';
  const placesList = placeNames.length > 0 ? placeNames.join(', ') : 'none';
  
  return `CRITICAL: This is a Korean conversation by an autistic teenager. ONLY transcribe what you actually hear - do not make up or guess any words.

ANTI-HALLUCINATION RULES (MOST IMPORTANT):
- If you only hear background noise, ambient sounds, or silence, return an empty string ""
- If you cannot clearly identify any Korean speech, return an empty string ""
- If the audio is unclear, muffled, or contains only noise, return empty string ""
- When in doubt, return an empty string ""
- NEVER generate text that you did not actually hear
- Only transcribe what you are 100% certain was spoken in Korean
- Do NOT return placeholder text like "음성 인식 실패" or "들리지 않음"
- Do NOT complete sentences or add words that were not spoken

Key Guidelines:
- Convert unclear pronunciation of autistic teenagers to standard Korean accurately
- Ignore meaningless sounds or noise and only transcribe actual spoken content
- Convert to natural Korean grammar
- Only recognize the user's actual speech content

Context Information (for pronunciation help only):
- People: ${peopleList}
- Places: ${placesList}

Important Notes:
- The context information above is ONLY for helping with pronunciation conversion
- Do NOT include these names in your response unless they are actually spoken
- Consider the pronunciation characteristics of autistic teenagers and convert to standard Korean
- This is Korean speech, so output in Korean text
- REMEMBER: No speech detected = return empty string ""`;
};

export interface VoiceRecorder {
  recording: Audio.Recording | null;
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  transcribeAudio: (audioUri: string, peopleNames?: string[], placeNames?: string[]) => Promise<string>;
}

class VoiceRecorderImpl implements VoiceRecorder {
  recording: Audio.Recording | null = null;
  isRecording: boolean = false;

  async startRecording(): Promise<void> {
    try {
      // 오디오 권한 요청
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        throw new Error('오디오 권한이 필요합니다.');
      }

      // 오디오 모드 설정
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });

      // 녹음 시작
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      this.recording = recording;
      this.isRecording = true;
      console.log('음성 녹음 시작');
    } catch (error) {
      console.error('음성 녹음 시작 실패:', error);
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

  async transcribeAudio(audioUri: string, peopleNames: string[] = [], placeNames: string[] = []): Promise<string> {
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
          formData.append('model', 'gpt-4o-transcribe');
          formData.append('language', 'ko');
          formData.append('temperature', '0');
          formData.append('prompt', generateWhisperPrompt(peopleNames, placeNames));
          return formData;
        })(),
      });

      if (!response.ok) {
        throw new Error(`Whisper API 오류: ${response.status}`);
      }

      const result = await response.json();
      console.log('음성 변환 결과:', result);
      
      // gpt-4o-transcribe는 JSON 형식으로 응답
      const transcribedText = result.text || result.transcript || '';
      console.log('추출된 텍스트:', transcribedText);
      
      return transcribedText;
    } catch (error) {
      console.error('음성 변환 실패:', error);
      throw error;
    }
  }
}

export const voiceRecorder = new VoiceRecorderImpl(); 