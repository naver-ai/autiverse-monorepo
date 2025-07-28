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
import { SafeAreaView } from 'react-native-safe-area-context';
import { TailwindButton } from '../../../components/TailwindButton';
import { ArrowLeftIcon } from '../../../components/svg-images';
import format from 'string-format';
import { useDyad } from '../../../api/dyad';
import { HomeScreenBackground } from '../../../components/backgrounds';


const Header = ({handleEndSession}: {handleEndSession: () => void}) => {
  const {t} = useTranslation();
  const {agentName} = useDyad();

  const title = format(t('Journaling.Header.TitleTemplate'), { agent_name: agentName });

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="border-b border-gray-200 bg-white">
      <View className="h-header text-center pt-1 flex flex-row items-center justify-center">
        <TailwindButton
                  onPress={handleEndSession}
                  containerClassName="absolute left-0 top-0 bottom-0"
                  buttonStyleClassName="bg-transparent pl-1 pr-3 flex-row"
                  roundedClassName="rounded-lg"
                  shadowClassName="shadow-none"
                  titleClassName="text-white">
                  <ArrowLeftIcon width={28} height={28} fill="gray"/>
                  <Text className="text-gray-500" style={styleTemplates.withBoldFont}>
                    {t('ChatStage.EndSession')}
                  </Text>
        </TailwindButton>
        <Text className="text-gray-600 text-xl" style={styleTemplates.withBoldFont}>{title}</Text>
      </View>
      
    </SafeAreaView>
  )
}

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
      <View className='flex-1'>
        <HomeScreenBackground/>
        <Header handleEndSession={handleEndSession}/>
        <View className="flex-row flex-1">
          <View className="flex-[1.8] border-r-2 border-gray-200">
              <ComicView
                className="flex-1 relative"
                comicGenerationStatus={comicGenerationStatus}
                progressAnimation={progressAnimation}
                sessionId={journalEntryId}
              />
          </View>
          <ChatSidebar
              className="flex-1 bg-white/50"
              sessionId={journalEntryId}
              comicGenerationStatus={comicGenerationStatus}
              sendMessage={sendMessage}
          />
        </View>
      </View>
      
    </Portal.Host>
  );
};