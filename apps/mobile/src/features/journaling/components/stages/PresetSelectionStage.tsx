import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import { styleTemplates } from '../../../../styles';
import { speakText, stopSpeech } from '../../utils/speechUtils';
import { useDyad } from '../../../../api/dyad';
import { useJournalingStore } from '../../store';
import { useSpeechAnimation } from '../../hooks/useSpeechAnimation';
import Reanimated, { Easing, ZoomIn } from 'react-native-reanimated';
import { twMerge } from 'tailwind-merge';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AgentImage } from '../AgentImage';
import { TailwindButton } from '../../../../components/TailwindButton';
import colors from 'tailwindcss/colors';
import { CheckCircleIcon } from '../../../../components/svg-images';

const styles = StyleSheet.create({
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    resizeMode: 'cover',
    marginRight: 12,
  },
  scrollViewContentContainerStyleBase: {
  },
});

const ContentFrame= ({
  children,
  footer,
  messageViewHeight,
}: {
  children?: React.ReactNode
  footer?: React.ReactNode
  messageViewHeight: number
}) => {

  const scrollViewContentContainerStyle = useMemo(() => ({
    ...styles.scrollViewContentContainerStyleBase,
    padding: 24,
    paddingTop: 24 + messageViewHeight + 48 // 기본 padding + 메시지 뷰 높이 + 추가 여백
  }), [messageViewHeight]);

  return (<>
    <ScrollView 
    className="flex-1" 
    contentContainerStyle={scrollViewContentContainerStyle}
  >{children}</ScrollView>
  {footer}
  </>)
}

interface PresetSelectionStageProps {
  onSelectionComplete: () => void;
  onStartChatbotWithSuggestion: () => void;
  onFreeStart: () => void;
}

