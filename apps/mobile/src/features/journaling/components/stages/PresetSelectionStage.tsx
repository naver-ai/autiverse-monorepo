import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
// @ts-ignore
import format from 'string-format';
import { styleTemplates } from '../../../../styles';
import { useSpeech } from '../../utils';
import { getTTSOptionsFromAgentConfig } from '../../utils/speechUtils';
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
import { getPlacePeopleAPI, PlacePerson } from '../../api';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../auth/store';
import { Place } from '@autiverse-monorepo/ts-core';
import { AnimatedText } from '../../../../components/AnimatedText';

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

export const PresetSelectionStage = ({
  onSelectionComplete,
  onStartChatbotWithSuggestion,
  onFreeStart,
  isStartingChatbot,
}: {
  onSelectionComplete: (selectedLocation: Place, selectedPersonIds: string[]) => void;
  onStartChatbotWithSuggestion: () => void;
  onFreeStart: () => void;
  isStartingChatbot: boolean;
}) => {
  const { t } = useTranslation();

  const [selectionStep, setSelectionStep] = useState<'location' | 'people'>('location');
  const [selectedLocation, setSelectedLocation] = useState<Place | null>(null);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);

  const {startSpeech, stopSpeech} = useSpeech()

  const [isTTSActive, setIsTTSActive] = useState(false);
  const [messageViewHeight, setMessageViewHeight] = useState(0);
  const { dyad, agentConfig } = useDyad();

  const {jwt} = useAuthStore();

  const {data: peopleInPlace, isLoading: isLoadingPeopleInPlace, error: peopleInPlaceError} = useQuery({
    queryKey: ['peopleInPlace', selectedLocation?.id],
    queryFn: () => getPlacePeopleAPI({placeId: selectedLocation!.id, token: jwt!}),
    enabled: !!selectedLocation && selectionStep === 'people' && !!jwt,
  });

  // TTS 시작
  useEffect(() => {
    const stopAndStartTTS = async () => {
      setIsTTSActive(true);
      await stopSpeech();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const ttsMessage =
        selectionStep === 'location'
          ? t('Journaling.PresetSelection.LocationSelectionMessage')
          : format(t('Journaling.PresetSelection.PeopleSelectionMessageTemplate'), { location: selectedLocation?.name });
      startSpeech(ttsMessage, {
        ...getTTSOptionsFromAgentConfig(agentConfig),
        onDone: () => {
          setIsTTSActive(false);
        },
        onError: (error) => {
          setIsTTSActive(false);
        },
      });
    };
    stopAndStartTTS();
  }, [selectionStep]);

  // TTS 중단 함수
  const stopTTSAndExecute = (callback: () => void) => {
    stopSpeech();
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

  const handleLocationSelect = (location: Place) => {
    setSelectedLocation(location);
    setSelectionStep('people');
  };

  // 컴포넌트 언마운트 시 TTS 정지
  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  // TTS 애니메이션 훅 사용
  const { ttsScalePulseStyle, ttsBorderColorStyle } = useSpeechAnimation(isTTSActive);

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
              <AnimatedText
                textStyle={styleTemplates.withBoldFont}
                textClassName="text-2xl text-gray-800 my-2"
                text={selectionStep === 'location'
                  ? t('Journaling.PresetSelection.LocationSelectionMessage')
                  : format(t('Journaling.PresetSelection.PeopleSelectionMessageTemplate'), { location: selectedLocation?.name })}
                initialDelay={0}
                charInterval={100}
              />
            </View>
          </Reanimated.View>
        </Reanimated.View>

        {selectionStep === 'location' ? (<ContentFrame messageViewHeight={messageViewHeight} footer={
          <View className="border-t-2 border-gray-200 pt-6 pb-6 mt-4 px-6 flex flex-row items-center">
          <TailwindButton
              containerClassName="flex-1 mr-2"
              buttonStyleClassName={'p-4 bg-blue-500'}
              roundedClassName="rounded-xl"
              disabledButtonStyleClassName="bg-gray-200"
              disabledTitleClassName="text-gray-400"
              titleClassName={'text-xl text-white'}
              title={isStartingChatbot ? t('Journaling.PresetSelection.Preparing') : t('Journaling.PresetSelection.DontKnowWhatToWrite')}
              onPress={() => stopTTSAndExecute(onStartChatbotWithSuggestion)}
              disabled={isTTSActive || isStartingChatbot}
            />
            <TailwindButton
              containerClassName="flex-1 ml-2"
              buttonStyleClassName={'p-4 bg-blue-500'}
              roundedClassName="rounded-xl"
              disabledButtonStyleClassName="bg-gray-200"
              titleClassName={'text-xl text-white'}
              disabledTitleClassName="text-gray-400"
              title={isStartingChatbot ? t('Journaling.PresetSelection.Preparing') : t('Journaling.PresetSelection.IWantToWriteSomething')}
              onPress={() => stopTTSAndExecute(onFreeStart)}
              disabled={isTTSActive || isStartingChatbot}
            />
        </View>
        }>
          <View className="flex-1 flex flex-row items-center justify-center flex-wrap mb-4">
              {dyad && dyad.places.length > 0 ? (
                // API 데이터 사용
                dyad.places.map((place) => (
                    <TailwindButton key={place.id}
                      containerClassName="w-[31%] m-3"
                      roundedClassName="rounded-xl"
                      buttonStyleClassName={twMerge('p-6 py-12 border-2 border-orange-300 bg-white')}
                      disabledButtonStyleClassName="border-gray-200 bg-gray-200"
                      titleClassName={'text-2xl text-gray-800'}
                      disabledTitleClassName="text-gray-400"
                      title={place.name}
                      rippleColor={colors.orange[300]}
                      onPress={() =>
                        stopTTSAndExecute(() =>
                          handleLocationSelect(place),
                        )
                      }
                      delayPress={500} // 빠른 터치 방지
                      disabled={isTTSActive || isStartingChatbot}
                    />
                ))
              ) : (
                // API 데이터가 없을 때 빈 상태 표시
                <View className="p-6 border-2 border-gray-200 rounded-xl bg-white">
                  <Text
                    className="text-xl text-gray-500 text-center"
                    style={styleTemplates.withSemiboldFont}
                  >
                    {t('Journaling.PresetSelection.LocationDataError')}
                  </Text>
                </View>
              )}
            </View>
        </ContentFrame>) : (
          <ContentFrame messageViewHeight={messageViewHeight} footer={
            <View className="border-t-2 border-gray-200 pt-6 pb-6 mt-4 px-6 flex">

            {/* 뒤로가기 버튼 */}
              <TailwindButton
                key={`back-to-location-${selectedLocation?.id}`}
                containerClassName="self-start mb-3"
                buttonStyleClassName={`p-2 bg-transparent`}
                shadowClassName="shadow-none"
                titleClassName={`text-blue-500 text-xl ${isTTSActive ? 'text-gray-400' : ''}`}
                disabledTitleClassName="text-gray-400"
                title={t('Journaling.PresetSelection.BackToLocation')}
                onPress={() => stopTTSAndExecute(() => setSelectionStep('location'))}
                disabled={isTTSActive}
              />

                <TailwindButton
              buttonStyleClassName={`rounded-xl p-5 ${
                isTTSActive || selectedPersonIds.length === 0 || isLoadingPeopleInPlace
                  ? 'bg-gray-200'
                  : 'bg-blue-500'
              }`}
              disabledButtonStyleClassName="bg-gray-200"
              titleClassName={`text-white text-2xl text-center ${
                isTTSActive || selectedPersonIds.length === 0 || isLoadingPeopleInPlace
                  ? 'text-gray-400'
                  : 'text-white'
              }`}
              disabledTitleClassName="text-gray-400"
              title={isLoadingPeopleInPlace
                ? t('Journaling.PresetSelection.Preparing')
                : format(t('Journaling.PresetSelection.NextStepTemplate'), { count: selectedPersonIds.length })}
              onPress={() => stopTTSAndExecute(()=>{
                onSelectionComplete(selectedLocation!, selectedPersonIds);
              })}
              disabled={
                isTTSActive || selectedPersonIds.length === 0 || isLoadingPeopleInPlace
              }
            />
            </View>
          }>

            {/* 사람 선택 그리드 */}
          <View className="flex-1 flex flex-row items-center justify-center flex-wrap mb-4">
              {isLoadingPeopleInPlace ? (
                // 로딩 상태
                <View className="p-4 border-2 border-gray-200 rounded-xl bg-white">
                  <Text
                    className="text-center text-gray-500 text-lg"
                    style={styleTemplates.withSemiboldFont}
                  >
                    {t('Journaling.PresetSelection.LoadingPeople')}
                  </Text>
                </View>
              ) : peopleInPlace && peopleInPlace.people.length > 0 ? (
                // 장소별 인물 데이터 사용
                peopleInPlace.people.map((person) => {
                  const isSelected = selectedPersonIds.includes(person.id);
                  return (
                  <TailwindButton
                    key={person.id}
                    rippleColor={colors.orange[300]}
                    containerClassName="w-[31%] m-3"
                    buttonStyleClassName={twMerge('p-6 py-12 border-2 border-orange-300', isSelected ? 'bg-orange-400' : 'bg-white')}
                    roundedClassName="rounded-xl"
                    disabledButtonStyleClassName={twMerge("border-gray-200", isSelected ? 'bg-gray-300' : 'bg-gray-200')}
                    onPress={() =>
                      executeWithConditionalTTSStop(() =>
                        setSelectedPersonIds([...selectedPersonIds, person.id]),
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
                // 장소에 인물이 없을 때 빈 상태 표시
                <View className="p-4 border-2 border-gray-200 rounded-xl bg-white">
                  <Text
                    className="text-center text-gray-500 text-lg"
                    style={styleTemplates.withSemiboldFont}
                  >
                    {t('Journaling.PresetSelection.NoPeopleInPlace')}
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
