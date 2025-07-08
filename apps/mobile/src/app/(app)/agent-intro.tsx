import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styleTemplates } from '../../styles';
import { useDyad } from '../../api/dyad';
import { speakText, stopSpeech } from '../../features/tablet-comic-chatbot/utils/speechUtils';

const { width, height } = Dimensions.get('window');

// 이미지 매핑 함수
const getImageSource = (imageName: string) => {
  switch (imageName) {
    case 'robot':
      return require('../../../assets/robot.png');
    case 'doll':
      return require('../../../assets/doll.png');
    default:
      return require('../../../assets/icon.png');
  }
};

// 한글 조사 처리 함수 (종성에 따라 '아'/'야' 선택)
const getKoreanJosa = (name: string): string => {
  if (!name) return '야';

  const lastName = name.charAt(name.length - 1);
  const lastNameCode = lastName.charCodeAt(0);

  // 한글 유니코드 범위: 44032 ~ 55203
  if (lastNameCode >= 44032 && lastNameCode <= 55203) {
    // 한글 유니코드에서 종성 계산: (유니코드 - 44032) % 28
    const jongseong = (lastNameCode - 44032) % 28;
    // 종성이 있으면 (0이 아니면) '아', 없으면 (0이면) '야'
    return jongseong === 0 ? '야' : '아';
  }

  // 한글이 아닌 경우 기본값
  return '야';
};

export default function AgentIntroScreen() {
  const router = useRouter();
  const [autoNavigate, setAutoNavigate] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [hasSpoken, setHasSpoken] = useState(false);

  const { dyad, isDyadLoading, dyadError } = useDyad();

  console.log('AgentIntroScreen rendered');

  useEffect(() => {
    if (dyad && !hasSpoken) {
      console.log('AgentIntroScreen: Starting TTS - dyad loaded, hasSpoken:', hasSpoken);
      const isFirstVisit = dyad.journal_entries.length <= 1;
      const childJosa = getKoreanJosa(dyad.child_name);
      const agentJosa = getKoreanJosa(dyad.agents[0].agent_name);

      const greetingText = isFirstVisit
        ? `안녕, ${dyad.child_name}${childJosa}. 나는 2주간 너와 함께 그림 일기를 쓸 ${dyad.agents[0].agent_name}${agentJosa}. 만나서 반가워!`
        : `안녕, ${dyad.child_name}${childJosa}. 또 만나니 너무 좋다.`;

      console.log('AgentIntroScreen: Greeting text:', greetingText);
      console.log('AgentIntroScreen: isFirstVisit:', isFirstVisit);

      // TTS 시작
      speakText(greetingText, {
        language: 'ko-KR',
        pitch: 1.0,
        rate: 0.8,
        onDone: () => {
          setHasSpoken(true);
          // TTS 완료 후 1초 뒤에 다음 화면으로 이동
          setTimeout(() => {
            setAutoNavigate(true);
          }, 1000);
        },
        onError: (error) => {
          setHasSpoken(true);
          // 에러 발생 시에도 3초 후 이동
          setTimeout(() => {
            setAutoNavigate(true);
          }, 3000);
        }
      });
    }
  }, [dyad, hasSpoken]);

  // 컴포넌트 언마운트 시 TTS 정지
  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  useEffect(() => {
    if (autoNavigate && !hasNavigated) {
      setHasNavigated(true);
      router.push({
        pathname: '/(app)/tablet-comic-chatbot',
      });
    }
  }, [autoNavigate, router, hasNavigated]);

  if (isDyadLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-1 items-center justify-center">
          <Text
            className="text-lg text-slate-500"
            style={styleTemplates.withBoldFont}
          >
            로딩 중...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!dyad && dyadError != null) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-1 items-center justify-center">
          <Text
            className="text-lg text-red-500"
            style={styleTemplates.withBoldFont}
          >
            데이터를 불러올 수 없습니다.
          </Text>
        </View>
      </SafeAreaView>
    );
  } else {

    console.log(dyad)
    const isFirstVisit = dyad!.journal_entries.length <= 1;
    const childJosa = getKoreanJosa(dyad!.child_name);
    const agentJosa = getKoreanJosa(dyad!.agents[0].agent_name);

    const greetingText = isFirstVisit
      ? `안녕, ${dyad!.child_name}${childJosa}. 나는 2주간 너와 함께 그림 일기를 쓸 ${dyad!.agents[0].agent_name}${agentJosa}. 만나서 반가워!`
      : `안녕, ${dyad!.child_name}${childJosa}. 또 만나니 너무 좋다.`;

    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-1 px-6">
          {/* 상단 인사말 영역 */}
          <View className="pt-8 pb-4">
            <View className="bg-white rounded-3xl p-6 shadow-lg w-full">
              <Text
                className="text-xl text-gray-800 leading-relaxed text-center mb-4"
                style={styleTemplates.withBoldFont}
              >
                {greetingText}
              </Text>

              <View className="items-center">
                <Text
                  className="text-base text-gray-600 text-center"
                  style={styleTemplates.withSemiboldFont}
                >
                  {dyad!.agents[0].agent_name}
                </Text>
              </View>
            </View>
          </View>

          {/* 중앙 에이전트 이미지 영역 */}
          <View className="flex-1 items-center justify-center">
            <Image
              source={
                dyad!.agents[0].agent_config?.avatar_image
                  ? dyad!.agents[0].agent_config.avatar_image.startsWith('http')
                    ? { uri: dyad!.agents[0].agent_config.avatar_image }
                    : getImageSource(dyad!.agents[0].agent_config.avatar_image)
                  : require('../../../assets/robot.png')
              }
              style={{
                width: width * 0.4,
                height: width * 0.4,
                resizeMode: 'contain',
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }
}
