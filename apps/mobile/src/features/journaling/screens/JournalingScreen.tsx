import { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Alert,
  Animated,
  TouchableOpacity,
  Text,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useComicGeneration } from '../hooks/useComicGeneration';
import { useChatbot } from '../hooks/useChatbot';
import { ComicView } from '../components/ComicView';
import { ChatMessage, JournalEntryStage, MessageIntent } from '@autiverse-monorepo/ts-core';
import { useSpeech, useVoiceRecorderState } from '../utils';
import { useJournalingStore } from '../store';
import { useSession } from '../hooks/useSession';
import { useQueryClient } from '@tanstack/react-query';
import { Portal } from 'react-native-paper';
import { ChatSidebar } from '../components/ChatSidebar';
import { styleTemplates } from '../../../styles';
import { LogoImage } from '../../../components/svg-images';

export const JournalingScreen = () => {
  const router = useRouter();
  const { t } = useTranslation();

  const {journalEntryId}: {journalEntryId: string} = useLocalSearchParams();

  const {stopSpeech, isSpeaking} = useSpeech()

  const {reset: resetVoiceRecorderState} = useVoiceRecorderState();
  useEffect(()=>{
    resetVoiceRecorderState();
  }, [resetVoiceRecorderState]);
  // Store 사용
  const {
    setIsSendingMessage,
    setIsInputActive,
    resetAll,
  } = useJournalingStore();

  // Chatbot 훅 사용
  const {
    sendMessage: sendMessageFromHook,
    addMockMessages
  } = useChatbot();

  const {sessionInfo} = useSession({sessionId: journalEntryId});

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

    setIsSendingMessage(true);

    if (!journalEntryId || !messageText.trim()) return;

    // "다음" 버튼 클릭 시 백엔드에 메시지 전송 후 칭찬 섹션으로 넘어가기
    console.log("lastBotMessage: ", lastBotMessage, "messageText: ", messageText)
    if (currentStage === JournalEntryStage.Title && intent == MessageIntent.AnswerNext) {
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
      setIsSendingMessage(false);
      return;
    }

    // TTS 상태 확인 - TTS가 진행 중이면 메시지 전송 차단
    if (isSpeaking) {
      console.log('TTS is currently active, blocking message send');
      setIsSendingMessage(false);
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: messageText,
      isUser: true,
      timestamp: new Date(),
    };

    addMockMessages(journalEntryId, [userMessage]);

    try {
      const data = await sendMessageFromHook({journalEntryId, message: messageText, intent, audioFilename});
      if (data) {

        setIsSendingMessage(false); // 로딩 상태 초기화 미리
        
        // auto_comic_generation 플래그 확인
        console.log('Response data:', data);
        console.log(data.intent == MessageIntent.StartComicGeneration)
        if (data.intent == MessageIntent.StartComicGeneration) {
          // 만화 생성 상태 모니터링 시작
            try {
              // 만화 생성 시작 (프로그레스바와 연결됨)
              if (journalEntryId) {
                console.log('Starting comic generation with progress tracking...');
                startGeneration();
              }
            } catch (error) {
              console.error('Failed to start comic generation:', error);
            }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('오류', t('Journaling.Errors.MessageSendError'));
    } finally {
      setIsSendingMessage(false);
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
    <Portal.Host>
      <View className='flex-1 bg-gray-100 flex-row'>
        <View className="flex-[1.8] bg-white border-r-2 border-gray-200">
          {/* 만화 헤더 */}
          <View className="flex-row justify-between items-center p-3 border-b border-gray-200 pt-4">
              <LogoImage width={150} height={30} />
              <TouchableOpacity
                onPress={handleEndSession}
                className="bg-yellow-500 px-3 py-2 rounded-lg"
                activeOpacity={0.8}
              >
                <Text className="text-white text-sm" style={styleTemplates.withBoldFont}>
                  {t('ChatStage.EndSession')}
              </Text>
              </TouchableOpacity>
          </View>
          <ComicView
            className="flex-1 relative"
            comicGenerationStatus={comicGenerationStatus}
            progressAnimation={progressAnimation}
            sessionId={journalEntryId}
          />
        </View>
        <ChatSidebar
          className="flex-1 bg-white"
          sessionId={journalEntryId}
          comicGenerationStatus={comicGenerationStatus}
          sendMessage={sendMessage}
          onTTSComplete={() => {
            // 완료 메시지가 아닐 때만 ChatInput 활성화
            if (lastBotMessage?.intent !== MessageIntent.PromptNext) {
              setIsInputActive(true);
            }
          }}
        />
      </View>
      
    </Portal.Host>
  );
};