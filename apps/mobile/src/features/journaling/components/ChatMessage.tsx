import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { ChatMessage as ChatMessageType } from '../types';
import { styleTemplates } from '../../../styles';
import { speakText, getSpeechManager } from '../utils/speechUtils';
import { AgentImage } from './AgentImage';

interface ChatMessageProps {
  messages: ChatMessageType[];
  isLoading: boolean;
  agentName: string;
  agentConfig?: any;
  onTTSComplete?: () => void;
}

// 이모티콘 제거 함수
const removeEmojis = (text: string): string => {
  return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
};

export const ChatMessageComponent: React.FC<ChatMessageProps> = ({
  messages,
  isLoading,
  agentName,
  agentConfig,
  onTTSComplete
}) => {
  const lastBotMessage = messages
    .filter(m => !m.isUser)
    .pop();

  // 새로운 봇 메시지가 올 때 자동으로 음성 재생
  useEffect(() => {
    if (lastBotMessage && lastBotMessage.text && !isLoading) {
      // 완료 메시지는 TabletComicChatbotScreen에서 처리하므로 여기서는 건너뛰기
      if (lastBotMessage.text.includes('우와~ 이렇게 멋진 그림 일기 완성이라니!')) {
        console.log('Completion message detected in ChatMessage, skipping TTS...');
        return;
      }
      
      // 이전 메시지와 다른 경우에만 재생
      const messageId = lastBotMessage.id;
      
      // 즉시 음성 재생 (지연 없음)
      const cleanText = removeEmojis(lastBotMessage.text);
      if (cleanText.trim()) { // 빈 텍스트가 아닌 경우에만 재생
        speakText(cleanText, {
          language: 'ko-KR',
          pitch: 0.9,
          rate: 0.6,
          onDone: () => {
            // TTS 완료 후 ChatInput 활성화
            if (onTTSComplete) {
              onTTSComplete();
            }
          },
          onError: (error) => {
            console.error('TTS error:', error);
            // 에러 발생 시에도 ChatInput 활성화
            if (onTTSComplete) {
              onTTSComplete();
            }
          }
        });
      }
    }
  }, [lastBotMessage?.id, isLoading]);
  
  if (messages.length === 0) {
    return (
      <View className="items-center justify-center py-8">
        <Text className="text-lg text-gray-600 text-center" style={styleTemplates.withSemiboldFont}>
          왼쪽에서 시작하기를 눌러주세요!
        </Text>
      </View>
    );
  }
  
  if (isLoading) {
    return (
      <View className="items-start">
        <View className="flex-row items-start">
          <AgentImage
            avatarImage={agentConfig?.avatar_image || ''}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              marginRight: 12,
              marginTop: 4
            }}
          />
          <View className="bg-white border border-gray-200 p-3 rounded-lg self-start" style={{ maxWidth: '85%' }}>
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color="#666" />
              <Text className="text-gray-600 ml-2 text-lg" style={styleTemplates.withSemiboldFont}>{agentName}가 생각 중...</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }
  
  if (lastBotMessage) {
    // 문장 단위로 분리 (마침표, 느낌표, 물음표 기준) - 이모티콘 포함
    const sentences = lastBotMessage.text
      .split(/(?<=[.!?])\s+(?=[가-힣])/)
      .filter(sentence => sentence.trim().length > 0);

    return (
      <View className="items-start">
        <View className="flex-row items-start">
          <AgentImage
            avatarImage={agentConfig?.avatar_image || ''}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              marginRight: 12,
              marginTop: 4
            }}
          />
          <View className="flex-1">
            {sentences.map((sentence, index) => (
              <View 
                key={index} 
                className="bg-white border border-gray-200 p-3 rounded-lg self-start"
                style={{ 
                  marginBottom: index < sentences.length - 1 ? 8 : 0,
                  maxWidth: '85%'
                }}
              >
                <Text className="text-lg text-gray-800" style={styleTemplates.withSemiboldFont}>
                  {sentence.trim()}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }
  
  return null;
}; 