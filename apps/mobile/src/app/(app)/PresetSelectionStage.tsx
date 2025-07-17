import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Place, Person, Preset } from '../../features/tablet-comic-chatbot/types';
import { getCurrentDay } from '../../features/tablet-comic-chatbot/utils';
import { getImageSource } from '../../features/tablet-comic-chatbot/utils/imageUtils';
import { styleTemplates } from '../../styles';
import { speakText, stopSpeech } from '../../features/tablet-comic-chatbot/utils/speechUtils';

interface PresetSelectionStageProps {
  selectionStep: 'location' | 'people';
  places: Place[];
  people: Person[];
  selectedLocation: string | null;
  selectedPeople: string[];
  selectedPlaceId: string | null;
  selectedPersonIds: string[];
  useApiData: boolean;
  agentConfig: any;
  isLoading: boolean;
  onLocationSelect: (location: string, placeId?: string) => void;
  onPersonToggle: (person: string, personId?: string) => void;
  onBackToLocation: () => void;
  onSelectionComplete: () => void;
  onStartChatbotWithSuggestion: () => void;
  onFreeStart: () => void;
}

export const PresetSelectionStage: React.FC<PresetSelectionStageProps> = ({
  selectionStep,
  places,
  people,
  selectedLocation,
  selectedPeople,
  selectedPlaceId,
  selectedPersonIds,
  useApiData,
  agentConfig,
  isLoading,
  onLocationSelect,
  onPersonToggle,
  onBackToLocation,
  onSelectionComplete,
  onStartChatbotWithSuggestion,
  onFreeStart
}) => {
  const [hasSpoken, setHasSpoken] = useState(false);
  const [isTTSActive, setIsTTSActive] = useState(false);

  // TTS 시작
  useEffect(() => {
    const stopAndStartTTS = async () => {
      setIsTTSActive(true);
      await stopSpeech();
      await new Promise(resolve => setTimeout(resolve, 100));
      const ttsMessage = selectionStep === 'location' 
        ? '오늘은 어디서 있었던 일을 그림 일기로 써볼까?'
        : '거기서 누구랑 있었던 일을 그림 일기로 써볼까? 여러명이면 여러명을 선택해!';
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
        }
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
  return (
    <View className="flex-1 p-6">
      <ScrollView className="flex-1">
        {/* 상단 메시지 */}
        <View className="pt-8 pb-12">
          <View className="bg-white rounded-3xl p-6 shadow-lg w-full">
            <View className="flex-row items-center">
              <Image 
                source={
                  agentConfig?.avatar_image 
                    ? (agentConfig.avatar_image.startsWith('http') 
                        ? { uri: agentConfig.avatar_image }
                        : getImageSource(agentConfig.avatar_image))
                    : require('../../../assets/robot.png')
                }
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  resizeMode: 'cover',
                  marginRight: 12
                }}
              />
              <Text className="text-2xl text-gray-800 leading-relaxed flex-1 text-center" style={styleTemplates.withBoldFont}>
                {selectionStep === 'location' 
                  ? '오늘은 어디서 있었던 일을 그림 일기로 써볼까?'
                  : '거기서 누구랑 있었던 일을 그림 일기로 써볼까? 여러명이면 여러명을 선택해!'
                }
              </Text>
            </View>
          </View>
        </View>

        {selectionStep === 'location' ? (
          <>
            {/* 장소 선택 그리드 */}
            <View className="grid grid-cols-2 gap-4 mb-4">
              {places.length > 0 ? (
                // API 데이터 사용
                places.map((place) => (
                  <TouchableOpacity
                    key={place.id}
                    className={`p-6 border-2 rounded-xl ${
                      isTTSActive || isLoading
                        ? 'border-gray-200 bg-gray-200'
                        : 'border-gray-200 bg-white'
                    }`}
                    onPress={() => stopTTSAndExecute(() => onLocationSelect(place.name, place.id))}
                    disabled={isTTSActive || isLoading}
                  >
                    <Text
                      className={`text-xl font-semibold text-center ${
                        isTTSActive || isLoading ? 'text-gray-400' : 'text-gray-800'
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
                  <Text className="text-xl font-semibold text-gray-500 text-center" style={styleTemplates.withSemiboldFont}>
                    장소 정보를 불러올 수 없습니다
                  </Text>
                </View>
              )}
            </View>
            
            {/* 자유롭게 시작하기 버튼들 */}
            <View className="border-t-2 border-gray-200 pt-6 mt-4">
              <TouchableOpacity
                className={`rounded-xl p-4 ${
                  isTTSActive || isLoading
                    ? 'bg-gray-200'
                    : 'bg-blue-500'
                }`}
                style={{ marginBottom: 20 }}
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
                className={`rounded-xl p-4 ${
                  isTTSActive || isLoading
                    ? 'bg-gray-200'
                    : 'bg-blue-500'
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
              onPress={() => stopTTSAndExecute(onBackToLocation)}
              disabled={isTTSActive}
            >
              <Text className={`text-blue-500 text-xl ${isTTSActive ? 'text-gray-400' : ''}`} style={styleTemplates.withBoldFont}>← 장소 다시 선택</Text>
            </TouchableOpacity>
            
            {/* 선택된 장소 표시 */}
            <View className="mb-6 p-4 bg-blue-50 rounded-lg">
              <Text className="text-xl text-gray-800" style={styleTemplates.withSemiboldFont}>
                <Text className="font-bold" style={styleTemplates.withBoldFont}>선택된 장소:</Text> {selectedLocation}
              </Text>
            </View>
            
            {/* 사람 선택 그리드 */}
            <View className="grid grid-cols-2 gap-4 mb-6">
              {useApiData && people.length > 0 ? (
                // API 데이터 사용
                people.map((person) => (
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
                    onPress={() => executeWithConditionalTTSStop(() => onPersonToggle(person.name, person.id))}
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
                  <Text className="text-center font-semibold text-gray-500 text-lg" style={styleTemplates.withSemiboldFont}>
                    사람 정보를 불러올 수 없습니다
                  </Text>
                </View>
              )}
            </View>
            
            {/* 시작하기 버튼 */}
            <TouchableOpacity
              className={`rounded-xl p-4 ${
                isTTSActive || ((useApiData && selectedPersonIds.length === 0) || (!useApiData && selectedPeople.length === 0)) || isLoading
                  ? 'bg-gray-200'
                  : 'bg-blue-500'
              }`}
              onPress={() => stopTTSAndExecute(onSelectionComplete)}
              disabled={isTTSActive || ((useApiData && selectedPersonIds.length === 0) || (!useApiData && selectedPeople.length === 0)) || isLoading}
            >
              <Text
                  className={`text-white text-xl font-semibold text-center ${
                  isTTSActive || ((useApiData && selectedPersonIds.length === 0) || (!useApiData && selectedPeople.length === 0)) || isLoading
                    ? 'text-gray-400'
                    : 'text-white'
                }`}
                style={styleTemplates.withBoldFont}
              >
                {isLoading ? '시작 중...' : `시작하기 (${
                  useApiData ? selectedPersonIds.length : selectedPeople.length
                }명 선택됨)`}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}; 

export default PresetSelectionStage; 