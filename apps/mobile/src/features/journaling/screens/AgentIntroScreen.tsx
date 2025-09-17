import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
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
import { AgentImage } from '../components/AgentImage';
import { useSpeechAnimation } from '../hooks/useSpeechAnimation';
import Reanimated, { ZoomIn, Easing } from 'react-native-reanimated';
import { appendJosa, UserLocale } from '@autiverse-monorepo/ts-core';
import { AnimatedText } from '../../../components/AnimatedText';

const { width, height } = Dimensions.get('window');

export function AgentIntroScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [autoNavigate, setAutoNavigate] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [hasSpoken, setHasSpoken] = useState(false);
  const [isTTSActive, setIsTTSActive] = useState(false);

  const {startSpeech, stopSpeech} = useSpeech()
  const { dyad, locale, agentConfig, isDyadLoading, dyadError } = useDyad();

  // TTS 애니메이션 훅 사용
  const { ttsScalePulseStyle, ttsOpacityPulseStyle, ttsBorderColorStyle } = useSpeechAnimation(isTTSActive);

  const childNameWithJosa = useMemo(() => {
    if(locale === UserLocale.Korean && dyad?.child_name) {
      return appendJosa(dyad?.child_name, '아', '야');
    }
    return dyad?.child_name;
  }, [dyad?.child_name, locale]);

  const agentNameWithJosa = useMemo(() => {
    if(locale === UserLocale.Korean && dyad?.agents?.[0]?.agent_name) {
      return appendJosa(dyad?.agents?.[0]?.agent_name, '이야', '야');
    }
    return dyad?.agents?.[0]?.agent_name || '친구';
  }, [dyad?.agents?.[0]?.agent_name, locale]);


  const isFirstVisit = (dyad?.journal_entries?.length || 0) <= 1;

  const greetingText = useMemo(() => {
    return isFirstVisit
    ? format(t('Journaling.AgentIntro.FirstVisitGreetingTemplate'), { 
        child_name: childNameWithJosa, 
        agent_name: agentNameWithJosa 
      })
    : format(t('Journaling.AgentIntro.ReturnVisitGreetingTemplate'), { 
        child_name: childNameWithJosa, 
      });
  }, [t, childNameWithJosa, agentNameWithJosa, isFirstVisit]);

  useEffect(() => {
    if (dyad && !hasSpoken) {
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
        }
      });
    }
  }, [dyad, hasSpoken, greetingText]);

  // 컴포넌트 언마운트 시 TTS 정지
  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  useEffect(() => {
    if (autoNavigate && !hasNavigated) {
      setHasNavigated(true);
      router.replace({
        pathname: '/(app)/preset-selection',
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

    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-1 px-6">
          {/* 상단 인사말 영역 */}
          <View className="pt-8 pb-4">
            <Reanimated.View 
              className="bg-white rounded-3xl p-6 shadow-lg w-full border-2"
              entering={ZoomIn.easing(Easing.ease)}
              style={ttsBorderColorStyle}
            >
              <AnimatedText
                className="justify-center mb-4"
                textStyle={styleTemplates.withBoldFont}
                textClassName="text-2xl text-gray-800 my-2"
                text={greetingText}
                initialDelay={0}
                charInterval={80}
              />

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
                }}
              />
            </Reanimated.View>
          </View>
        </View>
      </SafeAreaView>
    );
  }
}
