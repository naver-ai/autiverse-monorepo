import { useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useComicGeneration } from '../hooks/useComicGeneration';
import { useChatbot } from '../hooks/useChatbot';
import { ChatStage } from '../components/stages';
import { ChatMessage, JournalEntryStage, JournalingSessionInfo, MessageIntent } from '@autiverse-monorepo/ts-core';
import { useSpeech } from '../utils';
import { useDyad } from '../../../api/dyad';
import { useJournalingStore } from '../store';
import { useSession } from '../hooks/useSession';
import { useQueryClient } from '@tanstack/react-query';

export const JournalingScreen = () => {
  const router = useRouter();
  const { t } = useTranslation();

  const {journalEntryId, stage}: {journalEntryId: string, stage: string} = useLocalSearchParams();

  const {dyad, agentName, agentConfig, childName} = useDyad();

  const {stopSpeech, isSpeaking} = useSpeech()

  // Store 사용
  const {
    setIsLoading,
    setIsInputActive,
    resetAll,
  } = useJournalingStore();

  // Chatbot 훅 사용
  const {
    sendMessage: sendMessageFromHook,
    startAutoComicGeneration: startAutoComicGenerationFromHook,
    addMockMessages
  } = useChatbot();

  const {sessionInfo, invalidateSessionInfo} = useSession({sessionId: journalEntryId});

  const currentStage = sessionInfo?.stage;

  const queryClient = useQueryClient();

  // 만화 생성 훅 (React Query 기반) - 통합
  const { 
    status: comicGenerationStatus, 
    startGeneration, 
  } = useComicGeneration(journalEntryId || null);

  // 프로그레스바 애니메이션
  const progressAnimation = useRef(new Animated.Value(0)).current;

  // 프로그레스바 애니메이션 업데이트
  useEffect(() => {
    if (comicGenerationStatus.status === 'generating' || comicGenerationStatus.status?.startsWith('generating')) {
      console.log('Progress animation update:', comicGenerationStatus.progress);
      // requestAnimationFrame을 사용하여 렌더링 후 애니메이션 실행
      requestAnimationFrame(() => {
        Animated.timing(progressAnimation, {
          toValue: comicGenerationStatus.progress,
          duration: 500,
          useNativeDriver: false,
        }).start();
      });
    }
  }, [comicGenerationStatus.progress, comicGenerationStatus.status]);

  // 만화 생성 상태 디버깅 (개발 모드에서만)
  useEffect(() => {
    if (__DEV__) {
      console.log('Comic generation status changed:', {
        status: comicGenerationStatus.status,
        progress: comicGenerationStatus.progress,
        message: comicGenerationStatus.message,
        has_comic_data: !!comicGenerationStatus.comic_data
      });
    }
  }, [comicGenerationStatus.status, comicGenerationStatus.progress, comicGenerationStatus.message]);

  const lastBotMessage = useMemo(() => {
    // Search from the end for the last message where isUser is false
    return sessionInfo?.messages && sessionInfo.messages.length > 0
      ? [...sessionInfo.messages].reverse().find(msg => msg.isUser === false)
      : undefined;
  }, [sessionInfo]);
  
  const sendMessage = async (messageText: string, intent?: MessageIntent, audioFilename?: string) => {

    setIsLoading(true);

    if (!journalEntryId || !messageText.trim()) return;

    // "다음" 버튼 클릭 시 백엔드에 메시지 전송 후 칭찬 섹션으로 넘어가기
    console.log("lastBotMessage: ", lastBotMessage, "messageText: ", messageText)
    if (currentStage === JournalEntryStage.Revision2 && intent == MessageIntent.AnswerNext) {
      console.log('Next button clicked, sending message to backend and showing praise section...');
      
      // 백엔드에 '다음' 메시지 전송
      try {
        const data = await sendMessageFromHook({journalEntryId, message: messageText, intent, audioFilename});
        if (data) {
          console.log('Next button message sent to backend:', data);
        }
      } catch (error) {
        console.error('Failed to send next button message:', error);
      }
      
      // 칭찬 섹션으로 넘어가기
      router.replace({pathname: '/(app)/ending', params: {journalEntryId}});
      setIsLoading(false);
      return;
    }

    // TTS 상태 확인 - TTS가 진행 중이면 메시지 전송 차단
    if (isSpeaking) {
      console.log('TTS is currently active, blocking message send');
      setIsLoading(false);
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: messageText,
      isUser: true,
      timestamp: new Date(),
    };

    addMockMessages(journalEntryId, [userMessage]);

    // Revision_1에서 다음 단계로 넘어가는 기준이 달성될 때 고정 메시지를 먼저 추가
    if (currentStage === 'revision_1' && 
        ((intent === MessageIntent.AnswerNegative) || 
         (intent === MessageIntent.AnswerPositive))) {

          console.log("Revision_1에서 다음 단계로 넘어가는 기준이 달성될 때 고정 메시지를 먼저 추가 - ", t('Journaling.Messages.Revision1Confirmation'))
      
      // 고정 메시지를 즉시 추가
      const fixedMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: t('Journaling.Messages.Revision1Confirmation'),
        isUser: false,
        timestamp: new Date(),
      };
      addMockMessages(journalEntryId, [fixedMessage]);
    }

    try {
      const data = await sendMessageFromHook({journalEntryId, message: messageText, intent, audioFilename});
      if (data) {
        const botMessage: ChatMessage = {
          id: (Date.now() + 2).toString(),
          text: data.response,
          isUser: false,
          timestamp: new Date(),
          intent: data.intent,
          metadata: data.metadata,
        };

        // 완료 메시지 감지 (다음 버튼을 눌러야 넘어감)
        if (data.intent === MessageIntent.PromptNext) {
          addMockMessages(journalEntryId, [botMessage]);
        }
        // comic_context 메시지는 바로 표시 (만화 생성 완료 시 onComplete에서 다행이다~ 메시지가 제거됨)
        else if (data.stage === 'comic_context') {
          console.log('Comic context message detected, adding immediately...');
          
          addMockMessages(journalEntryId, [botMessage]);
        } else if (data.stage === 'revision_2' && data.intent === MessageIntent.PromptIssueExist) {
          // Revision_2에서 만화 생성이 시작될 때 고정 메시지 추가
          console.log('Revision_2 comic generation detected, adding fixed message...');
          
          const fixedMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            text: t('Journaling.Messages.Revision2Confirmation'),
            isUser: false,
            timestamp: new Date(),
          };
          addMockMessages(journalEntryId, [fixedMessage]);
          
          // revision_2 메시지는 바로 표시 (만화 생성 완료 시 onComplete에서 고정 메시지가 제거됨)
          addMockMessages(journalEntryId, [botMessage]);
        } else {
          // 다른 메시지들은 바로 표시
          addMockMessages(journalEntryId, [botMessage]);
        }
        
        // 세션 정보에서 최신 패널 데이터 가져오기 (만화 생성이 진행 중이지 않을 때만)
        if (comicGenerationStatus.status !== 'generating') {
          console.log('Loading session info after message sent...');
          //await invalidateSessionInfo();
        } else {
          console.log('Skipping session info load - comic generation in progress or completed');
        }


        setIsLoading(false); // 로딩 상태 초기화 미리
        
        // auto_comic_generation 플래그 확인
        console.log('Response data:', data);
        console.log(data.intent == MessageIntent.StartComicGeneration)
        if (data.intent == MessageIntent.StartComicGeneration) {
          
          //즉시 다음 단계로 stage 설정 (깜빡임 방지)
          if (data.stage === 'revision_1') {
            queryClient.setQueryData(['session', journalEntryId], (old: JournalingSessionInfo) => (old ? {
              ...old,
              stage: 'comic_context'
            } : undefined));
          } else if (data.stage === 'comic_context') {
            queryClient.setQueryData(['session', journalEntryId], (old: JournalingSessionInfo) => (old ? {
              ...old,
              stage: 'revision_2'
            } : undefined));
          }
          
          // 만화 생성 상태 모니터링 시작
            try {
              // 만화 생성 시작 (프로그레스바와 연결됨)
              if (journalEntryId) {
                console.log('Starting comic generation with progress tracking...');
                startGeneration();
              }
              /*
              // auto-comic-generation API 호출
              const autoData = await startAutoComicGenerationFromHook(journalEntryId);
              if (autoData) {
                
                console.log('Auto comic generation response:', autoData);
                console.log('Auto comic generation stage:', autoData.stage);
                
                // stage는 이미 위에서 설정했으므로 여기서는 설정하지 않음
                
                const autoBotMessage: ChatMessage = {
                  id: (Date.now() + 3).toString(),
                  text: autoData.response,
                  isUser: false,
                  timestamp: new Date(),
                };
                
                addMockMessages(journalEntryId, [autoBotMessage]);
                
              }*/
            } catch (error) {
              console.error('Failed to start comic generation:', error);
            }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('오류', t('Journaling.Errors.MessageSendError'));
    } finally {
      setIsLoading(false);
    }
  };

  // 세션 종료 핸들러
  const handleEndSession = () => {
    Alert.alert(
      t('Journaling.SessionEnd.Title'),
      t('Journaling.SessionEnd.Message'),
      [
        {
          text: t('Journaling.SessionEnd.Cancel'),
          style: 'cancel',
        },
        {
          text: t('Journaling.SessionEnd.End'),
          style: 'destructive',
          onPress: async () => {
            // TTS 정지
            stopSpeech();
                      
            // 모든 상태 초기화
            resetAll();
            
            // Home 화면으로 돌아가기
            if (router) {
              router.replace('/(app)/home');
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 bg-gray-100">
          <ChatStage
            comicGenerationStatus={comicGenerationStatus}
            progressAnimation={progressAnimation}
            sendMessage={sendMessage}
            agentName={agentName || t('Journaling.Common.DefaultAgentName')}
            agentConfig={agentConfig}
            sessionId={journalEntryId}
            onTTSComplete={() => {
              // 완료 메시지가 아닐 때만 ChatInput 활성화
              if (lastBotMessage?.intent !== MessageIntent.PromptNext) {
                setIsInputActive(true);
              }
            }}
            onEndSession={handleEndSession}
          />
      </View>
    </KeyboardAvoidingView>
  );
};