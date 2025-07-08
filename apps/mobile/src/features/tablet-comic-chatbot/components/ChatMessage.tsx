import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { ChatMessage } from '../types';
import { styleTemplates } from '../../../styles';
import { speakText } from '../utils';

interface ChatMessageProps {
  messages: ChatMessage[];
  isLoading: boolean;
  agentName: string;
}

// 이모티콘 제거 함수
const removeEmojis = (text: string): string => {
  return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
};

export const ChatMessageComponent: React.FC<ChatMessageProps> = ({
  messages,
  isLoading,
  agentName
}) => {
  const lastBotMessage = messages
    .filter(m => !m.isUser)
    .pop();

  // 새로운 봇 메시지가 올 때 자동으로 음성 재생
  useEffect(() => {
    if (lastBotMessage && lastBotMessage.text && !isLoading) {
      // 이전 메시지와 다른 경우에만 재생
      const messageId = lastBotMessage.id;
      
      // 즉시 음성 재생 (지연 없음)
      const cleanText = removeEmojis(lastBotMessage.text);
      if (cleanText.trim()) { // 빈 텍스트가 아닌 경우에만 재생
        speakText(cleanText, {
          language: 'ko-KR',
          pitch: 0.9,
          rate: 0.6
        });
      }
    }
  }, [lastBotMessage?.id, isLoading]);
  
  if (messages.length === 0) {
    return (
      <View className="items-center justify-center py-8">
        <Text className="text-base text-gray-600 text-center" style={styleTemplates.withSemiboldFont}>
          왼쪽에서 시작하기를 눌러주세요!
        </Text>
      </View>
    );
  }
  
  if (isLoading) {
    return (
      <View className="items-start">
        <View className="bg-white border border-gray-200 p-3 rounded-lg">
          <View className="flex-row items-center">
            <ActivityIndicator size="small" color="#666" />
            <Text className="text-gray-600 ml-2 text-sm" style={styleTemplates.withSemiboldFont}>{agentName}가 생각 중...</Text>
          </View>
        </View>
      </View>
    );
  }
  
  if (lastBotMessage) {
    return (
      <View className="items-start">
        <View className="bg-white border border-gray-200 p-3 rounded-lg max-w-[90%]">
          <Text className="text-sm text-gray-800" style={styleTemplates.withSemiboldFont}>
            {lastBotMessage.text}
          </Text>
        </View>
      </View>
    );
  }
  
  return null;
}; 