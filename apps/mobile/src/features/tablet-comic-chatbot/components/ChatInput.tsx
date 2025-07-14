import React, { useEffect, useState } from 'react';
import { View, Alert } from 'react-native';
import { ChatMessage } from '../types';
import { getSpeechManager } from '../utils/speechUtils';
import { voiceRecorder } from '../utils/voiceUtils';
import { ChatText, ChatButtons, VoiceRecordingStatus } from './index';
import { useDyad } from '../../../api/dyad';
import { uploadAudioFile } from '../api';

interface ChatInputProps {
  inputText: string;
  setInputText: (text: string) => void;
  sendMessage: (message: string, audioFilename?: string) => void;
  isLoading: boolean;
  messages: ChatMessage[];
  currentStage: string;
  comicGenerationStatus: any;
  isInputActive?: boolean;
  agentName: string;
  sessionId?: string;
  loadSessionInfo?: (sessionId: string) => Promise<any>;
  isAfterFarewell?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputText,
  setInputText,
  sendMessage,
  isLoading,
  messages,
  currentStage,
  comicGenerationStatus,
  isInputActive = true,
  agentName,
  sessionId,
  loadSessionInfo,
  isAfterFarewell = false
}) => {
  const { dyad } = useDyad();
  const [isTTSActive, setIsTTSActive] = useState<boolean>(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState<boolean>(false);
  const [isVoiceMode, setIsVoiceMode] = useState<boolean>(false);
  const [hasButtons, setHasButtons] = useState<boolean>(false);
  
  const lastBotMessage = messages
    .filter(m => !m.isUser)
    .pop()?.text;
  
  // TTS 상태 구독
  useEffect(() => {
    const speechManager = getSpeechManager();
    const unsubscribe = speechManager.subscribeToStateChange((isSpeaking) => {
      setIsTTSActive(isSpeaking);
      
      // TTS가 완료되면 바로 음성 녹음 모드로 전환
      if (!isSpeaking && !isLoading) {
        const lastMessage = messages.filter(m => !m.isUser).pop();
        const isCompletionMessage = lastMessage?.text?.includes('우와~ 이렇게 멋진 그림 일기 완성이라니!');
        
        // 버튼이 표시될 조건인지 확인
        const shouldShowButtons = (() => {
          if (currentStage === 'revision_1') {
            return (lastMessage?.text?.includes('다 맞게 들었을까?') || 
                    lastMessage?.text?.includes('아직도 틀린 부분 있어?') ||
                    lastMessage?.text?.includes('이제 다 맞을까?'));
          }
          if (currentStage === 'revision_2') {
            return (lastMessage?.text?.includes('수정하거나 추가하고 싶은 부분 있어?') || 
                    lastMessage?.text?.includes('더 추가하거나 바꿀 곳 있어?'));
          }
          if (currentStage === 'comic_context') {
            return lastMessage?.text?.includes('기분이 어땠어?') || lastMessage?.text?.includes('몇가지 확인해줄래??');
          }
          return false;
        })();
        
        // 만화 생성 완료 메시지인지 확인 (별도 조건)
        const isComicCompletionMessage = lastMessage?.text?.includes('다행이다') || 
                                        lastMessage?.text?.includes('채울 수 있을 것 같아');
        
        // 완료 메시지가 아니고 버튼이 표시되지 않으며, 만화 생성 완료 메시지도 아니고, farewell 이후도 아닐 때만 음성 녹음 시작
        if (!isCompletionMessage && !shouldShowButtons && !isComicCompletionMessage && !isAfterFarewell) {
          startVoiceRecording();
        }
      }
    });
    
    return unsubscribe;
  }, [isLoading, messages, currentStage]);
  
  // TTS 또는 로딩 중일 때 비활성화, 또는 ChatInput이 비활성화 상태일 때
  const isDisabled = isLoading || isTTSActive || comicGenerationStatus.status === 'generating' || !isInputActive || isVoiceRecording;
  
  // admin-web과 동일한 조건으로 버튼 표시 여부 결정
  const showYesNoButtons = (() => {
    // revision_1에서 "다 맞게 들었을까?" 또는 "아직도 틀린 부분 있어?" 또는 "이제 다 맞을까?" 질문일 때만 버튼 표시
    if (currentStage === 'revision_1') {
      return (lastBotMessage?.includes('다 맞게 들었을까?') || 
              lastBotMessage?.includes('아직도 틀린 부분 있어?') ||
              lastBotMessage?.includes('이제 다 맞을까?')) && 
             !isDisabled && 
             inputText.trim() === '';
    }
    
    // revision_2에서 "수정하거나 추가하고 싶은 부분 있어?" 또는 "더 추가하거나 바꿀 곳 있어?" 질문일 때만 버튼 표시
    if (currentStage === 'revision_2') {
      return (lastBotMessage?.includes('수정하거나 추가하고 싶은 부분 있어?') || 
              lastBotMessage?.includes('더 추가하거나 바꿀 곳 있어?')) && 
             !isDisabled && 
             inputText.trim() === '';
    }
    
    // comic_context에서 "몇가지 확인해줄래??" 멘트가 포함된 질문일 때 버튼 표시
    if (currentStage === 'comic_context') {
      return lastBotMessage?.includes('몇가지 확인해줄래??') && 
             !isDisabled && 
             inputText.trim() === '';
    }
    
    return false;
  })();

  const showEmotionButtons = (() => {
    // comic_context에서 "기분이 어땠어?" 질문일 때 감정 버튼 표시
    if (currentStage === 'comic_context') {
      return lastBotMessage?.includes('기분이 어땠어?') && 
             !isDisabled && 
             inputText.trim() === '';
    }
    
    return false;
  })();

  // 버튼 내용 결정
  const getButtonTexts = () => {
    if (currentStage === 'revision_1') {
      if (lastBotMessage?.includes('다 맞게 들었을까?')) {
        // 첫 번째 질문
        return { left: '틀린 게 있어', right: '다 맞아' };
      } else if (lastBotMessage?.includes('아직도 틀린 부분 있어?') || lastBotMessage?.includes('이제 다 맞을까?')) {
        // 수정 후 질문
        return { left: '아직 있어', right: '이제 충분해' };
      }
    } else if (currentStage === 'revision_2') {
      return { left: '있어', right: '없어' };
    } else if (currentStage === 'comic_context') {
      return { left: '좋아!', right: '알겠어!' };
    }
    return { left: '응', right: '아니' };
  };

  const buttonTexts = getButtonTexts();

  // 음성 녹음 시작
  const startVoiceRecording = async () => {
    try {
      setIsVoiceMode(true);
      setIsVoiceRecording(true);
      await voiceRecorder.startRecording();
    } catch (error) {
      console.error('음성 녹음 시작 실패:', error);
      Alert.alert('오류', '음성 녹음을 시작할 수 없습니다.');
      setIsVoiceRecording(false);
      setIsVoiceMode(false);
    }
  };

  // 음성 녹음 완료 및 텍스트 변환
  const completeVoiceRecording = async () => {
    try {
      const audioUri = await voiceRecorder.stopRecording();
      if (audioUri) {
        setIsVoiceRecording(false);
        setIsVoiceMode(false);
        
        // sessionId가 있으면 현재 journal의 context 정보를 가져오고, 없으면 dyad 정보 사용
        let peopleNames: string[] = [];
        let placeNames: string[] = [];
        
        if (sessionId && loadSessionInfo) {
          try {
            const sessionInfo = await loadSessionInfo(sessionId);
            if (sessionInfo) {
              // 현재 journal의 location과 people 정보 사용
              peopleNames = sessionInfo.people || [];
              placeNames = sessionInfo.location ? [sessionInfo.location] : [];
            }
          } catch (error) {
            console.error('Failed to load session info for Whisper prompt:', error);
            // fallback: dyad 정보 사용
            peopleNames = dyad?.people?.map(person => person.name) || [];
            placeNames = dyad?.places?.map(place => place.name) || [];
          }
        } else {
          // sessionId가 없으면 dyad 정보 사용
          peopleNames = dyad?.people?.map(person => person.name) || [];
          placeNames = dyad?.places?.map(place => place.name) || [];
        }
        
        // Whisper API로 텍스트 변환 (현재 session context 정보 포함)
        const transcribedText = await voiceRecorder.transcribeAudio(audioUri, peopleNames, placeNames);
        
        console.log('Transcribed text check:', {
          transcribedText,
          trimmed: transcribedText?.trim(),
          isEmpty: !transcribedText?.trim()
        });
        
        // 빈 문자열이거나 따옴표만 있는 경우 체크
        const trimmedText = transcribedText?.trim();
        const isEmptyOrQuotesOnly = !trimmedText || trimmedText === '""' || trimmedText === "''";
        
        if (transcribedText && !isEmptyOrQuotesOnly) {
          // 오디오 파일 업로드
          let audioFilename: string | undefined = undefined;
          if (sessionId) {
            try {
              const uploadResult = await uploadAudioFile(audioUri, sessionId, currentStage);
              audioFilename = uploadResult.filename;
              console.log('Audio file uploaded successfully:', audioFilename);
            } catch (error) {
              console.error('Failed to upload audio file:', error);
              // 업로드 실패해도 메시지는 전송
            }
          }
          
          // 변환된 텍스트를 메시지로 전송 (audio_filename 포함)
          sendMessage(transcribedText, audioFilename);
        } else {
          // 빈 문자열이 반환된 경우 (음성이 감지되지 않음)
          Alert.alert(
            '음성 감지 실패', 
            '나한테 잘 안 들렸어! 다시 한 번 말해줘~',
            [
              {
                text: '확인',
                onPress: () => {
                  // 다시 음성 녹음 시작
                  startVoiceRecording();
                }
              }
            ]
          );
        }
      }
    } catch (error) {
      console.error('음성 녹음 완료 실패:', error);
      
      // 일반적인 오류 처리
      Alert.alert('오류', '음성 변환 중 오류가 발생했습니다.');
      
      setIsVoiceRecording(false);
      setIsVoiceMode(false);
    }
  };

  const handleInputFocus = () => {
    if (isVoiceMode) {
      setIsVoiceMode(false);
      if (isVoiceRecording) {
        voiceRecorder.stopRecording();
        setIsVoiceRecording(false);
      }
    }
  };

  return (
    <View className="p-6 border-t-2 border-gray-200 bg-white">
      {/* 음성 녹음 상태 표시 */}
      <VoiceRecordingStatus
        agentName={agentName}
        isVoiceMode={isVoiceMode}
        isVoiceRecording={isVoiceRecording}
        isTTSActive={isTTSActive}
        onComplete={completeVoiceRecording}
      />
      
      {/* 버튼들 */}
      <ChatButtons
        showYesNoButtons={showYesNoButtons || false}
        showEmotionButtons={showEmotionButtons || false}
        buttonTexts={buttonTexts}
        isDisabled={isDisabled}
        sendMessage={sendMessage}
        onButtonsVisibilityChange={setHasButtons}
      />
      
      {/* 입력 필드 */}
      <ChatText
        inputText={inputText}
        setInputText={setInputText}
        sendMessage={sendMessage}
        isDisabled={isDisabled}
        isVoiceMode={isVoiceMode}
        onFocus={handleInputFocus}
        showButtons={showYesNoButtons || showEmotionButtons}
      />
    </View>
  );
}; 