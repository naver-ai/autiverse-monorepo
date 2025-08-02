import React, { useMemo, useCallback, useRef, useEffect, useState, memo } from 'react';
import { View, Text } from 'react-native';
import { ChatMessageComponent } from './ChatMessage';
import { ChatInput, ChatInputRef, useChatInputModalStore } from './ChatInput';
import { useDyad } from '../../../api/dyad';
import { useSession } from '../hooks/useSession';
import { MessageIntent } from '@autiverse-monorepo/ts-core';
import { UserButtonMode } from '../types';
import { useJournalingStore } from '../store';
import { ComicGenerationStatus } from '../api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native-gesture-handler';

export const ChatSidebar = memo(({
    className,
  sessionId,
  comicGenerationStatus,
  sendMessage,
}: {
    className?: string;
  sessionId: string;
  comicGenerationStatus: ComicGenerationStatus;
  sendMessage: (
    message: string,
    intent?: MessageIntent,
    audioFilename?: string,
  ) => void;
}) => {
  const { isDyadLoading, dyad, agentName, agentConfig } = useDyad();

  const {isInputActive, setIsInputActive} = useJournalingStore()

  const { sessionInfo } = useSession({ sessionId: sessionId });

  const lastBotMessage = sessionInfo?.messages?.filter((m) => !m.isUser).pop();

  const userButtonMode = useMemo<UserButtonMode | null>(() => {
    if (!lastBotMessage?.intent) return null;

    // MessageIntent 기반으로 버튼 모드 결정
    switch (lastBotMessage.intent) {
      case MessageIntent.PromptIssueExist:
        return UserButtonMode.YES_NO_BUTTON;
      case MessageIntent.PromptRevision2IssueExist:
        return UserButtonMode.YES_NO_BUTTON;
      case MessageIntent.PromptEmotion:
        return UserButtonMode.EMOTION_BUTTON;
      case MessageIntent.PromptNext:
        return UserButtonMode.NEXT_BUTTON;
      case MessageIntent.InitialTitleConfirm:
        return UserButtonMode.TITLE_SELECTION_BUTTON;
      case MessageIntent.CustomTitleConfirm:
        return UserButtonMode.YES_NO_BUTTON;
      case MessageIntent.TransitionToTitle:
        return UserButtonMode.NEXT_BUTTON;
      default:
        return null;
    }
  }, [lastBotMessage?.intent]);

  const chatInputRef = useRef<ChatInputRef>(null);

  const [lastSpokenMessageId, setLastSpokenMessageId] = useState<string | null>(null);

  const handleOnTTSStart = useCallback((messageId: string) => {
    setLastSpokenMessageId(null);
  }, []);

  const handleOnTTSComplete = useCallback((messageId: string) => {
    setLastSpokenMessageId(messageId);
  }, []);

  const inputModeActiveForId = useRef<string | undefined>(undefined);
  const lastComicStatus = useRef<string | undefined>(undefined);

  useEffect(()=>{
    inputModeActiveForId.current = undefined;
    lastComicStatus.current = undefined;
  }, [])

  // 일반적인 TTS 완료 처리
  useEffect(()=>{
    console.log("inputModeActiveForId", inputModeActiveForId.current, lastSpokenMessageId, lastBotMessage, comicGenerationStatus);
    if(inputModeActiveForId.current !== lastBotMessage?.id){
        if(lastBotMessage?.intent === MessageIntent.StartComicGeneration) {
            // 만화 생성이 완료되었을 때만 처리
            if (lastSpokenMessageId === lastBotMessage.id && comicGenerationStatus.status === 'completed') {
                console.log("Both TTS and comic generation are completed. Start input mode...");
                setIsInputActive(true);
                inputModeActiveForId.current = lastBotMessage.id;
            }
        }else if(userButtonMode === null){
            if(lastSpokenMessageId != null && lastSpokenMessageId === lastBotMessage?.id ){

                                
                console.log("Last spoken message id is the same as the last bot message id. Start input mode...");
                setIsInputActive(true);
                
                if(lastBotMessage?.intent !== MessageIntent.PromptTextInput){
                    chatInputRef.current?.startRecording();
                }else{
                    requestAnimationFrame(()=>{
                    setIsTextInputModalVisible(true);
                    })
                }
                
                inputModeActiveForId.current = lastBotMessage?.id;
            }
        }
    }
  }, [lastBotMessage?.id, lastBotMessage?.intent, lastSpokenMessageId, userButtonMode])

  // 만화 생성 상태 변경 처리 (별도 useEffect)
  useEffect(() => {
    if (lastBotMessage?.intent === MessageIntent.StartComicGeneration && 
        lastSpokenMessageId === lastBotMessage.id && 
        comicGenerationStatus.status === 'completed' &&
        inputModeActiveForId.current !== lastBotMessage.id) {
      if (__DEV__) {
        console.log("Comic generation completed, starting input mode...");
      }
      setIsInputActive(true);
      inputModeActiveForId.current = lastBotMessage.id;
    }
  }, [comicGenerationStatus.status, lastBotMessage?.id, lastBotMessage?.intent, lastSpokenMessageId])

  const { setIsTextInputModalVisible } = useChatInputModalStore();

  return (
    <SafeAreaView mode="padding" edges={['bottom', 'right']} className={className}>
      {isDyadLoading == false ? (
        <>
          <ScrollView className="flex-1" contentContainerClassName="p-3">
            <ChatMessageComponent
              journalEntryId={sessionId}
              agentName={agentName}
              agentConfig={agentConfig}
              onTTSStart={handleOnTTSStart}
              onTTSComplete={handleOnTTSComplete}
            />
          </ScrollView>
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
    </SafeAreaView>
  );
});

