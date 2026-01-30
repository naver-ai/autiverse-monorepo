import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { styleTemplates } from '../../../styles';
import { useSpeech } from '../utils';
import { getTTSOptionsFromAgentConfig } from '../utils/speechUtils';
import { AgentImage } from './AgentImage';
import { useSession } from '../hooks/useSession';
import { useJournalingStore } from '../store';
import { useSpeechAnimation } from '../hooks/useSpeechAnimation';
import Reanimated from 'react-native-reanimated';
import { AnimatedText } from '../../../components/AnimatedText';

interface ChatMessageProps {
  journalEntryId: string;
  agentName: string;
  agentConfig?: any;
  onTTSStart?: (messageId: string) => void;
  onTTSComplete?: (messageId: string) => void;
}

// 이모티콘 제거 함수
const removeEmojis = (text: string): string => {
  return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
};

export const ChatMessageComponent: React.FC<ChatMessageProps> = ({
  journalEntryId,
  agentName,
  agentConfig,
  onTTSStart,
  onTTSComplete
}) => {

  const {isSendingMessage, setIsInputActive, isInputActive} = useJournalingStore();

  const {startSpeech} = useSpeech()

  const {sessionInfo} = useSession({sessionId: journalEntryId});

  const lastBotMessage = sessionInfo?.messages?.filter(m => !m.isUser)
    ?.pop();

  const lastSpokenMessageId = useRef<string | undefined>(undefined);

  const {ttsScalePulseStyle, ttsBorderColorStyle} = useSpeechAnimation(!isInputActive, 1.3);

  const sentences = useMemo(() => {
    return lastBotMessage?.text
      .split(/(?<=[.!?])\s+(?=[가-힣a-zA-Z0-9])|\s+(?=\d+\))|(?<=[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}])\s+/u)
      .filter(sentence => sentence.trim().length > 0);
  }, [lastBotMessage?.text]);

  useEffect(()=>{
    lastSpokenMessageId.current = undefined;
  }, [])

  // 새로운 봇 메시지가 올 때 자동으로 음성 재생
  useEffect(() => {
    if (lastBotMessage && lastBotMessage.text && !isSendingMessage) {
      // 완료 메시지는 TabletComicChatbotScreen에서 처리하므로 여기서는 건너뛰기
      /*
      if (lastBotMessage.text.includes('우와~ 이렇게 멋진 그림 일기 완성이라니!')) {
        console.log('Completion message detected in ChatMessage, skipping TTS...');
        return;
      }*/
      
      // 이전 메시지와 다른 경우에만 재생
      const messageId = lastBotMessage.id;
      if(lastSpokenMessageId.current === messageId){
        return;
      }
      
      // 즉시 음성 재생 (지연 없음)
      const cleanText = removeEmojis(lastBotMessage.text);
      if (cleanText.trim()) { // 빈 텍스트가 아닌 경우에만 재생
        setIsInputActive(false);
        onTTSStart?.(messageId);
        startSpeech(cleanText, {
          ...getTTSOptionsFromAgentConfig(agentConfig),
          onDone: () => {
            if (onTTSComplete) {
              onTTSComplete(messageId);
            }
            setIsInputActive(true);
            lastSpokenMessageId.current = messageId;
          }
        });
      }
    }
  }, [lastBotMessage?.id, isSendingMessage, onTTSStart, onTTSComplete]);
  
  if (!sessionInfo || sessionInfo.messages?.length === 0) {
    return null;
  }
  
  if (isSendingMessage) {
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
          <View className="bg-white border border-gray-200 p-3 rounded-lg self-start">
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color="#666" />
              {/* <Text className="text-gray-600 ml-2 text-lg" style={styleTemplates.withSemiboldFont}>{agentName} is thinking...</Text> #- English */}
              <Text className="text-gray-600 ml-2 text-lg" style={styleTemplates.withSemiboldFont}>{agentName}가 생각 중...</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }
  
  if (lastBotMessage) {
    // 문장 단위로 분리 (마침표, 느낌표, 물음표 기준) - 이모티콘 포함

    return (
      <View className="items-start">
        <View className="flex-row items-start">
          <Reanimated.View style={ttsScalePulseStyle}>
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
          </Reanimated.View>
          <View className="flex-1">
            {sentences?.map((sentence, index) => {
              // 앞 문장들의 글자수 * charInterval의 합 + 문장 간격을 계산 (이모지 포함)
              const previousDelay = sentences
                .slice(0, index)
                .reduce((total, prevSentence) => {
                  // Array.from()을 사용하여 이모지를 포함한 정확한 글자 수 계산
                  const charCount = Array.from(prevSentence.trim()).length;
                  return total + (charCount * 75);
                }, 0) + (index * 400); // 문장별 100ms 간격 추가
              
              return (
                <AnimatedText 
                    key={index}
                    className="bg-white border-2 border-gray-200 p-3 rounded-lg self-start my-2"
                    style={ttsBorderColorStyle}
                    text={sentence.trim()}
                    initialDelay={previousDelay}
                    charInterval={75}
                    textClassName="text-xl leading-8 text-gray-800"
                    textStyle={{...styleTemplates.withSemiboldFont, ...styleTemplates.englishTextWrap}}
                  />
              );
            })}
          </View>
        </View>
      </View>
    );
  }
  
  return null;
}; 