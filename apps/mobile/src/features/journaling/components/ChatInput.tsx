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
      startRecording,
      stopRecording,
      clearRecording,
    } = useVoiceRecorder();

    const { isSpeaking } = useSpeechState();

    const { sessionInfo } = useSession({ sessionId: journalEntryId });
    const messages = sessionInfo?.messages;
    const currentStage = sessionInfo?.stage;

    // TTS 또는 로딩 중일 때 비활성화, 또는 ChatInput이 비활성화 상태일 때
    const isDisabled =
      isSendingMessage ||
      isSpeaking ||
      comicGenerationStatus.status === 'generating' ||
      !isInputActive ||
      isVoiceRecording;

    // 음성 녹음 시작
    const startVoiceRecording = async () => {
      console.log('Try voice recording...');
      try {
        setIsVoiceMode(true);
        setIsVoiceCompleted(false); // 음성 녹음 시작 시 완료 상태 초기화
        await startRecording();
        console.log('Voice recording started');
      } catch (error) {
        console.error('음성 녹음 시작 실패:', error);
        Alert.alert('오류', t('ChatInput.VoiceRecording.StartError'));
        setIsVoiceMode(false);
      }
    };

    // 음성 녹음 완료 및 텍스트 변환
    const completeVoiceRecording = async () => {
      console.log('Try voice recording complete...');
      try {
        const audioUri = await stopRecording();
        console.log('Voice recording complete');
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
            audioUri,
            peopleNames,
            placeNames,
          );

          // 빈 문자열이거나 따옴표만 있는 경우 체크
          const trimmedText = transcribedText?.trim();
          const isEmptyOrQuotesOnly =
            !trimmedText || trimmedText === '""' || trimmedText === "''";

          if (transcribedText && !isEmptyOrQuotesOnly) {
            // 오디오 파일 업로드
            let audioFilename: string | undefined = undefined;
            try {
              const uploadResult = await uploadAudioFile(
                jwt!!,
                audioUri,
                journalEntryId,
                currentStage,
              );
              audioFilename = uploadResult.filename;
              console.log('Audio file uploaded successfully:', audioFilename);
            } catch (error) {
              console.error('Failed to upload audio file:', error);
              // 업로드 실패해도 메시지는 전송
            }

            // 변환된 텍스트를 메시지로 전송 (audio_filename 포함)
            sendMessage(transcribedText, undefined, audioFilename);
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
                  },
                },
              ],
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

    // Expose imperative methods via ref
    useImperativeHandle(
      ref,
      () => ({
        startRecording: startVoiceRecording,
        completeRecording: completeVoiceRecording,
      }),
      [startVoiceRecording, completeVoiceRecording],
    );

    const [isTextInputModalVisible, setIsTextInputModalVisible] = useState(false);

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
