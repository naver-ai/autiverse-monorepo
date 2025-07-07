import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ChatMessage } from '../types';

interface ChatInputProps {
  inputText: string;
  setInputText: (text: string) => void;
  sendMessage: (message: string) => void;
  isLoading: boolean;
  messages: ChatMessage[];
  currentStage: string;
  comicGenerationStatus: any;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputText,
  setInputText,
  sendMessage,
  isLoading,
  messages,
  currentStage,
  comicGenerationStatus
}) => {
  const lastBotMessage = messages
    .filter(m => !m.isUser)
    .pop()?.text;
  
  // admin-web과 동일한 조건으로 버튼 표시 여부 결정
  const showYesNoButtons = (() => {
    // revision_1에서 "다 맞게 들었을까?" 또는 "아직도 틀린 부분 있어?" 또는 "이제 다 맞을까?" 질문일 때만 버튼 표시
    if (currentStage === 'revision_1') {
      return (lastBotMessage?.includes('다 맞게 들었을까?') || 
              lastBotMessage?.includes('아직도 틀린 부분 있어?') ||
              lastBotMessage?.includes('이제 다 맞을까?')) && 
             !isLoading && 
             inputText.trim() === '';
    }
    
    // revision_2에서 "수정하거나 추가하고 싶은 부분 있어?" 또는 "더 추가하거나 바꿀 곳 있어?" 질문일 때만 버튼 표시
    if (currentStage === 'revision_2') {
      return (lastBotMessage?.includes('수정하거나 추가하고 싶은 부분 있어?') || 
              lastBotMessage?.includes('더 추가하거나 바꿀 곳 있어?')) && 
             !isLoading && 
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

  return (
    <View className="p-6 border-t-2 border-gray-200 bg-white">
      {/* Yes/No 버튼 - admin-web과 동일한 스타일 */}
      {showYesNoButtons && (
        <View className="flex-row gap-3 mb-4">
          <TouchableOpacity
            className="flex-1 bg-gray-500 px-6 py-4 rounded-xl"
            onPress={() => sendMessage(buttonTexts.left)}
            disabled={isLoading}
            style={{
              backgroundColor: '#6c757d',
              minHeight: 56,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text className="text-white font-bold text-lg text-center">{buttonTexts.left}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-blue-500 px-6 py-4 rounded-xl"
            onPress={() => sendMessage(buttonTexts.right)}
            disabled={isLoading}
            style={{
              backgroundColor: '#4A90E2',
              minHeight: 56,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text className="text-white font-bold text-lg text-center">{buttonTexts.right}</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* 입력 필드 - 항상 동일한 너비 유지 */}
      <View className="flex-row items-center">
        <TextInput
          className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 mr-3 text-base"
          placeholder="메시지를 입력하세요..."
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={() => {
            if (inputText.trim() && !isLoading && comicGenerationStatus.status !== 'generating') {
              sendMessage(inputText);
            }
          }}
          editable={!isLoading && comicGenerationStatus.status !== 'generating'}
          style={{
            minHeight: 48,
            fontSize: 16,
          }}
        />
        <TouchableOpacity
          className={`px-6 py-3 rounded-xl ${
            isLoading || !inputText.trim() || comicGenerationStatus.status === 'generating' 
              ? 'bg-gray-400' 
              : 'bg-blue-500'
          }`}
          onPress={() => {
            if (inputText.trim() && !isLoading && comicGenerationStatus.status !== 'generating') {
              sendMessage(inputText);
            }
          }}
          disabled={isLoading || !inputText.trim() || comicGenerationStatus.status === 'generating'}
          style={{
            minHeight: 48,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <Text className="text-white font-semibold text-base">전송</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}; 