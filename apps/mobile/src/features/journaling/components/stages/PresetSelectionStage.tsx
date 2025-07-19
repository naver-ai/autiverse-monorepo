import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import { getImageSource } from '../../utils/imageUtils';
import { styleTemplates } from '../../../../styles';
import { speakText, stopSpeech } from '../../utils/speechUtils';
import { useDyad } from '../../../../api/dyad';
import { useJournalingStore } from '../../store';
import { useSpeechAnimation } from '../../hooks/useSpeechAnimation';
import Reanimated, { Easing, ZoomIn } from 'react-native-reanimated';
import { twMerge } from 'tailwind-merge';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const styles = StyleSheet.create({
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    resizeMode: 'cover',
    marginRight: 12,
  },
});

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
  
  const scrollViewContentContainerStyle = useMemo(() => ({
    padding: 24,
    paddingTop: 24 + messageViewHeight + 48 // 기본 padding + 메시지 뷰 높이 + 추가 여백
  }), [messageViewHeight]);

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
                <Image
                  source={
                    agentConfig?.avatar_image
                      ? agentConfig.avatar_image.startsWith('http')
                        ? { uri: agentConfig.avatar_image }
                        : getImageSource(agentConfig.avatar_image)
                      : require('../../../../../assets/robot.png')
                  }
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

        {selectionStep === 'location' ? (
          <>
            {/* 장소 선택 그리드 */}
            <ScrollView 
              className="flex-1" 
              contentContainerStyle={scrollViewContentContainerStyle}
            >
            <View className="flex-1 flex flex-row justify-between flex-wrap mb-4">
              {dyad && dyad.places.length > 0 ? (
                // API 데이터 사용
                dyad.places.map((place) => (
                  <TouchableOpacity
                    key={place.id}
                    style={isTTSActive ? undefined : {
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.25,
                      shadowRadius: 3.84,
                      elevation: 5,
                    }}
                    className={twMerge(`w-[31%] p-6 py-12 border-2 rounded-xl ${
                      isTTSActive || isLoading
                        ? 'border-gray-200 bg-gray-200'
                        : 'border-orange-300 bg-white'
                    }`)}
                    onPress={() =>
                      stopTTSAndExecute(() =>
                        handleLocationSelect(place.name, place.id),
                      )
                    }
                    disabled={isTTSActive || isLoading}
                  >
                    <Text
                      className={`text-2xl font-semibold text-center ${
                        isTTSActive || isLoading
                          ? 'text-gray-400'
                          : 'text-gray-800'
                      }`}
                      style={styleTemplates.withBoldFont}
                    >
                      {place.name}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                // API 데이터가 없을 때 빈 상태 표시
                <View className="p-6 border-2 border-gray-200 rounded-xl bg-white">
                  <Text
                    className="text-xl font-semibold text-gray-500 text-center"
                    style={styleTemplates.withSemiboldFont}
                  >
                    장소 정보를 불러올 수 없습니다
                  </Text>
                </View>
              )}
            </View></ScrollView>

            {/* 자유롭게 시작하기 버튼들 */}
            <View className="border-t-2 border-gray-200 pt-6 pb-6 mt-4 px-6 flex flex-row items-center">
              <TouchableOpacity
                className={`flex-1 mr-2 rounded-xl p-4 ${
                  isTTSActive || isLoading ? 'bg-gray-200' : 'bg-blue-500'
                }`}
                onPress={() => stopTTSAndExecute(onStartChatbotWithSuggestion)}
                disabled={isTTSActive || isLoading}
              >
                <Text
                  className={`text-xl font-semibold text-center ${
                    isTTSActive || isLoading ? 'text-gray-400' : 'text-white'
                  }`}
                  style={styleTemplates.withBoldFont}
                >
                  {isLoading ? '시작 중...' : '뭘 쓸지 모르겠네..'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 ml-2 rounded-xl p-4 ${
                  isTTSActive || isLoading ? 'bg-gray-200' : 'bg-blue-500'
                }`}
                onPress={() => stopTTSAndExecute(onFreeStart)}
                disabled={isTTSActive || isLoading}
              >
                <Text
                  className={`text-xl font-semibold text-center ${
                    isTTSActive || isLoading ? 'text-gray-400' : 'text-white'
                  }`}
                  style={styleTemplates.withBoldFont}
                >
                  {isLoading ? '시작 중...' : '오늘은 내가 쓰고 싶은 게 있어!'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {/* 뒤로가기 버튼 */}
            <TouchableOpacity
              className={`mb-4 p-2 ${isTTSActive ? 'bg-gray-200' : ''}`}
              onPress={() => stopTTSAndExecute(handleBackToLocation)}
              disabled={isTTSActive}
            >
              <Text
                className={`text-blue-500 text-xl ${isTTSActive ? 'text-gray-400' : ''}`}
                style={styleTemplates.withBoldFont}
              >
                ← 장소 다시 선택
              </Text>
            </TouchableOpacity>

            {/* 선택된 장소 표시 */}
            <View className="mb-6 p-4 bg-blue-50 rounded-lg">
              <Text
                className="text-xl text-gray-800"
                style={styleTemplates.withSemiboldFont}
              >
                <Text className="font-bold" style={styleTemplates.withBoldFont}>
                  선택된 장소:
                </Text>{' '}
                {selectedLocation}
              </Text>
            </View>

            {/* 사람 선택 그리드 */}
            <View className="grid grid-cols-2 gap-4 mb-6">
              {dyad && dyad.people.length > 0 ? (
                // API 데이터 사용
                dyad?.people.map((person) => (
                  <TouchableOpacity
                    key={person.id}
                    className={`p-4 border-2 rounded-xl ${
                      selectedPersonIds.includes(person.id)
                        ? isTTSActive
                          ? 'border-blue-200 bg-blue-100'
                          : 'border-blue-500 bg-blue-50'
                        : isTTSActive
                          ? 'border-gray-200 bg-gray-200'
                          : 'border-gray-200 bg-white'
                    }`}
                    onPress={() =>
                      executeWithConditionalTTSStop(() =>
                        handlePersonToggle(person.name, person.id),
                      )
                    }
                    disabled={isTTSActive}
                  >
                    <Text
                      className={`text-center font-semibold text-xl ${
                        selectedPersonIds.includes(person.id)
                          ? isTTSActive
                            ? 'text-blue-300'
                            : 'text-blue-600'
                          : isTTSActive
                            ? 'text-gray-400'
                            : 'text-gray-800'
                      }`}
                      style={styleTemplates.withBoldFont}
                    >
                      {person.name}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                // API 데이터가 없을 때 빈 상태 표시
                <View className="p-4 border-2 border-gray-200 rounded-xl bg-white">
                  <Text
                    className="text-center font-semibold text-gray-500 text-lg"
                    style={styleTemplates.withSemiboldFont}
                  >
                    사람 정보를 불러올 수 없습니다
                  </Text>
                </View>
              )}
            </View>

            {/* 시작하기 버튼 */}
            <TouchableOpacity
              className={`rounded-xl p-4 ${
                isTTSActive || selectedPersonIds.length === 0 || isLoading
                  ? 'bg-gray-200'
                  : 'bg-blue-500'
              }`}
              onPress={() => stopTTSAndExecute(onSelectionComplete)}
              disabled={
                isTTSActive || selectedPersonIds.length === 0 || isLoading
              }
            >
              <Text
                className={`text-white text-xl font-semibold text-center ${
                  isTTSActive || selectedPersonIds.length === 0 || isLoading
                    ? 'text-gray-400'
                    : 'text-white'
                }`}
                style={styleTemplates.withBoldFont}
              >
                {isLoading
                  ? '시작 중...'
                  : `시작하기 (${selectedPersonIds.length}명 선택됨)`}
              </Text>
            </TouchableOpacity>
          </>
        )}
    </SafeAreaView>
  );
};

export default PresetSelectionStage;
