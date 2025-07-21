import Audio, {AudioRecorder, PermissionStatus, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState} from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

export function useVoiceRecorder() {

 const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
 const recorderState = useAudioRecorderState(recorder, 100)
 const {t} = useTranslation()

 const startRecording = useCallback(async ()=>{
  if(recorderState.isRecording){
    console.log("First, stop recording.")
    await recorder.stop()
  }
  console.log("Start recording.")
  recorder.record()
 }, [recorderState.isRecording, recorder])


 const stopRecording = useCallback(async ()=>{
  if(!recorderState.isRecording){
    return null
  }
  await recorder.stop()

  return recorder.uri
 }, [recorderState.isRecording, recorder])

 useEffect(()=>{
  (async () => {
    console.log("Check and request microphone permission.")
    const status = await Audio.getRecordingPermissionsAsync()
    console.log("Microphone permission status:", status)
    if(status.status === PermissionStatus.UNDETERMINED){
      console.log("Microphone permission has not been determined.")
      await Audio.requestRecordingPermissionsAsync()
    }else if(status.status === PermissionStatus.DENIED){
      Alert.alert(t('Journaling.VoiceRecording.PermissionError'))
    }

    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true
    })
  })();
 }, [])

 return {
  isRecording: recorderState.isRecording,
  canRecord: recorderState.canRecord,
  startRecording,
  stopRecording
 }
}


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

export async function transcribeAudio(audioUri: string, peopleNames: string[] = [], placeNames: string[] = []): Promise<string> {
  try {
    // Validate audio file exists
    const fileInfo = await FileSystem.getInfoAsync(audioUri);
    if (!fileInfo.exists) {
      throw new Error('오디오 파일을 찾을 수 없습니다.');
    }

    // Create form data for OpenAI API
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

    // Call OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`STT API 오류: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('음성 변환 결과:', result);
    
    const transcribedText = result.text || result.transcript || '';
    console.log('추출된 텍스트:', transcribedText);
    
    return transcribedText;
  } catch (error) {
    console.error('음성 변환 실패:', error);
    throw error;
  }
}