import React, {
  useState,
  forwardRef,
  useImperativeHandle,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { View, Alert, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSpeechState } from '../utils/speechUtils';
import { useVoiceRecorder } from '../utils';
import { transcribeAudio } from '../utils/voiceRecordingUtils';
import { useDyad } from '../../../api/dyad';
import { uploadAudioFile } from '../api';
import { useAuth } from '../../auth/hooks';
import { useSession } from '../hooks/useSession';
import { VoiceRecordingStatus } from './VoiceRecordingStatus';
import { ChatButtons } from './ChatButtons';
import { MessageIntent } from '@autiverse-monorepo/ts-core';
import { UserButtonMode } from '../types';
import { ComicGenerationStatus } from '../api';
import { TailwindButton } from '../../../components/TailwindButton';
import { ChatTextInputModal } from './ChatTextInputModal';
import { useJournalingStore } from '../store';
import { styleTemplates } from '../../../styles';
import { twMerge } from 'tailwind-merge';
import colors from 'tailwindcss/colors';
import { KeyboardIcon } from '../../../components/svg-images';
import Reanimated, { Easing, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { create } from 'zustand';

export const useChatInputModalStore = create<{
  isTextInputModalVisible: boolean;
  setIsTextInputModalVisible: (isTextInputModalVisible: boolean) => void;
}>((set) => ({
  isTextInputModalVisible: false,
  setIsTextInputModalVisible: (isTextInputModalVisible: boolean) => set({ isTextInputModalVisible }),
}));

interface ChatInputProps {
  journalEntryId: string;
  sendMessage: (message: string, intent?: MessageIntent, audioFilename?: string) => void;
  comicGenerationStatus: ComicGenerationStatus;
  isInputActive?: boolean;
  agentName: string;
  userButtonMode: UserButtonMode|null;
}

export interface ChatInputRef {
  startRecording: () => Promise<void>;
  completeRecording: () => Promise<void>;
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
  (
    {
      journalEntryId,
      sendMessage,
      comicGenerationStatus,
      isInputActive = true,
      agentName,
      userButtonMode,
    },
    ref,
  ) => {
    const { jwt } = useAuth();

    const { t } = useTranslation();
    const { dyad } = useDyad();
    const [isVoiceMode, setIsVoiceMode] = useState<boolean>(false);
    const [hasButtons, setHasButtons] = useState<boolean>(false);
    const [isVoiceCompleted, setIsVoiceCompleted] = useState<boolean>(false);

    const {isSendingMessage} = useJournalingStore();

    const {
      isRecording: isVoiceRecording,
      canRecord,
      retryCount,
      maxRetries,
      setRetryCount,
      startRecording,
      stopRecording,
      clearRecording,
    } = useVoiceRecorder();

    const { isSpeaking } = useSpeechState();

    const { isTextInputModalVisible, setIsTextInputModalVisible } = useChatInputModalStore();

    const { sessionInfo } = useSession({ sessionId: journalEntryId });
    const messages = sessionInfo?.messages;
    const currentStage = sessionInfo?.stage;

    // TTS 또는 로딩 중일 때 비활성화, 또는 ChatInput이 비활성화 상태일 때
    // 리트라이 횟수가 최대치에 도달하면 텍스트 입력 버튼 활성화
    const isDisabled =
      isSendingMessage ||
      isSpeaking ||
      comicGenerationStatus.status === 'generating' ||
      !isInputActive ||
      (isVoiceRecording && retryCount < maxRetries);

    // 음성 녹음 시작
    const startVoiceRecording = useCallback(async () => {
      console.log('Try voice recording...');
      try {
        setIsVoiceMode(true);
        setIsVoiceCompleted(false); // 음성 녹음 시작 시 완료 상태 초기화
        await startRecording();
        console.log('Voice recording started');
      } catch (error) {
        // 개발자용 로그만 남기고 사용자에게는 조용히 처리
        console.log('음성 녹음 시작 실패 (조용히 처리):', error);
        
        // 리트라이 횟수가 최대치에 도달하지 않았으면 자동으로 다시 시도
        if (retryCount < maxRetries) {
          console.log(`음성 녹음 재시도 중... (${retryCount + 1}/${maxRetries})`);
          Alert.alert(
            '음성 녹음 오류',
            '내가 잘 못 들었어.. 미안해.. 다시 한 번만 말해줘!!',
            [
              {
                text: '다시 시도',
                onPress: () => {
                  setTimeout(() => {
                    startVoiceRecording();
                  }, 1000); // 1초 후 재시도
                },
              },
            ],
          );
        } else {
          // 최대 리트라이 횟수에 도달하면 다른 메시지 표시
          console.log('최대 리트라이 횟수에 도달했습니다. 텍스트 입력 모드로 전환합니다.');
          Alert.alert(
            '음성 녹음 오류',
            '내 귀가 어떻게 됐나봐.. 타이핑해서 말해줄 수 있어??',
            [
              {
                text: '텍스트로 입력하기',
                onPress: () => {
                  setIsVoiceMode(false);
                  setIsTextInputModalVisible(true);
                },
              },
            ],
          );
        }
      }
    }, [retryCount, maxRetries, setIsVoiceMode, setIsTextInputModalVisible]);

    // 음성 녹음 완료 및 텍스트 변환
    const completeVoiceRecording = useCallback(async (audioUri?: string, retryAttempt = 0) => {
      console.log('Try voice recording complete...');
      let currentAudioUri: string | null = null;
      
      try {
        // audioUri가 없으면 녹음 중지, 있으면 기존 파일 사용
        let recordingUri = null;
        if (!audioUri) {
          recordingUri = await stopRecording();
        } else {
          recordingUri = audioUri;
        }
        currentAudioUri = recordingUri;
        console.log('Voice recording complete, currentAudioUri:', currentAudioUri);
        if (currentAudioUri) {
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
              console.error(
                'Failed to load session info for Whisper prompt:',
                error,
              );
              // fallback: dyad 정보 사용
              peopleNames = dyad?.people?.map((person) => person.name) || [];
              placeNames = dyad?.places?.map((place) => place.name) || [];
            }
          } else {
            // sessionId가 없으면 dyad 정보 사용
            peopleNames = dyad?.people?.map((person) => person.name) || [];
            placeNames = dyad?.places?.map((place) => place.name) || [];
          }

          // Whisper API로 텍스트 변환 (현재 session context 정보 포함)
          const transcribedText = await transcribeAudio(
            jwt!,
            currentAudioUri,
            peopleNames,
            placeNames,
          );

          // 오디오 파일 업로드
          let audioFilename: string | undefined = undefined;
          try {
            const uploadResult = await uploadAudioFile(
              jwt!!,
              currentAudioUri,
              journalEntryId,
              currentStage,
            );
            audioFilename = uploadResult.filename;
            console.log('Audio file uploaded successfully:', audioFilename);
          } catch (error) {
            console.error('Failed to upload audio file:', error);
            // 업로드 실패해도 메시지는 전송
          }

          // 변환된 텍스트를 메시지로 전송 (audio_filename 포함) - 빈 텍스트도 허용
          sendMessage(transcribedText || '', undefined, audioFilename);
        } else {
          // currentAudioUri가 null인 경우
          console.log('오디오 파일을 가져올 수 없습니다.');
        }
      } catch (error) {
        // 개발자용 로그만 남기고 사용자에게는 조용히 처리
        console.log('음성 녹음 완료 실패 (조용히 처리):', error);

        // 리트라이 횟수가 최대치에 도달하지 않았으면 자동으로 다시 시도
        if (retryAttempt < maxRetries) {
          console.log(`음성 변환 재시도 중... (${retryAttempt + 1}/${maxRetries})`);
          setTimeout(() => {
            // currentAudioUri가 null이면 새로운 음성 녹음 시작, 아니면 같은 파일로 재시도
            if (currentAudioUri) {
              completeVoiceRecording(currentAudioUri, retryAttempt + 1);
            } else {
              startVoiceRecording();
            }
          }, 1000); // 1초 후 재시도
        } else {
          // 최대 리트라이 횟수에 도달하면 다른 메시지 표시
          console.log('최대 리트라이 횟수에 도달했습니다. 텍스트 입력 모드로 전환합니다.');
          Alert.alert(
            '음성 녹음 오류',
            '내 귀가 어떻게 됐나봐.. 타이핑해서 말해줄 수 있어??',
            [
              {
                text: '텍스트로 입력하기',
                onPress: () => {
                  setIsVoiceMode(false);
                  setIsTextInputModalVisible(true);
                },
              },
            ],
          );
        }
      }
    }, [stopRecording, sessionInfo, dyad, jwt, journalEntryId, currentStage, sendMessage, setIsVoiceMode, setIsVoiceCompleted, t, startVoiceRecording]);

    // Expose imperative methods via ref
    useImperativeHandle(
      ref,
      () => ({
        startRecording: startVoiceRecording,
        completeRecording: completeVoiceRecording,
      }),
      [startVoiceRecording, completeVoiceRecording],
    );

    useEffect(()=>{
      setIsTextInputModalVisible(false);
    }, [])

    const onPressChatButton = useCallback(async ()=>{
      console.log("Pressing chat button...", isVoiceMode, isVoiceRecording);
      if (isVoiceMode) {
        setIsVoiceMode(false);
      }

      if (isVoiceRecording) {
        console.log("Stopping voice recording...");
        await stopRecording();
        setIsVoiceMode(false);
        setIsVoiceCompleted(false);
      }

      setIsTextInputModalVisible(true);
    }, [isVoiceMode, isVoiceRecording, stopRecording])

    useEffect(() => {
      return () => {
        clearRecording();
      }
    }, []);


    const lastMessage = messages?.filter((m) => !m.isUser).pop();
    const isChatInputMessage =
      lastMessage?.intent === MessageIntent.PromptTextInput;

    const isTextInputDisabled = !isInputActive || isSendingMessage

    return <>
      {isInputActive && <View className="pt-6 px-6 pb-2">
        {/* 음성 녹음 상태 표시 */}
        <VoiceRecordingStatus
          agentName={agentName}
          onComplete={completeVoiceRecording}
        />
        

        {/* 버튼들 */}
        <ChatButtons
          sessionId={journalEntryId}
          buttonMode={userButtonMode}
          isDisabled={isDisabled}
          sendMessage={sendMessage}
          onButtonsVisibilityChange={setHasButtons}
        />

        {/* 채팅 입력 버튼 */}
        {
          ((isChatInputMessage || !isVoiceCompleted) && userButtonMode == null) ? <Reanimated.View 
              entering={SlideInDown.duration(600).easing(Easing.inOut(Easing.cubic))}
              exiting={SlideOutDown.duration(400).easing(Easing.inOut(Easing.cubic))}
              ><TailwindButton 
              disabledTitleClassName='text-gray-300' buttonStyleClassName='bg-white flex-row items-center justify-center gap-2' roundedClassName='rounded-xl' shadowClassName='shadow-none'
              disabled={isTextInputDisabled}
              disabledButtonStyleClassName='bg-white/50'
              onLongPress={onPressChatButton}
              >
                <KeyboardIcon width={24} height={24} fill={isTextInputDisabled ? colors.gray[300] : colors.slate[600]}/>
                <Text className={twMerge("text-slate-600", isTextInputDisabled ? "text-gray-300" : "")} style={styleTemplates.withBoldFont}>{t('Chat.ChatButton')}</Text>
              </TailwindButton></Reanimated.View> : null
        }
      </View>}
      <ChatTextInputModal onSubmitText={sendMessage} visible={isTextInputModalVisible} onClose={()=>{setIsTextInputModalVisible(false)}}/>
      </>
  },
);
