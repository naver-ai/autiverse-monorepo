import React, { useEffect, useState } from 'react';
import { View, Alert } from 'react-native';
import { ChatMessage } from '../types';
import { getSpeechManager } from '../utils/speechUtils';
import { voiceRecorder } from '../utils/voiceUtils';
import { ChatText, ChatButtons, VoiceRecordingStatus } from './index';

interface ChatInputProps {
  inputText: string;
  setInputText: (text: string) => void;
  sendMessage: (message: string) => void;
  isLoading: boolean;
  messages: ChatMessage[];
  currentStage: string;
  comicGenerationStatus: any;
  isInputActive?: boolean;
  agentName: string;
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
  agentName
}) => {
  const [isTTSActive, setIsTTSActive] = useState(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [hasButtons, setHasButtons] = useState(false);
  
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
            return lastMessage?.text?.includes('기분이 어땠어?');
          }
          return false;
        })();
        
        // 완료 메시지가 아니고 버튼이 표시되지 않을 때만 음성 녹음 시작
        if (!isCompletionMessage && !shouldShowButtons) {
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
        
        // Whisper API로 텍스트 변환
        const transcribedText = await voiceRecorder.transcribeAudio(audioUri);
        
        if (transcribedText.trim()) {
          // 변환된 텍스트를 메시지로 전송
          sendMessage(transcribedText);
        } else {
          Alert.alert('알림', '음성을 텍스트로 변환할 수 없었습니다. 다시 시도해주세요.');
        }
      }
    } catch (error) {
      console.error('음성 녹음 완료 실패:', error);
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
        showYesNoButtons={showYesNoButtons}
        showEmotionButtons={showEmotionButtons}
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
      />
    </View>
  );
}; 