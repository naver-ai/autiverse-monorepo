import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ChatMessage } from '../types';
import { styleTemplates } from '../../../styles';
import { getSpeechManager } from '../utils/speechUtils';

interface ChatInputProps {
  inputText: string;
  setInputText: (text: string) => void;
  sendMessage: (message: string) => void;
  isLoading: boolean;
  messages: ChatMessage[];
  currentStage: string;
  comicGenerationStatus: any;
  isInputActive?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputText,
  setInputText,
  sendMessage,
  isLoading,
  messages,
  currentStage,
  comicGenerationStatus,
  isInputActive = true
}) => {
  const [selectedEmotions, setSelectedEmotions] = React.useState<string[]>([]);
  const [isTTSActive, setIsTTSActive] = useState(false);
  
  const lastBotMessage = messages
    .filter(m => !m.isUser)
    .pop()?.text;
  
  // TTS 상태 구독
  useEffect(() => {
    const speechManager = getSpeechManager();
    const unsubscribe = speechManager.subscribeToStateChange((isSpeaking) => {
      setIsTTSActive(isSpeaking);
    });
    
    return unsubscribe;
  }, []);
  
  // TTS 또는 로딩 중일 때 비활성화, 또는 ChatInput이 비활성화 상태일 때
  const isDisabled = isLoading || isTTSActive || comicGenerationStatus.status === 'generating' || !isInputActive;
  
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

  const handleEmotionClick = (emotion: string) => {
    if (isDisabled) return;
    
    if (selectedEmotions.includes(emotion)) {
      setSelectedEmotions(selectedEmotions.filter(e => e !== emotion));
    } else {
      setSelectedEmotions([...selectedEmotions, emotion]);
    }
  };

  const handleEmotionComplete = () => {
    if (selectedEmotions.length > 0 && !isDisabled) {
      sendMessage(selectedEmotions.join(', '));
      setSelectedEmotions([]);
    }
  };

  const emotionButtons = [
    { text: '즐거웠다', emoji: '😊' },
    { text: '기뻤다', emoji: '😄' },
    { text: '행복했다', emoji: '🥰' },
    { text: '신났다', emoji: '🤩' },
    { text: '슬펐다', emoji: '😢' },
    { text: '화났다', emoji: '😠' },
    { text: '속상했다', emoji: '😞' },
    { text: '무서웠다', emoji: '😨' },
    { text: '두려웠다', emoji: '😰' },
    { text: '놀랐다', emoji: '😲' },
    { text: '감탄했다', emoji: '😍' },
    { text: '지루했다', emoji: '😴' }
  ];

  return (
    <View className="p-6 border-t-2 border-gray-200 bg-white">
      {/* Yes/No 버튼 - admin-web과 동일한 스타일 */}
      {showYesNoButtons && (
        <View className="flex-row gap-3 mb-4">
          <TouchableOpacity
            className={`flex-1 px-6 py-4 rounded-xl ${
              isDisabled ? 'bg-gray-400' : 'bg-gray-500'
            }`}
            onPress={() => sendMessage(buttonTexts.left)}
            disabled={isDisabled}
            style={{
              backgroundColor: isDisabled ? '#9CA3AF' : '#6c757d',
              minHeight: 56,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text className="text-white font-bold text-lg text-center" style={styleTemplates.withBoldFont}>{buttonTexts.left}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 px-6 py-4 rounded-xl ${
              isDisabled ? 'bg-gray-400' : 'bg-blue-500'
            }`}
            onPress={() => sendMessage(buttonTexts.right)}
            disabled={isDisabled}
            style={{
              backgroundColor: isDisabled ? '#9CA3AF' : '#4A90E2',
              minHeight: 56,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text className="text-white font-bold text-lg text-center" style={styleTemplates.withBoldFont}>{buttonTexts.right}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 감정 버튼 - 3x4 그리드 */}
      {showEmotionButtons && (
        <View className="mb-4 p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
          {[0, 1, 2, 3].map((row) => (
            <View key={row} className="flex-row gap-2 mb-2">
              {emotionButtons.slice(row * 3, (row + 1) * 3).map((emotion) => {
                const isSelected = selectedEmotions.includes(emotion.text);
                return (
                  <TouchableOpacity
                    key={emotion.text}
                    className="flex-1"
                    onPress={() => handleEmotionClick(emotion.text)}
                    disabled={isDisabled}
                    style={{
                      padding: 12,
                      backgroundColor: isDisabled 
                        ? '#9CA3AF' 
                        : isSelected ? '#28a745' : '#4A90E2',
                      borderRadius: 8,
                      minHeight: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: isDisabled ? 0.05 : (isSelected ? 0.3 : 0.1),
                      shadowRadius: isSelected ? 4 : 2,
                      elevation: isSelected ? 4 : 2,
                    }}
                  >
                    <Text className="text-white font-bold text-sm text-center" style={styleTemplates.withBoldFont}>
                      {emotion.emoji} {emotion.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          
          {selectedEmotions.length > 0 && (
            <View className="mt-3 items-center">
              <Text className="text-gray-600 font-bold text-sm mb-2" style={styleTemplates.withSemiboldFont}>
                선택된 감정: {selectedEmotions.join(', ')}
              </Text>
              <TouchableOpacity
                onPress={handleEmotionComplete}
                disabled={isDisabled}
                style={{
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  backgroundColor: isDisabled ? '#9CA3AF' : '#28a745',
                  borderRadius: 8,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isDisabled ? 0.05 : 0.2,
                  shadowRadius: 4,
                  elevation: 4,
                }}
              >
                <Text className="text-white font-bold text-base text-center" style={styleTemplates.withBoldFont}>
                  선택 완료
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      
      {/* 입력 필드 - 항상 동일한 너비 유지 */}
      <View className="flex-row items-center">
        <TextInput
          className={`flex-1 border-2 rounded-xl px-4 py-3 mr-3 text-base ${
            isDisabled ? 'border-gray-300 bg-gray-100' : 'border-gray-200'
          }`}
          placeholder="메시지를 입력하세요..."
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={() => {
            if (inputText.trim() && !isDisabled) {
              sendMessage(inputText);
            }
          }}
          editable={!isDisabled}
          style={{
            minHeight: 48,
            fontSize: 16,
            ...styleTemplates.withSemiboldFont,
          }}
        />
        <TouchableOpacity
          className={`px-6 py-3 rounded-xl ${
            isDisabled
              ? 'bg-gray-400' 
              : 'bg-blue-500'
          }`}
          onPress={() => {
            if (inputText.trim() && !isDisabled) {
              sendMessage(inputText);
            }
          }}
          disabled={isDisabled || !inputText.trim()}
          style={{
            minHeight: 48,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDisabled ? 0.05 : 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <Text className="text-white font-semibold text-base" style={styleTemplates.withBoldFont}>전송</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}; 