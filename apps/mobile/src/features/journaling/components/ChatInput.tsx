import React, {
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { View, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSpeechState } from '../utils/speechUtils';
import { useVoiceRecorder } from '../utils';
import { transcribeAudio } from '../utils/voiceUtils';
import { useDyad } from '../../../api/dyad';
import { uploadAudioFile } from '../api';
import { useAuth } from '../../auth/hooks';
import { useSession } from '../hooks/useSession';
import { VoiceRecordingStatus } from './VoiceRecordingStatus';
import { ChatButtons } from './ChatButtons';
import { ChatText } from './ChatText';
import { MessageIntent } from '@autiverse-monorepo/ts-core';
import { UserButtonMode } from '../types';
import { ComicGenerationStatus } from '../api';

interface ChatInputProps {
  journalEntryId: string;
  sendMessage: (message: string, intent?: MessageIntent, audioFilename?: string) => void;
  isLoading: boolean;
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
      isLoading,
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

    const {
      isRecording: isVoiceRecording,
      canRecord,
      startRecording,
      stopRecording,
    } = useVoiceRecorder();

    const { isSpeaking } = useSpeechState();

    const { sessionInfo } = useSession({ sessionId: journalEntryId });
    const messages = sessionInfo?.messages;
    const currentStage = sessionInfo?.stage;

    const lastBotMessage = messages?.filter((m) => !m.isUser).pop();

    // TTS 또는 로딩 중일 때 비활성화, 또는 ChatInput이 비활성화 상태일 때
    const isDisabled =
      isLoading ||
      isSpeaking ||
      comicGenerationStatus.status === 'generating' ||
      !isInputActive ||
      isVoiceRecording;

    // 버튼 내용 결정
    const getButtonTexts = () : {left: {label: string, intent: MessageIntent}, right: {label: string, intent: MessageIntent}} => {
      if (currentStage === 'revision_1') {
        if (lastBotMessage?.intent === MessageIntent.PromptConfirm) {
          // 첫 번째 질문
          return {
            left: {label: t('ChatInput.ButtonLabels.Wrong'), intent: MessageIntent.AnswerNegative},
            right: {label: t('ChatInput.ButtonLabels.AllCorrect'), intent: MessageIntent.AnswerPositive},
          };
        } /*else if (
          lastBotMessage?.text?.includes('아직도 틀린 부분 있어?') ||
          lastBotMessage?.text?.includes('이제 다 맞을까?')
        ) {
          // 수정 후 질문
          return {
            left: {label: t('ChatInput.ButtonLabels.StillWrong'), intent: MessageIntent.AnswerNegative},
            right: {label: t('ChatInput.ButtonLabels.Enough'), intent: MessageIntent.AnswerPositive},
          };
        }*/ //TODO 두 번째 컨펌 핸들링 잘 할 방법 고민
      } else if (currentStage === 'revision_2') {
        if (lastBotMessage?.intent === MessageIntent.TransitionToTitle) {
          return {
            left: {label: t('ChatInput.ButtonLabels.LetsDoIt'), intent: MessageIntent.AnswerPositive},
            right: {label: t('ChatInput.ButtonLabels.Good'), intent: MessageIntent.AnswerPositive},
          };
        }
        return {
          left: {label: t('ChatInput.ButtonLabels.Have'), intent: MessageIntent.AnswerNegative},
          right: {label: t('ChatInput.ButtonLabels.DontHave'), intent: MessageIntent.AnswerPositive},
        };
      } else if (currentStage === 'comic_context') {
        return {
          left: {label: t('ChatInput.ButtonLabels.Good2'), intent: MessageIntent.AnswerPositive},
          right: {label: t('ChatInput.ButtonLabels.GotIt'), intent: MessageIntent.AnswerPositive},
        };
      } else if (currentStage === 'title') {
        if (lastBotMessage?.intent === MessageIntent.InitialTitleConfirm) {
          // 첫 번째 제목 제안
          return {
            left: {label: t('ChatInput.ButtonLabels.NotGood'), intent: MessageIntent.AnswerNegative},
            right: {label: t('ChatInput.ButtonLabels.Good3'), intent: MessageIntent.AnswerPositive},
          };
        } else if (lastBotMessage?.intent === MessageIntent.CustomTitleConfirm) {
          // 커스텀 제목 확인
          return {
            left: {label: t('ChatInput.ButtonLabels.NoOther'), intent: MessageIntent.AnswerNegative},
            right: {label: t('ChatInput.ButtonLabels.YesGood'), intent: MessageIntent.AnswerPositive},
          };
        }
      }

      // completion message 뒤에 나오는 "그럼 이제 일기 제목을 정하러 가볼까?" 메시지일 때
      if (lastBotMessage?.intent === MessageIntent.TransitionToTitle) {
        return {
          left: {label: t('ChatInput.ButtonLabels.LetsDoIt'), intent: MessageIntent.AnswerPositive},
          right: {label: t('ChatInput.ButtonLabels.Good'), intent: MessageIntent.AnswerPositive},
        };
      }

      return {
        left: {label: t('ChatInput.ButtonLabels.Yes'), intent: MessageIntent.AnswerPositive},
        right: {label: t('ChatInput.ButtonLabels.No'), intent: MessageIntent.AnswerNegative},
      };
    };

    const buttonTexts = getButtonTexts();

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

    const handleInputFocus = async () => {
      if (isVoiceMode) {
        setIsVoiceMode(false);
        if (isVoiceRecording) {
          await stopRecording();
        }
      }
    };

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
          buttonMode={userButtonMode}
          buttonTexts={buttonTexts}
          isDisabled={isDisabled}
          sendMessage={sendMessage}
          onButtonsVisibilityChange={setHasButtons}
        />

        {/* 입력 필드 */}
        {(() => {
          // 채팅으로 입력하라는 메시지인지 확인 (title stage에서 2번 이상 거부했을 때)
          const lastMessage = messages?.filter((m) => !m.isUser).pop();
          const isChatInputMessage =
            lastMessage?.intent === MessageIntent.PromptTextInput;

          // 채팅 입력 메시지이거나 음성 녹음이 완료되지 않았을 때 ChatText 표시
          if (isChatInputMessage || !isVoiceCompleted) {
            return (
              <ChatText
                sendMessage={sendMessage}
                isDisabled={isDisabled}
                isVoiceMode={isVoiceMode}
                onFocus={handleInputFocus}
                showButtons={userButtonMode !== null}
              />
            );
          }
          return null;
        })()}
      </View>
    );
  },
);
