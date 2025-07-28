import { useMemo, useCallback, useRef } from 'react';
import { View, Text } from 'react-native';

import format from 'string-format';
import { t } from 'i18next';
import { ChatMessageComponent } from './ChatMessage';
import { ChatInput, ChatInputRef } from './ChatInput';
import { styleTemplates } from '../../../styles';
import { useDyad } from '../../../api/dyad';
import { useSession } from '../hooks/useSession';
import { MessageIntent } from '@autiverse-monorepo/ts-core';
import { UserButtonMode } from '../types';
import { useJournalingStore } from '../store';
import { ComicGenerationStatus } from '../api';

export const ChatSidebar = ({
    className,
  sessionId,
  comicGenerationStatus,
  onTTSComplete,
  sendMessage,
}: {
    className?: string;
  sessionId: string;
  comicGenerationStatus: ComicGenerationStatus;
  onTTSComplete?: () => void;
  sendMessage: (
    message: string,
    intent?: MessageIntent,
    audioFilename?: string,
  ) => void;
}) => {
  const { isDyadLoading, dyad, agentName, agentConfig } = useDyad();

  const {isInputActive} = useJournalingStore()

  const { sessionInfo } = useSession({ sessionId: sessionId });

  const lastBotMessage = sessionInfo?.messages?.filter((m) => !m.isUser).pop();

  const userButtonMode = useMemo<UserButtonMode | null>(() => {
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

  const chatInputRef = useRef<ChatInputRef>(null);

  const handleOnTTSComplete = useCallback(() => {
    onTTSComplete?.();
    if (
      chatInputRef.current &&
      userButtonMode == null &&
      lastBotMessage?.intent !== MessageIntent.StartComicGeneration
    ) {
      chatInputRef.current.startRecording();
    }
  }, [onTTSComplete, userButtonMode, lastBotMessage?.intent]);

  return (
    <View className={className}>
      {/* 채팅 헤더 */}
      <View className="bg-blue-500 p-4">
        <Text
          className="text-2xl text-white"
          style={styleTemplates.withBoldFont}
        >
          {format(t('ChatStage.ChatHeaderTemplate'), { agent_name: agentName })}
        </Text>
      </View>
      {isDyadLoading == false ? (
        <>
          <View className="flex-1 p-3 bg-gray-50">
            <ChatMessageComponent
              journalEntryId={sessionId}
              agentName={agentName}
              agentConfig={agentConfig}
              onTTSComplete={handleOnTTSComplete}
            />
          </View>
          <ChatInput
            ref={chatInputRef}
            journalEntryId={sessionId}
            sendMessage={sendMessage}
            comicGenerationStatus={comicGenerationStatus}
            isInputActive={isInputActive}
            agentName={agentName}
            userButtonMode={userButtonMode}
          />
        </>
      ) : (
        <View className="flex-1" />
      )}
    </View>
  );
};
