import React, { useEffect, useState, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
// @ts-ignore
import format from 'string-format';
import { styleTemplates } from '../../../../styles';
import { useSpeech } from '../../utils';
import { getTTSOptionsFromAgentConfig } from '../../utils/speechUtils';
import { useDyad } from '../../../../api/dyad';

interface FarewellSectionProps {
  childName: string;
}

export interface FarewellSectionRef {
  runAnimation: (onComplete?: () => void) => void;
}

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

const FarewellSection = forwardRef<FarewellSectionRef, FarewellSectionProps>(
  ({ childName }, ref) => {
    const { t } = useTranslation();
    const {startSpeech, stopSpeech} = useSpeech();
    const { agentConfig } = useDyad();

    const childJosa = getKoreanJosa(childName);
    const farewellMessage = useMemo(() => {
      return format(t('Journaling.FarewellSection.MessageTemplate'), { 
        child_name: childName, 
        child_josa: childJosa 
      });
    }, [t, childName, childJosa]);

    // TTS 시작
    const runAnimation = useCallback((onCompleteHandler?: () => void) => {
      if (agentConfig) {
        startSpeech(farewellMessage, {
          ...getTTSOptionsFromAgentConfig(agentConfig),
          onDone: () => {
            // TTS 완료 후 0.5초 뒤에 완료 콜백 호출
            setTimeout(() => {
              onCompleteHandler?.();
            }, 500);
          },
          onError: (error) => {
            // 에러 발생 시에도 5초 후 완료
            setTimeout(() => {
              onCompleteHandler?.();
            }, 5000);
          }
        });
      }
    }, [farewellMessage, agentConfig, startSpeech]);

    // Expose imperative methods via ref
    useImperativeHandle(
      ref,
      () => ({
        runAnimation,
      }),
      [runAnimation],
    );

    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-1 px-6">
          {/* 중앙 인사말 영역 */}
          <View className="flex-1 items-center justify-center">
            <View className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-3xl p-10 w-full max-w-lg border border-pink-100">
              <Text className="text-3xl text-gray-800 leading-relaxed text-center mb-8" style={styleTemplates.withBoldFont}>
              {farewellMessage}
              </Text>
              
              <View className="items-center">
                <Text className="text-8xl text-center mb-6" style={styleTemplates.withBoldFont}>
                  👋
                </Text>
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }
);

FarewellSection.displayName = 'FarewellSection';

export default FarewellSection; 