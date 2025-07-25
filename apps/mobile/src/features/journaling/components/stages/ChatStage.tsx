import React, { useCallback, useMemo, useRef } from 'react';
import { View, Text, Animated, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
// @ts-ignore
import format from 'string-format';
import { convertComicDataToPanels } from '../../utils';
import { styleTemplates } from '../../../../styles';
import { LogoImage } from '../../../../components/svg-images';
import { useJournalingStore } from '../../store';
import { ComicPanel } from '../ComicPanel';
import { ChatMessageComponent } from '../ChatMessage';
import { ChatInput, ChatInputRef } from '../ChatInput';
import { useSession } from '../../hooks/useSession';
import { UserButtonMode } from '../../types';
import { MessageIntent } from '@autiverse-monorepo/ts-core';
import { ComicGenerationStatus } from '../../api';

interface ChatStageProps {
  comicGenerationStatus: ComicGenerationStatus;
  progressAnimation: Animated.Value;
  sendMessage: (message: string, intent?: MessageIntent, audioFilename?: string) => void;
  agentName: string;
  agentConfig?: any;
  onTTSComplete?: () => void;
  sessionId: string;
  onEndSession?: () => void;
}

export const ChatStage: React.FC<ChatStageProps> = ({
  comicGenerationStatus,
  progressAnimation,
  sendMessage,
  agentName,
  agentConfig,
  onTTSComplete,
  sessionId,
  onEndSession,
}) => {
  const { t } = useTranslation();
  const {
    isSendingMessage,
    isInputActive,
  } = useJournalingStore();


  const {sessionInfo} = useSession({sessionId: sessionId});

  const comicData = sessionInfo?.panels;
 
  const currentStage = sessionInfo?.stage;
  const focusedPanel = sessionInfo?.focusedPanel;



  const lastBotMessage = sessionInfo?.messages?.filter((m) => !m.isUser).pop();

  const userButtonMode = useMemo<UserButtonMode|null>(() => {
    if (!lastBotMessage?.intent) return null;

    // MessageIntent 기반으로 버튼 모드 결정
    switch (lastBotMessage.intent) {
      case MessageIntent.PromptConfirm:
        return UserButtonMode.YES_NO_BUTTON;
      case MessageIntent.PromptIssueExist:
        return UserButtonMode.YES_NO_BUTTON;
      case MessageIntent.PromptEmotion:
        return UserButtonMode.EMOTION_BUTTON;
      case MessageIntent.PromptNext:
        return UserButtonMode.NEXT_BUTTON;
      case MessageIntent.InitialTitleConfirm:
        return UserButtonMode.YES_NO_BUTTON;
      case MessageIntent.CustomTitleConfirm:
        return UserButtonMode.YES_NO_BUTTON;
      case MessageIntent.TransitionToTitle:
        return UserButtonMode.YES_NO_BUTTON;
      default:
        return null;
    }
  }, [lastBotMessage?.intent]);

  const convertComicDataToPanelsMemo = React.useMemo(() => {
    if(!comicData) {
      return null;
    }
    return convertComicDataToPanels(comicData);
  }, [comicData]);

  const chatInputRef = useRef<ChatInputRef>(null);

  const handleOnTTSComplete = useCallback(() => {
    onTTSComplete?.();
    if(chatInputRef.current && userButtonMode == null) {
      chatInputRef.current.startRecording();
    }
  }, [onTTSComplete, userButtonMode]);

  // 만화 패널 렌더링 함수
  const renderComicPanels = () => {
    if (!convertComicDataToPanelsMemo) {
      return (
        <View className="flex-1 items-center justify-center">
          <Text className="text-lg text-gray-600 text-center" style={styleTemplates.withSemiboldFont}>
            {t('ChatStage.DefaultComicMessage')}
          </Text>
        </View>
      );
    }

    const renderPanel = (panelId: string, panelIndex: number) => {
      const panel = convertComicDataToPanelsMemo[panelId];
      const isHighlighted = focusedPanel === panelId;

      return (
        <ComicPanel
          key={panelId}
          panelId={panelId}
          panelIndex={panelIndex}
          panel={panel}
          isHighlighted={isHighlighted}
        />
      );
    };

    return (
      <View className="flex-1 p-4">
        <View className="flex-1">
          {/* 첫 번째 행 */}
          <View className="flex-row flex-1 mb-4">
            {renderPanel('panel1', 0)}
            {renderPanel('panel2', 1)}
          </View>
          {/* 두 번째 행 */}
          <View className="flex-row flex-1">
            {renderPanel('panel3', 2)}
            {renderPanel('panel4', 3)}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1">
      <View className="flex-1 flex-row">
        {/* 왼쪽: 만화 섹션 */}
        <View className="flex-[1.8] bg-white border-r-2 border-gray-200">
          {/* 만화 헤더 */}
            <View className="flex-row justify-between items-center p-3 border-b border-gray-200 pt-4">
              <LogoImage width={150} height={30} />
              <TouchableOpacity
                onPress={onEndSession}
                className="bg-yellow-500 px-3 py-2 rounded-lg"
                activeOpacity={0.8}
              >
                <Text className="text-white text-sm" style={styleTemplates.withBoldFont}>
                  {t('ChatStage.EndSession')}
              </Text>
              </TouchableOpacity>
          </View>
          
          {/* 만화 콘텐츠 */}
          <View className="flex-1 relative">
            {/* 기존 만화 또는 기본 메시지 */}
            <View className={`flex-1 ${comicGenerationStatus.status === 'generating' || comicGenerationStatus.status?.startsWith('generating') ? 'opacity-30' : ''}`}>
              {comicData && (currentStage === 'revision_1' || currentStage === 'comic_context' || currentStage === 'revision_2' || currentStage === 'title' || currentStage === 'complete') ? (
                renderComicPanels()
              ) : (
                <View className="flex-1 items-center justify-center">
                  <Text className="text-lg text-gray-600 text-center" style={styleTemplates.withSemiboldFont}>
                  {t('ChatStage.DefaultComicMessage')}
                  </Text>
                </View>
              )}
            </View>
            
            {/* 만화 생성 중일 때 반투명 오버레이와 프로그레스 바 */}
            {(comicGenerationStatus.status === 'generating' || comicGenerationStatus.status?.startsWith('generating')) && (
              <View className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center">
                <View className="bg-white p-6 rounded-xl shadow-lg max-w-sm w-4/5">
                  {/* 로딩 애니메이션 */}
                  <View className="flex-row justify-center mb-4">
                    <View className="flex-row space-x-1">
                      {[0, 1, 2].map((i) => (
                        <View
                          key={i}
                          className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"
                          style={{
                            opacity: 0.6,
                            transform: [{ scale: 0.8 }],
                          }}
                        />
                      ))}
                    </View>
                  </View>

                  {/* 메시지 */}
                  <Text className="text-center mb-4 text-lg text-gray-800" style={styleTemplates.withBoldFont}>
                    {comicGenerationStatus.message}
                  </Text>

                  {/* 프로그레스 바 */}
                  <View className="w-full bg-gray-200 rounded-full h-2 mb-2 overflow-hidden">
                    <Animated.View
                      className="bg-blue-500 h-2 rounded-full"
                      style={{
                        width: progressAnimation.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                        }),
                      }}
                    />
                  </View>

                  {/* 프로그레스 퍼센트 */}
                  <Text className="text-center text-sm text-gray-600" style={styleTemplates.withSemiboldFont}>
                    {format(t('ChatStage.ProgressCompleteTemplate'), { progress: Math.round(comicGenerationStatus.progress) })}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* 오른쪽: 채팅 섹션 */}
        <View className="flex-1 bg-white">
                  {/* 채팅 헤더 */}
        <View className="bg-blue-500 p-4">
          <Text className="text-2xl text-white" style={styleTemplates.withBoldFont}>{format(t('ChatStage.ChatHeaderTemplate'), { agent_name: agentName })}</Text>
        </View>

          {/* 현재 Agent 메시지 */}
          <View className="flex-1 p-3 bg-gray-50">
            <ChatMessageComponent
              journalEntryId={sessionId}
              agentName={agentName}
              agentConfig={agentConfig}
              onTTSComplete={handleOnTTSComplete}
            />
          </View>

          {/* 입력 영역 */}
          <ChatInput
            ref={chatInputRef}
            journalEntryId={sessionId}
            sendMessage={sendMessage}
            comicGenerationStatus={comicGenerationStatus}
            isInputActive={isInputActive}
            agentName={agentName}
            userButtonMode={userButtonMode}
          />
        </View>
      </View>


    </View>
  );
}; 