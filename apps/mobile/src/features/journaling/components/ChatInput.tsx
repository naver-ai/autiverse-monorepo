import React, { useEffect, useState } from 'react';
import { View, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSpeechState } from '../utils/speechUtils';
import { useVoiceRecorder } from '../utils';
import { transcribeAudio } from '../utils/voiceUtils';
import { useDyad } from '../../../api/dyad';
import { uploadAudioFile } from '../api';
import { useAuth } from '../../auth/hooks';
import { usePrevious } from '@uidotdev/usehooks';
import { useSession } from '../hooks/useSession';
import { VoiceRecordingStatus } from './VoiceRecordingStatus';
import { ChatButtons } from './ChatButtons';
import { ChatText } from './ChatText';
import { MessageIntent } from '@autiverse-monorepo/ts-core';

interface ChatInputProps {
  journalEntryId: string;
  sendMessage: (message: string, audioFilename?: string) => void;
  isLoading: boolean;
  comicGenerationStatus: any;
  isInputActive?: boolean;
  agentName: string;
  isAfterFarewell?: boolean;
  continueExisting?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  journalEntryId,
  sendMessage,
  isLoading,
  comicGenerationStatus,
  isInputActive = true,
  agentName,
  isAfterFarewell = false,
  continueExisting = false
}) => {

  const {jwt} = useAuth()

  const { t } = useTranslation();
  const { dyad } = useDyad();
  const [isVoiceMode, setIsVoiceMode] = useState<boolean>(false);
  const [hasButtons, setHasButtons] = useState<boolean>(false);
  const [isVoiceCompleted, setIsVoiceCompleted] = useState<boolean>(false);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);

  const {isRecording: isVoiceRecording, canRecord, startRecording, stopRecording} = useVoiceRecorder()

  const {isSpeaking} = useSpeechState()

  const previousIsSpeaking = usePrevious(isSpeaking);

  const {sessionInfo} = useSession({sessionId: journalEntryId});
  const messages = sessionInfo?.messages;
  const currentStage = sessionInfo?.stage;

  const previousMessageCount = usePrevious(messages?.length || 0);
  
  const lastBotMessage = messages?.filter(m => !m.isUser)
    .pop();
  
  // 메시지 개수 변화 감지 (이어쓰기 모드에서 초기 로드 방지용)
  useEffect(() => {
    if (continueExisting && messages && messages.length > previousMessageCount && previousMessageCount === 0) {
      // 이어쓰기 모드에서 처음 메시지가 로드된 경우
      setIsInitialLoad(false);
    } else if (!continueExisting) {
      // 새로운 작업인 경우 초기 로드 상태 해제
      setIsInitialLoad(false);
    }
  }, [messages?.length, continueExisting, previousMessageCount]);

  // TTS 상태 구독
  useEffect(() => {
      
      // TTS가 완료되면 바로 음성 녹음 모드로 전환
      if (previousIsSpeaking === true && !isSpeaking && !isLoading) {
        console.log("TTS completed, continueExisting:", continueExisting, "isInitialLoad:", isInitialLoad)
        // 이어쓰기 모드에서 초기 로드인 경우, 음성 녹음 시작하지 않음
        if (continueExisting && isInitialLoad) {
          console.log("Continue existing and initial load, return")
          return;
        }
        
        const lastMessage = messages?.filter(m => !m.isUser).pop();
        const isCompletionMessage = lastMessage?.intent === MessageIntent.PromptNext;
        
        // 채팅으로 입력하라는 메시지인지 확인 (title stage에서 2번 이상 거부했을 때)
        const isChatInputMessage = lastMessage?.intent === MessageIntent.PromptTextInput;
        
        // 버튼이 표시될 조건인지 확인
        const shouldShowButtons = (() => {
          if (currentStage === 'revision_1' || currentStage === 'revision_2') {
            return lastMessage?.intent === MessageIntent.PromptIssueExist || lastMessage?.intent === MessageIntent.PromptOpenEndedAnswer;
          }
          else if (currentStage === 'comic_context') {
            return lastMessage?.intent === MessageIntent.PromptEmotion;
          }
          else if (currentStage === 'title') {
            return lastMessage?.intent === MessageIntent.PromptConfirm || lastMessage?.intent === MessageIntent.InitialTitleConfirm || lastMessage?.intent === MessageIntent.CustomTitleConfirm;
          }

          return false;
        })();
        
        // 만화 생성 완료 메시지인지 확인 (별도 조건)
        const isComicCompletionMessage = lastBotMessage?.intent === MessageIntent.StartComicGenerationToken;
        // 완료 메시지가 아니고 버튼이 표시되지 않으며, 만화 생성 완료 메시지도 아니고, farewell 이후도 아니고, 채팅 입력 메시지도 아니고, 제목 단계 전환 메시지도 아니고, sessionId가 존재할 때만 음성 녹음 시작
        const isTitleTransitionMessage = lastMessage?.intent === MessageIntent.TransitionToTitle;
        
        if (canRecord && !isCompletionMessage && !shouldShowButtons && !isComicCompletionMessage && !isAfterFarewell && !isChatInputMessage && !isTitleTransitionMessage) {
          setIsVoiceCompleted(false); // 다음 음성 녹음 시작 전에 완료 상태 초기화
          startVoiceRecording();
        }
      }
  }, [previousIsSpeaking, isSpeaking, canRecord, isLoading, messages, currentStage, continueExisting, isInitialLoad]);
 
  
  // TTS 또는 로딩 중일 때 비활성화, 또는 ChatInput이 비활성화 상태일 때
  const isDisabled = isLoading || isSpeaking || comicGenerationStatus.status === 'generating' || !isInputActive || isVoiceRecording;
  
      // admin-web과 동일한 조건으로 버튼 표시 여부 결정
    const showYesNoButtons = (() => {
        // revision_1에서 "다 맞게 들었을까?" 또는 "아직도 틀린 부분 있어?" 또는 "이제 다 맞을까?" 질문일 때만 버튼 표시
        if (currentStage === 'revision_1') {
            return (lastBotMessage?.text?.includes('다 맞게 들었을까?') || 
                    lastBotMessage?.text?.includes('아직도 틀린 부분 있어?') ||
                    lastBotMessage?.text?.includes('이제 다 맞을까?')) && 
                   !isDisabled
        }
        
        // revision_2에서 수정 관련 질문들일 때만 버튼 표시
        if (currentStage === 'revision_2') {
            return (lastBotMessage?.text?.includes('수정하거나 추가하고 싶은 부분 있어?') || 
                    lastBotMessage?.text?.includes('더 추가하거나 바꿀 곳 있어?') ||
                    lastBotMessage?.text?.includes('일기 제목')) && 
                   !isDisabled
        }
        
        // comic_context에서 "몇가지 확인해줄래??" 멘트가 포함된 질문일 때 버튼 표시
        if (currentStage === 'comic_context') {
            return lastBotMessage?.text?.includes('몇가지 확인해줄래??') && 
                   !isDisabled
        }
        
        // title stage에서 제목 정하기 관련 버튼 표시
        if (currentStage === 'title') {
            return (lastBotMessage?.intent === MessageIntent.PromptConfirm || lastBotMessage?.intent === MessageIntent.InitialTitleConfirm || lastBotMessage?.intent === MessageIntent.CustomTitleConfirm) && 
                   !isDisabled
        }
        
        // completion message 뒤에 나오는 "그럼 이제 일기 제목을 정하러 가볼까?" 메시지일 때 버튼 표시
        if (lastBotMessage?.intent === MessageIntent.TransitionToTitle) {
            return !isDisabled
        }
        
        return false;
    })();

  const showEmotionButtons = (() => {
    // comic_context에서 "기분이 어땠어?" 질문일 때 감정 버튼 표시
    if (currentStage === 'comic_context') {
      return lastBotMessage?.intent === MessageIntent.PromptEmotion && 
             !isDisabled
    }
    
    return false;
  })();

  const showNextButton = (() => {
    // title stage에서 제목 정하기 완료 시 다음 버튼 표시
    if (currentStage === 'title') {
      return lastBotMessage?.intent === MessageIntent.PromptNext && 
             !isDisabled
    }
    
    return false;
  })();

  // 버튼 내용 결정
  const getButtonTexts = () => {
    if (currentStage === 'revision_1') {
      if (lastBotMessage?.text?.includes('다 맞게 들었을까?')) {
        // 첫 번째 질문
        return { left: t('ChatInput.ButtonLabels.Wrong'), right: t('ChatInput.ButtonLabels.AllCorrect') };
      } else if (lastBotMessage?.text?.includes('아직도 틀린 부분 있어?') || lastBotMessage?.text?.includes('이제 다 맞을까?')) {
        // 수정 후 질문
        return { left: t('ChatInput.ButtonLabels.StillWrong'), right: t('ChatInput.ButtonLabels.Enough') };
      }
    } else if (currentStage === 'revision_2') {
      if (lastBotMessage?.text?.includes('일기 제목')) {
        return { left: t('ChatInput.ButtonLabels.LetsDoIt'), right: t('ChatInput.ButtonLabels.Good') };
      }
      return { left: t('ChatInput.ButtonLabels.Have'), right: t('ChatInput.ButtonLabels.DontHave') };
    } else if (currentStage === 'comic_context') {
      return { left: t('ChatInput.ButtonLabels.Good2'), right: t('ChatInput.ButtonLabels.GotIt') };
    } else if (currentStage === 'title') {
      if (lastBotMessage?.text?.includes('어때?')) {
        // 첫 번째 제목 제안
        return { left: t('ChatInput.ButtonLabels.NotGood'), right: t('ChatInput.ButtonLabels.Good3') };
      } else if (lastBotMessage?.text?.includes('이걸로 할까?')) {
        // 커스텀 제목 확인
        return { left: t('ChatInput.ButtonLabels.NoOther'), right: t('ChatInput.ButtonLabels.YesGood') };
      }
    }
    
    // completion message 뒤에 나오는 "그럼 이제 일기 제목을 정하러 가볼까?" 메시지일 때
    if (lastBotMessage?.intent === MessageIntent.TransitionToTitle) {
      return { left: t('ChatInput.ButtonLabels.LetsDoIt'), right: t('ChatInput.ButtonLabels.Good') };
    }
    
    return { left: t('ChatInput.ButtonLabels.Yes'), right: t('ChatInput.ButtonLabels.No') };
  };

  const buttonTexts = getButtonTexts();

  // 음성 녹음 시작
  const startVoiceRecording = async () => {
    console.log("Try voice recording...")
    try {
      setIsVoiceMode(true);
      setIsVoiceCompleted(false); // 음성 녹음 시작 시 완료 상태 초기화
      await startRecording();
      console.log("Voice recording started")
    } catch (error) {
      console.error('음성 녹음 시작 실패:', error);
      Alert.alert('오류', t('ChatInput.VoiceRecording.StartError'));
      setIsVoiceMode(false);
    }
  };

  // 음성 녹음 완료 및 텍스트 변환
  const completeVoiceRecording = async () => {
    console.log("Try voice recording complete...")
    try {
      const audioUri = await stopRecording();
      console.log("Voice recording complete")
      if (audioUri) {
        setIsVoiceMode(false);
        setIsVoiceCompleted(true); // 음성 녹음 완료 상태 업데이트
        
        // sessionId가 있으면 현재 journal의 context 정보를 가져오고, 없으면 dyad 정보 사용
        let peopleNames: string[] = [];
        let placeNames: string[] = [];
        
        if (sessionInfo) {
          try {
              // 현재 journal의 location과 people 정보 사용
              peopleNames = sessionInfo.people || [];
              placeNames = sessionInfo.location ? [sessionInfo.location] : [];
          } catch (error) {
            console.error('Failed to load session info for Whisper prompt:', error);
            // fallback: dyad 정보 사용
            peopleNames = dyad?.people?.map(person => person.name) || [];
            placeNames = dyad?.places?.map(place => place.name) || [];
          }
        } else {
          // sessionId가 없으면 dyad 정보 사용
          peopleNames = dyad?.people?.map(person => person.name) || [];
          placeNames = dyad?.places?.map(place => place.name) || [];
        }
        
        // Whisper API로 텍스트 변환 (현재 session context 정보 포함)
        const transcribedText = await transcribeAudio(jwt!, audioUri, peopleNames, placeNames);
        
        console.log('Transcribed text check:', {
          transcribedText,
          trimmed: transcribedText?.trim(),
          isEmpty: !transcribedText?.trim()
        });
        
        // 빈 문자열이거나 따옴표만 있는 경우 체크
        const trimmedText = transcribedText?.trim();
        const isEmptyOrQuotesOnly = !trimmedText || trimmedText === '""' || trimmedText === "''";
        
        if (transcribedText && !isEmptyOrQuotesOnly) {
          // 오디오 파일 업로드
          let audioFilename: string | undefined = undefined;
          try {
            const uploadResult = await uploadAudioFile(jwt!!, audioUri, journalEntryId, currentStage);
            audioFilename = uploadResult.filename;
            console.log('Audio file uploaded successfully:', audioFilename);
          } catch (error) {
            console.error('Failed to upload audio file:', error);
            // 업로드 실패해도 메시지는 전송
          }
          
          // 변환된 텍스트를 메시지로 전송 (audio_filename 포함)
          sendMessage(transcribedText, audioFilename);
        } else {
          // 빈 문자열이 반환된 경우 (음성이 감지되지 않음)
          Alert.alert(
            t('ChatInput.VoiceRecording.DetectionFailedTitle'), 
            t('ChatInput.VoiceRecording.DetectionFailed'),
            [
              {
                text: t('ChatInput.VoiceRecording.Confirm'),
                onPress: () => {
                  // 다시 음성 녹음 시작
                  startVoiceRecording();
                }
              }
            ]
          );
        }
      }
    } catch (error) {
      console.error('음성 녹음 완료 실패:', error);
      
      // 일반적인 오류 처리
      Alert.alert('오류', t('ChatInput.VoiceRecording.CompleteError'));
      setIsVoiceMode(false);
    }
  };

  const handleInputFocus = async () => {
    if (isVoiceMode) {
      setIsVoiceMode(false);
      if (isVoiceRecording) {
        await stopRecording();
      }
    }
  };


  const showButtons = showYesNoButtons || showEmotionButtons || showNextButton;

  return (
    <View className="p-6 border-t-2 border-gray-200 bg-white">
      {/* 음성 녹음 상태 표시 */}
      <VoiceRecordingStatus
        agentName={agentName}
        isVoiceMode={isVoiceRecording}
        onComplete={completeVoiceRecording}
      />
      
      {/* 버튼들 */}
      <ChatButtons
        showYesNoButtons={showYesNoButtons || false}
        showEmotionButtons={showEmotionButtons || false}
        showNextButton={showNextButton || false}
        buttonTexts={buttonTexts}
        isDisabled={isDisabled}
        sendMessage={sendMessage}
        onButtonsVisibilityChange={setHasButtons}
      />
      
      {/* 입력 필드 */}
      {(() => {
        // 채팅으로 입력하라는 메시지인지 확인 (title stage에서 2번 이상 거부했을 때)
        const lastMessage = messages?.filter(m => !m.isUser).pop();
        const isChatInputMessage = lastMessage?.intent === MessageIntent.PromptTextInput;
        
        // 채팅 입력 메시지이거나 음성 녹음이 완료되지 않았을 때 ChatText 표시
        if (isChatInputMessage || !isVoiceCompleted) {
          return (
            <ChatText
              sendMessage={sendMessage}
              isDisabled={isDisabled}
              isVoiceMode={isVoiceMode}
              onFocus={handleInputFocus}
              showButtons={showYesNoButtons || showEmotionButtons}
            />
          );
        }
        return null;
      })()}
    </View>
  );
}; 