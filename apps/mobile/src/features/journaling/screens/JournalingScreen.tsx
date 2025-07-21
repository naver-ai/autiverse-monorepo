import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { PresetSelectionStage, ChatStage } from '../components/stages';
import { ChatMessage, Preset } from '@autiverse-monorepo/ts-core';
import { stopSpeech, getSpeechManager } from '../utils/speechUtils';
import { voiceRecorder } from '../utils/voiceUtils';
import { useDyad } from '../../../api/dyad';
import { useJournalingStore } from '../store';

export const JournalingScreen = () => {
  const router = useRouter();
  const { t } = useTranslation();

  const {journalEntryId, stage, continueExistingStr}: {journalEntryId?: string, stage?: string, continueExistingStr?: string} = useLocalSearchParams();

  const continueExisting = continueExistingStr === 'true';

  const {dyad, agentName, agentConfig, childName} = useDyad();

  // Store 사용
  const {
    messages,
    setMessages,
    addMessage,
    addMessages,
    setIsLoading,
    currentStage,
    setCurrentStage,
    sessionId,
    selectedLocation,
    selectedPeople,
    selectedPersonIds,
    showPresetSelection,
    isComicCompleted,
    showPraiseSection,
    showFarewellSection,
    completionMessage,
    setIsInputActive,
    setIsAfterFarewell,
    resetAll,
    resetForNewSession,
    // Semantic setters
    initializeSession,
    updateSessionInfo,
    startChatbotSession,
    transitionToPraiseSection,
    transitionToFarewellSection,
    prepareForMessageSend,
    handleMessageResponse
  } = useJournalingStore();

  // Chatbot 훅 사용
  const {
    loadSessionInfo: loadSessionInfoFromHook,
    startChatbot: startChatbotFromHook,
    startChatbotWithSuggestion: startChatbotWithSuggestionFromHook,
    sendMessage: sendMessageFromHook,
    startAutoComicGeneration: startAutoComicGenerationFromHook
  } = useChatbot();

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
  } = useComicGeneration(sessionId || null);
  
  // 만화 생성 완료 처리
  useEffect(() => {
    if (comicGenerationStatus.status === 'completed' && comicGenerationStatus.comic_data) {
      console.log('Comic generation completed:', comicGenerationStatus.comic_data);
      
      // 만화 생성이 완료되면 고정 메시지들을 제거
      const filteredMessages = messages.filter(msg => 
        msg.text !== t('Journaling.Messages.Revision1Confirmation') &&
        msg.text !== t('Journaling.Messages.Revision2Confirmation')
      );
      addMessages(filteredMessages);
      
      // 세션 정보를 다시 로드하여 최신 만화 데이터 가져오기
      setTimeout(() => {
        loadSessionInfo();
      }, 200); // 200ms
    }
  }, [comicGenerationStatus.status]);

  // 프로그레스바 애니메이션
  const progressAnimation = useRef(new Animated.Value(0)).current;

  // 이어가기 기능 처리
  useEffect(() => {
    if (continueExisting && journalEntryId && stage) {
      console.log('Continuing existing work:', { journalEntryId, stage });
      
      // 기존 session 설정
      initializeSession({
        journalEntryId,
        stage,
        showPresetSelection: false
      });
      
      // 기존 session 정보 로드
      const loadExistingSession = async () => {
        try {
          const data = await loadSessionInfoFromHook(journalEntryId);
          if (data) {
            updateSessionInfo({
              panels: data.panels,
              stage: data.stage,
              title: data.title,
              focusedPanel: data.focusedPanel
            });
            
            // 기존 메시지들 로드 (필요한 경우)
            if (data.messages) {
              setMessages(data.messages);
            }
          }
        } catch (error) {
          console.error('Error loading existing session:', error);
        }
      };
      
      loadExistingSession();
    }
  }, [continueExisting, journalEntryId, stage, loadSessionInfoFromHook]);

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
  
  const loadSessionInfo = async () => {
    if (!sessionId) return;
    
    try {
      const data = await loadSessionInfoFromHook(sessionId);
      if (data) {
        updateSessionInfo({
          panels: data.panels,
          stage: data.stage,
          title: data.title,
          focusedPanel: data.focusedPanel
        });
        
        if (data.focusedPanel) {
          console.log('Setting focusedPanel from session info:', data.focusedPanel);
        } else {
          console.log('No focusedPanel in session info, clearing focus');
        }
      }
    } catch (error) {
      console.error('Error loading session info:', error);
    }
  };

  const startChatbot = async (preset?: Preset) => {
    console.log('startChatbot called with preset:', preset);
    setIsLoading(true);
    try {
      const data = await startChatbotFromHook(preset || {});
      if (data) {
        console.log('Response data:', data);
        startChatbotSession({
          journalEntryId: data.journal_entry_id,
          stage: data.stage
        });
        
        const newMessage: ChatMessage = {
          id: Date.now().toString(),
          text: data.response,
          isUser: false,
          timestamp: new Date(),
        };
        
        addMessages([newMessage]);
        
        // 세션 정보에서 패널 데이터 가져오기
        await loadSessionInfo();
        
        console.log('Chatbot started successfully');
      } else {
        Alert.alert('오류', t('Journaling.Errors.ChatbotStartError'));
      }
    } catch (error) {
      console.error('Failed to start chatbot:', error);
      Alert.alert('오류', t('Journaling.Errors.ChatbotStartError'));
    } finally {
      setIsLoading(false);
    }
  };

  const startChatbotWithSuggestion = async () => {
    console.log('startChatbotWithSuggestion called');
    setIsLoading(true);
    try {
      const data = await startChatbotWithSuggestionFromHook();
      if (data) {
        console.log('Response data:', data);
        startChatbotSession({
          journalEntryId: data.journal_entry_id,
          stage: data.stage
        });
        
        const newMessage: ChatMessage = {
          id: Date.now().toString(),
          text: data.response,
          isUser: false,
          timestamp: new Date(),
        };
        
        addMessages([newMessage]);
        
        // 세션 정보에서 패널 데이터 가져오기
        await loadSessionInfo();
        
        console.log('Chatbot started with suggestion successfully');
      } else {
        Alert.alert('오류', t('Journaling.Errors.ChatbotStartError'));
      }
    } catch (error) {
      console.error('Failed to start chatbot with suggestion:', error);
      Alert.alert('오류', t('Journaling.Errors.ChatbotStartError'));
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (messageText: string, audioFilename?: string) => {
    if (!sessionId || !messageText.trim()) return;

    // "다음" 버튼 클릭 시 백엔드에 메시지 전송 후 칭찬 섹션으로 넘어가기
    if (messageText === t('Journaling.Messages.NextButton') && completionMessage.includes(t('Journaling.Messages.NextButtonPrompt'))) {
      console.log('Next button clicked, sending message to backend and showing praise section...');
      
      // 백엔드에 '다음' 메시지 전송
      try {
        const data = await sendMessageFromHook(sessionId, messageText, audioFilename);
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
    const speechManager = getSpeechManager();
    if (speechManager.getIsSpeaking()) {
      console.log('TTS is currently active, blocking message send');
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: messageText,
      isUser: true,
      timestamp: new Date(),
    };

    addMessage(userMessage);
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
      addMessages([fixedMessage]);
    }

    try {
      const data = await sendMessageFromHook(sessionId, messageText, audioFilename);
      if (data) {
        const botMessage: ChatMessage = {
          id: (Date.now() + 2).toString(),
          text: data.response,
          isUser: false,
          timestamp: new Date(),
        };

        // 기본 응답 처리
        handleMessageResponse({
          stage: data.stage,
          response: data.response,
          focusedPanel: data.focusedPanel,
          auto_comic_generation: data.auto_comic_generation
        });

        // 완료 메시지 감지 (다음 버튼을 눌러야 넘어감)
        if (data.response.includes(t('Journaling.Messages.NextButtonPrompt'))) {
          addMessage(botMessage);
        }
        // comic_context 메시지는 바로 표시 (만화 생성 완료 시 onComplete에서 다행이다~ 메시지가 제거됨)
        else if (data.stage === 'comic_context') {
          console.log('Comic context message detected, adding immediately...');
          addMessage(botMessage);
        } else if (data.stage === 'revision_2' && data.response.includes('완성! 이제 수정하거나 추가하고 싶은 부분 있어? 🤔')) {
          // Revision_2에서 만화 생성이 시작될 때 고정 메시지 추가
          console.log('Revision_2 comic generation detected, adding fixed message...');
          
          const fixedMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            text: t('Journaling.Messages.Revision2Confirmation'),
            isUser: false,
            timestamp: new Date(),
          };
          addMessage(fixedMessage);
          
          // revision_2 메시지는 바로 표시 (만화 생성 완료 시 onComplete에서 고정 메시지가 제거됨)
          addMessage(botMessage);
        } else {
          // 다른 메시지들은 바로 표시
          addMessage(botMessage);
        }
        
        // 세션 정보에서 최신 패널 데이터 가져오기 (만화 생성이 진행 중이지 않을 때만)
        if (comicGenerationStatus.status !== 'generating' && !isComicCompleted) {
          console.log('Loading session info after message sent...');
          await loadSessionInfo();
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
          
          // 즉시 다음 단계로 stage 설정 (깜빡임 방지)
          if (data.stage === 'revision_1') {
            setCurrentStage('comic_context');
          } else if (data.stage === 'comic_context') {
            setCurrentStage('revision_2');
          }
          
          // 만화 생성 상태 모니터링 시작
          setTimeout(async () => {
            try {
              // 만화 생성 시작 (프로그레스바와 연결됨)
              if (sessionId) {
                console.log('Starting comic generation with progress tracking...');
                // 패널 내용을 빈 객체로 시작 (실제로는 서버에서 자동 생성)
                startGeneration({});
              }
              
              // auto-comic-generation API 호출
              const autoData = await startAutoComicGenerationFromHook(sessionId);
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
                
                addMessage(autoBotMessage);
                
                // 세션 정보 다시 로드 (한 번만)
                if (!isComicCompleted) {
                  await loadSessionInfo();
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

  // 선택 완료 핸들러 (API 데이터 또는 프리셋 데이터 사용)
  const handleSelectionComplete = async () => {
    if (selectedLocation && dyad) {
      let peopleList: string[] = [];
      
      if (selectedPersonIds.length > 0) {
        // API 데이터에서 선택된 사람들의 이름 가져오기
        peopleList = dyad.people.filter(person => selectedPersonIds.includes(person.id))
          .map(person => person.name);
      } else if (selectedPeople.length > 0) {
        // 프리셋 데이터 사용
        peopleList = selectedPeople;
      }
      
      if (peopleList.length > 0) {
        const customPreset: Preset = {
          location: selectedLocation,
          people: peopleList,
          label: `${selectedLocation}에서 ${peopleList.join(', ')}와`,
          dayInfo: []
        };
        await startChatbot(customPreset);
      }
    }
  };

  // 자유롭게 시작하기 핸들러
  const handleFreeStart = async () => {
    // 자유롭게 시작하기는 항상 아무 정보 없이 시작
    await startChatbot();
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
            
            // 음성 녹음 정리
            try {
              // 녹음 중인지 확인하고 중지
              if (voiceRecorder.isRecording) {
                console.log('Stopping voice recording...');
                await voiceRecorder.stopRecording();
              }
              
              // 녹음 객체가 남아있다면 정리 (안전을 위해)
              if (voiceRecorder.recording) {
                console.log('Cleaning up voice recording object...');
                try {
                  await voiceRecorder.recording.stopAndUnloadAsync();
                } catch (cleanupError) {
                  console.log('Voice recording cleanup error:', cleanupError);
                }
                voiceRecorder.recording = null;
                voiceRecorder.isRecording = false;
              }
            } catch (error) {
              console.log(t('Journaling.VoiceRecording.CleanupError'), error);
            }
            
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
        {showPresetSelection ? (
          <PresetSelectionStage
            onSelectionComplete={handleSelectionComplete}
            onStartChatbotWithSuggestion={startChatbotWithSuggestion}
            onFreeStart={handleFreeStart}
          />
        ) : (
          <ChatStage
            comicGenerationStatus={comicGenerationStatus}
            progressAnimation={progressAnimation}
            sendMessage={sendMessage}
            agentName={agentName || t('Journaling.Common.DefaultAgentName')}
            agentConfig={agentConfig}
            sessionId={sessionId || undefined}
            loadSessionInfo={loadSessionInfoFromHook}
            onTTSComplete={() => {
              // 완료 메시지가 아닐 때만 ChatInput 활성화
              if (!completionMessage) {
                setIsInputActive(true);
              }
            }}
            onEndSession={handleEndSession}
            continueExisting={continueExisting}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
};