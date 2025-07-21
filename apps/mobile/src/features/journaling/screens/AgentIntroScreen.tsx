import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
// @ts-ignore
import format from 'string-format';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styleTemplates } from '../../../styles';
import { useDyad } from '../../../api/dyad';
import { useSpeech } from '../utils';
import { getTTSOptionsFromAgentConfig } from '../utils/speechUtils';
import { getImageSource } from '../utils/imageUtils';
import { AgentImage } from '../components/AgentImage';
import { useSpeechAnimation } from '../hooks/useSpeechAnimation';
import Reanimated from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

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

export function AgentIntroScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [autoNavigate, setAutoNavigate] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [hasSpoken, setHasSpoken] = useState(false);
  const [isTTSActive, setIsTTSActive] = useState(false);

  const {startSpeech, stopSpeech} = useSpeech()
  const { dyad, agentConfig, isDyadLoading, dyadError } = useDyad();

  // TTS 애니메이션 훅 사용
  const { ttsScalePulseStyle, ttsOpacityPulseStyle, ttsBorderColorStyle } = useSpeechAnimation(isTTSActive);

  useEffect(() => {
    if (dyad && !hasSpoken) {
      const isFirstVisit = dyad.journal_entries?.length <= 1;
      const childJosa = getKoreanJosa(dyad.child_name);
      const agentJosa = getKoreanJosa(dyad.agents?.[0]?.agent_name || '친구');

      const greetingText = isFirstVisit
        ? format(t('Journaling.AgentIntro.FirstVisitGreetingTemplate'), { 
            child_name: dyad.child_name, 
            child_josa: childJosa, 
            agent_name: dyad.agents?.[0]?.agent_name || '친구', 
            agent_josa: agentJosa 
          })
        : format(t('Journaling.AgentIntro.ReturnVisitGreetingTemplate'), { 
            child_name: dyad.child_name, 
            child_josa: childJosa 
          });

      console.log('AgentIntroScreen: isFirstVisit:', isFirstVisit);

      // TTS 시작
      setIsTTSActive(true);
      startSpeech(greetingText, {
        ...getTTSOptionsFromAgentConfig(agentConfig),
        onDone: () => {
          setHasSpoken(true);
          setIsTTSActive(false);
          // TTS 완료 후 1초 뒤에 다음 화면으로 이동
          setTimeout(() => {
            setAutoNavigate(true);
          }, 1000);
        },
        onError: (error) => {
          setHasSpoken(true);
          setIsTTSActive(false);
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
        pathname: '/(app)/create-comic',
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
            {t('Journaling.AgentIntro.Loading')}
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
            {t('Journaling.AgentIntro.DataLoadError')}
          </Text>
        </View>
      </SafeAreaView>
    );
  } else {

    console.log(dyad)
    const isFirstVisit = dyad!.journal_entries?.length <= 1;
    const childJosa = getKoreanJosa(dyad!.child_name);
    const agentJosa = getKoreanJosa(dyad!.agents?.[0]?.agent_name || '친구');

    const greetingText = isFirstVisit
      ? format(t('Journaling.AgentIntro.FirstVisitGreetingTemplate'), { 
          child_name: dyad!.child_name, 
          child_josa: childJosa, 
          agent_name: dyad!.agents?.[0]?.agent_name || '친구', 
          agent_josa: agentJosa 
        })
      : format(t('Journaling.AgentIntro.ReturnVisitGreetingTemplate'), { 
          child_name: dyad!.child_name, 
          child_josa: childJosa 
        });

    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-1 px-6">
          {/* 상단 인사말 영역 */}
          <View className="pt-8 pb-4">
            <Reanimated.View 
              className="bg-white rounded-3xl p-6 shadow-lg w-full border-2"
              style={ttsBorderColorStyle}
            >
              <Reanimated.Text
                className="text-2xl text-gray-800 leading-relaxed text-center mb-4"
                style={[styleTemplates.withBoldFont, ttsOpacityPulseStyle]}
              >
                {greetingText}
              </Reanimated.Text>

              <View className="items-center">
                <Text
                  className="text-lg text-gray-600 text-center"
                  style={styleTemplates.withSemiboldFont}
                >
                  {dyad!.agents?.[0]?.agent_name || '친구'}
                </Text>
              </View>
            </Reanimated.View>
          </View>

          {/* 중앙 에이전트 이미지 영역 */}
          <View className="flex-1 items-center justify-center">
            <Reanimated.View style={ttsScalePulseStyle}>
              <AgentImage
                avatarImage={dyad!.agents?.[0]?.agent_config?.avatar_image || ''}
                style={{
                  width: width * 0.4,
                  height: width * 0.4,
                  resizeMode: 'contain',
                }}
              />
            </Reanimated.View>
          </View>
        </View>
      </SafeAreaView>
    );
  }
}
