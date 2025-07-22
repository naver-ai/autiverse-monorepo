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
import { useComicGeneration } from '../hooks/useComicGenerationQuery';
import { useChatbot } from '../hooks/useChatbot';
import PraiseSection from '../components/sections/PraiseSection';
import FarewellSection from '../components/sections/FarewellSection';
import { ChatStage } from '../components/stages';
import { ChatMessage, MessageIntent } from '@autiverse-monorepo/ts-core';
import { useSpeech } from '../utils';
import { useDyad } from '../../../api/dyad';
import { useJournalingStore } from '../store';
import { useSession } from '../hooks/useSession';

export const JournalingScreen = () => {
  const router = useRouter();
  const { t } = useTranslation();

  const {journalEntryId, stage, continueExistingStr}: {journalEntryId: string, stage: string, continueExistingStr: string} = useLocalSearchParams();

  const continueExisting = continueExistingStr === 'true';

  const {dyad, agentName, agentConfig, childName} = useDyad();

  const {stopSpeech, isSpeaking} = useSpeech()

  // Store 사용
  const {
    setIsLoading,
    showPraiseSection,
    showFarewellSection,
    setIsInputActive,
    setIsAfterFarewell,
    resetAll,
    resetForNewSession,
    transitionToPraiseSection,
    transitionToFarewellSection,
    prepareForMessageSend,
  } = useJournalingStore();

  // Chatbot 훅 사용
  const {
    sendMessage: sendMessageFromHook,
    startAutoComicGeneration: startAutoComicGenerationFromHook,
    addMockMessages
  } = useChatbot();

  const {sessionInfo, isSessionInfoLoading, sessionInfoLoadError, refetchSessionInfo, invalidateSessionInfo} = useSession({sessionId: journalEntryId});

  const currentStage = sessionInfo?.stage;

  console.log("journalId: ", journalEntryId, "sessionInfo: ", sessionInfo)

  // 칭찬 섹션 완료 콜백
  const handlePraiseComplete = () => {
    console.log('Praise section completed');
    transitionToFarewellSection();
  };

  // 인사말 섹션 완료 콜백 (intro 화면으로 돌아가기)
  const handleFarewellComplete = useCallback(() => {
    console.log('Farewell section completed, navigating to intro');
    
    // Farewell 이후 플래그 설정
    setIsAfterFarewell(true);
    
    // 모든 상태 초기화
    resetForNewSession();
    
    // TTS 정지
    stopSpeech();
    
    // Home 화면으로 돌아가기
    if (router) {
      router.replace('/(app)/home');
    } else {
      console.log('Router is null or undefined');
    }
  }, [setIsAfterFarewell, resetForNewSession, router]);

  // 만화 생성 훅 (React Query 기반) - 통합
  const { 
    status: comicGenerationStatus, 
    startGeneration, 
    isLoading: isComicGenerating,
    startError: comicGenerationError 
  } = useComicGeneration(journalEntryId || null);

  const isComicCompleted = comicGenerationStatus.status === 'completed';
  
  // 만화 생성 완료 처리
  useEffect(() => {
    if (comicGenerationStatus.status === 'completed' && comicGenerationStatus.comic_data) {
      console.log('Comic generation completed:', comicGenerationStatus.comic_data);
      
      // 만화 생성이 완료되면 고정 메시지들을 제거
      //TODO
      /*
      const filteredMessages = messages.filter(msg => 
        msg.text !== t('Journaling.Messages.Revision1Confirmation') &&
        msg.text !== t('Journaling.Messages.Revision2Confirmation')
      );
      addMessages(filteredMessages);*/
      
      // 세션 정보를 다시 로드하여 최신 만화 데이터 가져오기
      setTimeout(() => {
        refetchSessionInfo();
      }, 200); // 200ms
    }
  }, [comicGenerationStatus.status]);

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
  
  const sendMessage = async (messageText: string, audioFilename?: string) => {
    if (!journalEntryId || !messageText.trim()) return;

    // "다음" 버튼 클릭 시 백엔드에 메시지 전송 후 칭찬 섹션으로 넘어가기
    console.log("lastBotMessage: ", lastBotMessage, "messageText: ", messageText)
    if (messageText === t('Journaling.Messages.NextButton') && lastBotMessage?.intent === MessageIntent.PromptNext) {
      console.log('Next button clicked, sending message to backend and showing praise section...');
      
      // 백엔드에 '다음' 메시지 전송
      try {
        const data = await sendMessageFromHook({journalEntryId, message: messageText, audioFilename});
        if (data) {
          console.log('Next button message sent to backend:', data);
        }
      } catch (error) {
        console.error('Failed to send next button message:', error);
      }
      
      // 칭찬 섹션으로 넘어가기
      transitionToPraiseSection();
      return;
    }

    // TTS 상태 확인 - TTS가 진행 중이면 메시지 전송 차단
    if (isSpeaking) {
      console.log('TTS is currently active, blocking message send');
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: messageText,
      isUser: true,
      timestamp: new Date(),
    };

    addMockMessages(journalEntryId, [userMessage]);
    prepareForMessageSend();

    // Revision_1에서 다음 단계로 넘어가는 기준이 달성될 때 고정 메시지를 먼저 추가
    if (currentStage === 'revision_1' && 
        ((messageText === t('Journaling.UserResponses.No')[0] || messageText === t('Journaling.UserResponses.No')[1]) || 
         (messageText === t('Journaling.UserResponses.Yes')[0] || messageText === t('Journaling.UserResponses.Yes')[1]))) {
      
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
      const data = await sendMessageFromHook({journalEntryId, message: messageText, audioFilename});
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
        } else if (data.stage === 'revision_2' && data.response.includes('완성! 이제 수정하거나 추가하고 싶은 부분 있어? 🤔')) {
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
        if (comicGenerationStatus.status !== 'generating' && !isComicCompleted) {
          console.log('Loading session info after message sent...');
          await invalidateSessionInfo();
        } else {
          console.log('Skipping session info load - comic generation in progress or completed');
        }
        
        // React Query가 자동으로 만화 생성 상태를 폴링하므로 수동 호출 불필요
        if (data.stage === 'comic_context' || data.stage === 'revision_2') {
          console.log('Comic generation stage detected:', data.stage);
        }
        
        // auto_comic_generation 플래그 확인
        console.log('Response data:', data);
        console.log('auto_comic_generation flag:', data.auto_comic_generation);
        if (data.auto_comic_generation && !isComicCompleted) {
          console.log('Auto comic generation detected, immediately setting next stage...');
          
          //TODO 즉시 다음 단계로 stage 설정 (깜빡임 방지)
          if (data.stage === 'revision_1') {
            //setCurrentStage('comic_context');
          } else if (data.stage === 'comic_context') {
            //setCurrentStage('revision_2');
          }
          
          // 만화 생성 상태 모니터링 시작
          setTimeout(async () => {
            try {
              // 만화 생성 시작 (프로그레스바와 연결됨)
              if (journalEntryId) {
                console.log('Starting comic generation with progress tracking...');
                // 패널 내용을 빈 객체로 시작 (실제로는 서버에서 자동 생성)
                startGeneration({});
              }
              
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
                
                // 세션 정보 다시 로드 (한 번만)
                if (!isComicCompleted) {
                  await invalidateSessionInfo();
                }
              }
            } catch (error) {
              console.error('Failed to start auto comic generation:', error);
            }
          }, 500);
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

  // 인사말 섹션이 표시되어야 하는 경우
  if (showFarewellSection) {
    return (
      <FarewellSection 
        childName={childName || t('Journaling.Common.DefaultChildName')} 
        onComplete={handleFarewellComplete}
      />
    );
  }

  // 칭찬 섹션이 표시되어야 하는 경우
  if (showPraiseSection) {
    return (
      <PraiseSection 
        childName={childName || t('Journaling.Common.DefaultChildName')}
        agentConfig={agentConfig}
        onComplete={handlePraiseComplete}
      />
    );
  }

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
            continueExisting={continueExisting}
          />
      </View>
    </KeyboardAvoidingView>
  );
};