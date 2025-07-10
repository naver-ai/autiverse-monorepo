import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styleTemplates } from '../../../styles';

interface ChatButtonsProps {
  showYesNoButtons: boolean;
  showEmotionButtons: boolean;
  buttonTexts: { left: string; right: string };
  isDisabled: boolean;
  sendMessage: (message: string) => void;
  onButtonsVisibilityChange?: (hasButtons: boolean) => void;
}

export const ChatButtons: React.FC<ChatButtonsProps> = ({
  showYesNoButtons,
  showEmotionButtons,
  buttonTexts,
  isDisabled,
  sendMessage,
  onButtonsVisibilityChange
}) => {
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);

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

  // 버튼 표시 여부가 변경될 때 콜백 호출
  React.useEffect(() => {
    const hasButtons = showYesNoButtons || showEmotionButtons;
    onButtonsVisibilityChange?.(hasButtons);
  }, [showYesNoButtons, showEmotionButtons, onButtonsVisibilityChange]);

  return (
    <>
      {/* Yes/No 버튼 */}
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
    </>
  );
}; 