export const PresetSelectionStage: React.FC<PresetSelectionStageProps> = ({
  onSelectionComplete,
  onStartChatbotWithSuggestion,
  onFreeStart,
}) => {
  const {
    selectionStep,
    selectedLocation,
    selectedPersonIds,
    isLoading,
    handleLocationSelect,
    handlePersonToggle,
    handleBackToLocation,
  } = useJournalingStore();

  const [hasSpoken, setHasSpoken] = useState(false);
  const [isTTSActive, setIsTTSActive] = useState(false);
  const [messageViewHeight, setMessageViewHeight] = useState(0);
  const { dyad, agentConfig } = useDyad();

  // TTS 시작
  useEffect(() => {
    const stopAndStartTTS = async () => {
      setIsTTSActive(true);
      await stopSpeech();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const ttsMessage =
        selectionStep === 'location'
          ? '오늘은 어디서 있었던 일을 그림 일기로 써볼까?'
          : `${selectedLocation}에서 누구랑 있었던 일을 그림 일기로 써볼까? 여러명이면 여러명을 선택해!`;
      speakText(ttsMessage, {
        language: 'ko-KR',
        pitch: 1.0,
        rate: 0.8,
        onDone: () => {
          setHasSpoken(true);
          setIsTTSActive(false);
        },
        onError: (error) => {
          setHasSpoken(true);
          setIsTTSActive(false);
        },
      });
    };
    stopAndStartTTS();
  }, [selectionStep]);

  // TTS 중단 함수
  const stopTTSAndExecute = (callback: () => void) => {
    stopSpeech();
    setHasSpoken(true);
    callback();
  };

  // 사람 선택 단계에서만 TTS 중단하지 않는 함수
  const executeWithConditionalTTSStop = (callback: () => void) => {
    if (selectionStep === 'people') {
      // 사람 선택 단계에서는 TTS를 중단하지 않고 바로 실행
      callback();
    } else {
      // 장소 선택 단계에서는 TTS 중단 후 실행
      stopTTSAndExecute(callback);
    }
  };

  // 컴포넌트 언마운트 시 TTS 정지
  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  // TTS 애니메이션 훅 사용
  const { ttsScalePulseStyle, ttsOpacityPulseStyle, ttsBorderColorStyle } = useSpeechAnimation(isTTSActive);

  const onMessageViewLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setMessageViewHeight(height);
  }, []);

  return (
    <SafeAreaView className="flex-1">
        {/* 상단 메시지 */}
        <Reanimated.View 
          className={"absolute top-0 left-0 right-0 mx-6 mt-12 z-10"} 
          entering={ZoomIn.easing(Easing.ease)}
          onLayout={onMessageViewLayout}
        >
          <Reanimated.View style={ttsBorderColorStyle} className="bg-white rounded-2xl p-6 w-full border-2">
            <View className="flex-row items-center">
              <Reanimated.View style={ttsScalePulseStyle}>
                <AgentImage
                  avatarImage={agentConfig?.avatar_image || ''}
                  style={styles.avatarImage}
                />
              </Reanimated.View>
              <Reanimated.Text
                className="text-2xl text-gray-800 leading-relaxed flex-1 text-center"
                style={[styleTemplates.withBoldFont, ttsOpacityPulseStyle]}
              >
                {selectionStep === 'location'
                  ? '오늘은 어디서 있었던 일을 그림 일기로 써볼까?'
                  : `${selectedLocation}에서 누구랑 있었던 일을 그림 일기로 써볼까? 여러명이면 여러명을 선택해!`}
              </Reanimated.Text>
            </View>
          </Reanimated.View>
        </Reanimated.View>

        {selectionStep === 'location' ? (<ContentFrame messageViewHeight={messageViewHeight} footer={
          <View className="border-t-2 border-gray-200 pt-6 pb-6 mt-4 px-6 flex flex-row items-center">
          <TailwindButton
              containerClassName="flex-1 mr-2"
              buttonStyleClassName={`p-4 ${
                isTTSActive || isLoading ? 'bg-gray-200' : 'bg-blue-500'
              }`}
              roundedClassName="rounded-xl"
              disabledButtonStyleClassName="bg-gray-200"
              disabledTitleClassName="text-gray-400"
              titleClassName={'text-xl text-white'}
              title={isLoading ? '시작 중...' : '뭘 쓸지 모르겠네..'}
              onPress={() => stopTTSAndExecute(onStartChatbotWithSuggestion)}
              disabled={isTTSActive || isLoading}
            />
            <TailwindButton
              containerClassName="flex-1 ml-2"
              buttonStyleClassName={`p-4 ${
                isTTSActive || isLoading ? 'bg-gray-200' : 'bg-blue-500'
              }`}
              roundedClassName="rounded-xl"
              disabledButtonStyleClassName="bg-gray-200"
              titleClassName={'text-xl text-white'}
              disabledTitleClassName="text-gray-400"
              title={isLoading ? '시작 중...' : '오늘은 내가 쓰고 싶은 게 있어!'}
              onPress={() => stopTTSAndExecute(onFreeStart)}
              disabled={isTTSActive || isLoading}
            />
        </View>
        }>
          <View className="flex-1 flex flex-row items-center justify-center flex-wrap mb-4">
              {dyad && dyad.places.length > 0 ? (
                // API 데이터 사용
                dyad.places.map((place) => (
                    <TailwindButton key={place.id}
                      containerClassName="w-[31%] m-3"
                      buttonStyleClassName={twMerge('p-6 py-12 border-2 rounded-xl border-orange-300 bg-white')}
                      disabledButtonStyleClassName="border-gray-200 bg-gray-200"
                      titleClassName={'text-2xl text-gray-800'}
                      disabledTitleClassName="text-gray-400"
                      title={place.name}
                      rippleColor={colors.orange[300]}
                      onPress={() =>
                        stopTTSAndExecute(() =>
                          handleLocationSelect(place.name, place.id),
                        )
                      }
                      disabled={isTTSActive || isLoading}
                    />
                ))
              ) : (
                // API 데이터가 없을 때 빈 상태 표시
                <View className="p-6 border-2 border-gray-200 rounded-xl bg-white">
                  <Text
                    className="text-xl text-gray-500 text-center"
                    style={styleTemplates.withSemiboldFont}
                  >
                    장소 정보를 불러올 수 없습니다
                  </Text>
                </View>
              )}
            </View>
        </ContentFrame>) : (
          <ContentFrame messageViewHeight={messageViewHeight} footer={
            <View className="border-t-2 border-gray-200 pt-6 pb-6 mt-4 px-6 flex">

            {/* 뒤로가기 버튼 */}
              <TailwindButton
                key={`back-to-location-${selectedLocation}`}
                containerClassName="self-start mb-3"
                buttonStyleClassName={`p-2 bg-transparent`}
                shadowClassName="shadow-none"
                titleClassName={`text-blue-500 text-xl ${isTTSActive ? 'text-gray-400' : ''}`}
                disabledTitleClassName="text-gray-400"
                title="← 장소 다시 선택"
                onPress={() => stopTTSAndExecute(handleBackToLocation)}
                disabled={isTTSActive}
              />

                <TailwindButton
              buttonStyleClassName={`rounded-xl p-5 ${
                isTTSActive || selectedPersonIds.length === 0 || isLoading
                  ? 'bg-gray-200'
                  : 'bg-blue-500'
              }`}
              disabledButtonStyleClassName="bg-gray-200"
              titleClassName={`text-white text-2xl text-center ${
                isTTSActive || selectedPersonIds.length === 0 || isLoading
                  ? 'text-gray-400'
                  : 'text-white'
              }`}
              disabledTitleClassName="text-gray-400"
              title={isLoading
                ? '준비 중...'
                : `다음 단계로 (${selectedPersonIds.length}명 선택됨)`}
              onPress={() => stopTTSAndExecute(onSelectionComplete)}
              disabled={
                isTTSActive || selectedPersonIds.length === 0 || isLoading
              }
            />
            </View>
          }>

            {/* 사람 선택 그리드 */}
          <View className="flex-1 flex flex-row items-center justify-center flex-wrap mb-4">
              {dyad && dyad.people.length > 0 ? (
                // API 데이터 사용
                dyad?.people.map((person) => {
                  const isSelected = selectedPersonIds.includes(person.id);
                  return (
                  <TailwindButton
                    key={person.id}
                    rippleColor={colors.orange[300]}
                    containerClassName="w-[31%] m-3"
                    buttonStyleClassName={twMerge('p-6 py-12 border-2 rounded-xl border-orange-300', isSelected ? 'bg-orange-400' : 'bg-white')}
                    disabledButtonStyleClassName={twMerge("border-gray-200", isSelected ? 'bg-gray-300' : 'bg-gray-200')}
                    onPress={() =>
                      executeWithConditionalTTSStop(() =>
                        handlePersonToggle(person.name, person.id),
                      )
                    }
                    disabled={isTTSActive}
                  >
                    <View className="flex-row items-center">
                      <Text style={styleTemplates.withBoldFont} className={twMerge('text-2xl', isTTSActive ? 'text-gray-400' : (isSelected ? 'text-white' : 'text-gray-800'))}>{person.name}</Text>
                      {isSelected && <CheckCircleIcon style={{fill: isTTSActive ? 'gray' : 'white', marginLeft: 7, width: 32, height: 32}}/>}
                    </View></TailwindButton>
                )})
              ) : (
                // API 데이터가 없을 때 빈 상태 표시
                <View className="p-4 border-2 border-gray-200 rounded-xl bg-white">
                  <Text
                    className="text-center text-gray-500 text-lg"
                    style={styleTemplates.withSemiboldFont}
                  >
                    사람 정보를 불러올 수 없습니다
                  </Text>
                </View>
              )}
            </View>
          </ContentFrame>)
          }
    </SafeAreaView>
  );
};

export default PresetSelectionStage;
