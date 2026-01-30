import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styleTemplates } from '../../../styles';
import { UserButtonMode } from '../types';
import { MessageIntent } from '@autiverse-monorepo/ts-core';
import { useSession } from '../hooks/useSession';
import { useTranslation } from 'react-i18next';

interface ChatButtonsProps {
  sessionId: string;
  buttonMode: UserButtonMode|null;
  isDisabled: boolean;
  sendMessage: (message: string, intent?: MessageIntent, audioFilename?: string) => void;
  onButtonsVisibilityChange: (hasButtons: boolean) => void;
}

export const ChatButtons: React.FC<ChatButtonsProps> = ({
  sessionId,
  buttonMode,
  isDisabled,
  sendMessage,
  onButtonsVisibilityChange
}) => {

  const {t} = useTranslation();

  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);

  const emotionButtons = [
    // { text: t('Emotions.Happy'), emoji: '😊', key: 'Happy' },
    // { text: t('Emotions.Joyful'), emoji: '😄', key: 'Joyful' },
    // { text: t('Emotions.Loved'), emoji: '🥰', key: 'Loved' },
    // { text: t('Emotions.Excited'), emoji: '🤩', key: 'Excited' },
    // { text: t('Emotions.Sad'), emoji: '😢', key: 'Sad' },
    // { text: t('Emotions.Angry'), emoji: '😠', key: 'Angry' },
    // { text: t('Emotions.Upset'), emoji: '😞', key: 'Upset' },
    // { text: t('Emotions.Scared'), emoji: '😨', key: 'Scared' },
    // { text: t('Emotions.Afraid'), emoji: '😰', key: 'Afraid' },
    // { text: t('Emotions.Surprised'), emoji: '😲', key: 'Surprised' },
    // { text: t('Emotions.Amazed'), emoji: '😍', key: 'Amazed' },
    // { text: t('Emotions.Bored'), emoji: '😴', key: 'Bored' }
    
    { text: t('Emotions.Happy'), emoji: '😊', key: '즐거웠다' },
    { text: t('Emotions.Joyful'), emoji: '😄', key: '기뻤다' },
    { text: t('Emotions.Loved'), emoji: '🥰', key: '행복했다' },
    { text: t('Emotions.Excited'), emoji: '🤩', key: '신났다' },
    { text: t('Emotions.Sad'), emoji: '😢', key: '슬펐다' },
    { text: t('Emotions.Angry'), emoji: '😠', key: '화났다' },
    { text: t('Emotions.Upset'), emoji: '😞', key: '속상했다' },
    { text: t('Emotions.Scared'), emoji: '😨', key: '무서웠다' },
    { text: t('Emotions.Afraid'), emoji: '😰', key: '두려웠다' },
    { text: t('Emotions.Surprised'), emoji: '😲', key: '놀랐다' },
    { text: t('Emotions.Amazed'), emoji: '😍', key: '감탄했다' },
    { text: t('Emotions.Bored'), emoji: '😴', key: '지루했다' }
  ];


  const { sessionInfo } = useSession({ sessionId });
  const lastBotMessage = sessionInfo?.messages?.filter((m) => !m.isUser).pop();

  // 버튼 내용 결정
  const buttonTexts = useMemo<{left: {label: string, intent: MessageIntent}, right: {label: string, intent: MessageIntent}} | undefined>(() => {
    const previousBotIntent = lastBotMessage?.intent

    switch(previousBotIntent) {
      case MessageIntent.PromptIssueExist:
        return {
          left: {label: t('ChatInput.ButtonLabels.Wrong'), intent: MessageIntent.AnswerNegative},
          right: {label: t('ChatInput.ButtonLabels.AllCorrect'), intent: MessageIntent.AnswerPositive},
        };
      case MessageIntent.PromptRevision2IssueExist:
        return {
          left: {label: t('ChatInput.ButtonLabels.WrongRevision2'), intent: MessageIntent.AnswerNegative},
          right: {label: t('ChatInput.ButtonLabels.AllCorrectRevision2'), intent: MessageIntent.AnswerPositive},
        };
      case MessageIntent.PromptRevision2Confirm:
        return {
          left: {label: t('ChatInput.ButtonLabels.Yes'), intent: MessageIntent.AnswerNegative},
          right: {label: t('ChatInput.ButtonLabels.No'), intent: MessageIntent.AnswerPositive},
        };
      case MessageIntent.TransitionToTitle:
        return {
          left: {label: t('ChatInput.ButtonLabels.LetsDoIt'), intent: MessageIntent.AnswerPositive},
          right: {label: t('ChatInput.ButtonLabels.Good'), intent: MessageIntent.AnswerPositive},
        };
      case MessageIntent.InitialTitleConfirm:
        return {
          left: {label: t('ChatInput.ButtonLabels.NotGood'), intent: MessageIntent.AnswerNegative},
          right: {label: t('ChatInput.ButtonLabels.Good3'), intent: MessageIntent.AnswerPositive},
        };
      case MessageIntent.CustomTitleConfirm:
        return {
          left: {label: t('ChatInput.ButtonLabels.NoOther'), intent: MessageIntent.AnswerNegative},
          right: {label: t('ChatInput.ButtonLabels.YesGood'), intent: MessageIntent.AnswerPositive},
        }
      default:
        return undefined;
    }
  }, [lastBotMessage?.intent])

  const showYesNoButtons = buttonMode === UserButtonMode.YES_NO_BUTTON && buttonTexts !== undefined;
  const showEmotionButtons = buttonMode === UserButtonMode.EMOTION_BUTTON;
  const showNextButton = buttonMode === UserButtonMode.NEXT_BUTTON;
  const showTitleSelectionButtons = buttonMode === UserButtonMode.TITLE_SELECTION_BUTTON;

  const handleEmotionClick = (emotionKey: string) => {
    if (isDisabled) return;
    
    if (selectedEmotions.includes(emotionKey)) {
      setSelectedEmotions(selectedEmotions.filter(e => e !== emotionKey));
    } else {
      setSelectedEmotions([...selectedEmotions, emotionKey]);
    }
  };

  const handleEmotionComplete = () => {
    if (selectedEmotions.length > 0 && !isDisabled) {
      const selectedEmotionTexts = selectedEmotions.map(key => {
        const emotion = emotionButtons.find(e => e.key === key);
        return emotion?.text || key;
      });
      sendMessage(selectedEmotionTexts.join(', '), MessageIntent.AnswerEmotion);
      setSelectedEmotions([]);
    }
  };

  // 버튼 표시 여부가 변경될 때 콜백 호출
  React.useEffect(() => {
    const hasButtons = showYesNoButtons || showEmotionButtons || showTitleSelectionButtons;
    onButtonsVisibilityChange?.(hasButtons);
  }, [showYesNoButtons, showEmotionButtons, showTitleSelectionButtons, onButtonsVisibilityChange]);

  return (
    <>
      {/* Yes/No 버튼 - AI 말하는 높이와 동일하게 설정 */}
      {showYesNoButtons && (
        <View className="flex-row gap-3 mb-4">
          <TouchableOpacity
            className={`flex-1 px-6 py-4 rounded-xl justify-center ${
              isDisabled ? 'bg-gray-400' : 'bg-gray-500'
            }`}
            onPress={() => sendMessage(buttonTexts.left.label, buttonTexts.left.intent)}
            disabled={isDisabled}
            style={{
              backgroundColor: isDisabled ? '#9CA3AF' : '#6c757d',
              minHeight: 122, // AI 말하는 높이보다 조금 더 높게
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text className="text-white text-xl text-center" style={styleTemplates.withBoldFont}>{buttonTexts.left.label}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 px-6 py-4 rounded-xl justify-center ${
              isDisabled ? 'bg-gray-400' : 'bg-blue-500'
            }`}
            onPress={() => sendMessage(buttonTexts.right.label, buttonTexts.right.intent)}
            disabled={isDisabled}
            style={{
              backgroundColor: isDisabled ? '#9CA3AF' : '#4A90E2',
              minHeight: 122, // AI 말하는 높이보다 조금 더 높게
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text className="text-white text-xl text-center" style={styleTemplates.withBoldFont}>{buttonTexts.right.label}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 제목 선택 버튼 - 위에 1, 2, 3 버튼 (파란색), 아래에 "다 별로야" 버튼 (회색) */}
      {showTitleSelectionButtons && (
        <View className="mb-4">
          {/* 위쪽: 1, 2, 3 버튼 (파란색) */}
          <View className="flex-row gap-3 mb-3">
            {[1, 2, 3].map((number) => (
              <TouchableOpacity
                key={number}
                className="flex-1 px-6 py-4 rounded-xl justify-center"
                onPress={() => sendMessage(number.toString())}
                disabled={isDisabled}
                style={{
                  backgroundColor: isDisabled ? '#9CA3AF' : '#4A90E2',
                  minHeight: 80,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <Text className="text-white text-2xl text-center" style={styleTemplates.withBoldFont}>
                  {number}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* 아래쪽: "다 별로야" 버튼 (회색) */}
          <TouchableOpacity
            className="px-6 py-4 rounded-xl justify-center"
            onPress={() => sendMessage(t('ChatInput.ButtonLabels.NotGoodAtAll'))}
            disabled={isDisabled}
            style={{
              backgroundColor: isDisabled ? '#9CA3AF' : '#6c757d',
              minHeight: 60,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text className="text-white text-xl text-center" style={styleTemplates.withBoldFont}>
              {t('ChatInput.ButtonLabels.NotGoodAtAll')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 감정 버튼 - 3x4 그리드 (기존 높이 유지) */}
      {showEmotionButtons && (
        <View className="mb-4 p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
          {[0, 1, 2, 3].map((row) => (
            <View key={row} className="flex-row gap-2 mb-2">
              {emotionButtons.slice(row * 3, (row + 1) * 3).map((emotion) => {
                const isSelected = selectedEmotions.includes(emotion.key);
                return (
                  <TouchableOpacity
                    key={emotion.key}
                    className="flex-1"
                    onPress={() => handleEmotionClick(emotion.key)}
                    disabled={isDisabled}
                    style={{
                      padding: 12,
                      backgroundColor: isDisabled 
                        ? '#9CA3AF' 
                        : isSelected ? '#28a745' : '#4A90E2',
                      borderRadius: 8,
                      minHeight: 50,
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: isDisabled ? 0.05 : (isSelected ? 0.3 : 0.1),
                      shadowRadius: isSelected ? 4 : 2,
                      elevation: isSelected ? 4 : 2,
                    }}
                  >
                    <Text 
                      className="text-white text-lg text-center" 
                      style={styleTemplates.withBoldFont}
                      numberOfLines={1}
                      adjustsFontSizeToFit={true}
                      minimumFontScale={0.7}
                    >
                      {emotion.emoji} {emotion.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          
          {selectedEmotions.length > 0 && (
            <View className="mt-3 items-center">
              <Text className="text-gray-600 text-lg mb-2" style={styleTemplates.withSemiboldFont}>
                {/* Selected emotions: {selectedEmotions.join(', ')} */}
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
                <Text className="text-white text-lg text-center" style={styleTemplates.withBoldFont}>
                  {/* Done */}
                  선택 완료
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* 다음 버튼 - AI 말하는 박스와 동일한 스타일 */}
      {showNextButton && (
        <View className="flex-row justify-center mb-4">
          <TouchableOpacity
            className={`px-6 py-4 rounded-xl justify-center ${
              isDisabled ? 'bg-gray-400' : 'bg-blue-500'
            }`}
            onPress={() => sendMessage(t('Next'), MessageIntent.AnswerNext)}
            disabled={isDisabled}
            style={{
              backgroundColor: isDisabled ? '#9CA3AF' : '#4A90E2',
              minHeight: 122, // AI 말하는 높이와 동일
              minWidth: 200, // 적절한 너비 설정
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text className="text-white text-2xl text-center" style={styleTemplates.withBoldFont}>{t('Next')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}; 