import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { ChatMessage } from '../types';

interface ChatMessageProps {
  messages: ChatMessage[];
  isLoading: boolean;
  agentName: string;
}

export const ChatMessageComponent: React.FC<ChatMessageProps> = ({
  messages,
  isLoading,
  agentName
}) => {
  const lastBotMessage = messages
    .filter(m => !m.isUser)
    .pop();
  
  if (messages.length === 0) {
    return (
      <View className="items-center justify-center py-8">
        <Text className="text-base text-gray-600 text-center">
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
            <Text className="text-gray-600 ml-2 text-sm">{agentName}가 생각 중...</Text>
          </View>
        </View>
      </View>
    );
  }
  
  if (lastBotMessage) {
    return (
      <View className="items-start">
        <View className="bg-white border border-gray-200 p-3 rounded-lg max-w-[90%]">
          <Text className="text-sm text-gray-800">
            {lastBotMessage.text}
          </Text>
        </View>
      </View>
    );
  }
  
  return null;
}; 