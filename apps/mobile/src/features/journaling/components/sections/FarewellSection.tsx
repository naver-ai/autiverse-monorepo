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
import { appendJosa, UserLocale } from '@autiverse-monorepo/ts-core';

interface FarewellSectionProps {
  childName: string;
  agentConfig?: any;
  locale: UserLocale;
}

export interface FarewellSectionRef {
  runAnimation: (onComplete?: () => void) => void;
}

const FarewellSection = forwardRef<FarewellSectionRef, FarewellSectionProps>(
  ({ childName, agentConfig, locale }, ref) => {
    const { t } = useTranslation();
    const {startSpeech, stopSpeech} = useSpeech();

    const farewellMessage = useMemo(() => {
      return format(t('Journaling.FarewellSection.MessageTemplate'), { 
        child_name: locale === UserLocale.Korean ? appendJosa(childName, '아', '야') : childName
      });
    }, [t, childName, locale]);

    // TTS 시작
    const runAnimation = useCallback((onCompleteHandler?: () => void) => {
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