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
import { useSpeechAnimation } from '../../hooks/useSpeechAnimation';
import Reanimated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { AnimatedText } from '../../../../components/AnimatedText';
import { TailwindButton } from '../../../../components/TailwindButton';

interface FarewellSectionProps {
  childName: string;
  agentConfig?: any;
  locale: UserLocale;
  onCompleteHandler?: () => void;
}

export interface FarewellSectionRef {
  runAnimation: () => void;
}

const FarewellSection = forwardRef<FarewellSectionRef, FarewellSectionProps>(
  ({ childName, agentConfig, locale, onCompleteHandler }, ref) => {
    const { t } = useTranslation();
    const {startSpeech, stopSpeech} = useSpeech();

    const farewellMessage = useMemo(() => {
      return format(t('Journaling.FarewellSection.MessageTemplate'), { 
        child_name: locale === UserLocale.Korean ? appendJosa(childName, '아', '야') : childName
      });
    }, [t, childName, locale]);

    const [isSpeaking, setIsSpeaking] = useState(false);
    const {ttsScalePulseStyle, ttsBorderColorStyle} = useSpeechAnimation(isSpeaking);

    // Hand shaking animation
    const handShakeValue = useSharedValue(-1);
    
    useEffect(() => {
      handShakeValue.value = withRepeat(
        withTiming(1, {
          duration: 500,
          easing: Easing.inOut(Easing.ease),
        }),
        -1, // Infinite repeat
        true // Reverse
      );
    }, []);

    const handShakeStyle = useAnimatedStyle(() => {
      return {
        transform: [
          {
            translateY: 20, // Move pivot point down by 20px
          },
          {
            translateX: handShakeValue.value * 10, // 10px left and right
          },
          {
            rotate: `${handShakeValue.value * 15}deg`, // 15 degrees rotation
          },
          {
            translateY: -20, // Move back up to original position
          },
        ],
      };
    });

    

    // TTS 시작
    const runAnimation = useCallback((onCompleteHandler?: () => void) => {
      setIsSpeaking(true);
      startSpeech(farewellMessage, {
        ...getTTSOptionsFromAgentConfig(agentConfig),
        onDone: () => {
          // TTS 완료 후 0.5초 뒤에 완료 콜백 호출
          setTimeout(() => {
            onCompleteHandler?.();
          }, 2000);
          setIsSpeaking(false);
        },
        onError: (error) => {
          // 에러 발생 시에도 5초 후 완료
          setTimeout(() => {
            onCompleteHandler?.();
          }, 6000);
          setIsSpeaking(false);
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
            <Reanimated.View style={ttsBorderColorStyle} className="rounded-2xl p-10 w-[70vw] border-2 border-gray-200">
              <AnimatedText className="mb-2 justify-center" textClassName="text-3xl text-gray-800 my-2" textStyle={styleTemplates.withBoldFont} text={farewellMessage} initialDelay={0} charInterval={100} />
              
              <View className="items-center mt-12">
                <TailwindButton
                  onPress={() => onCompleteHandler?.()}
                  shadowClassName='shadow-none'
                  buttonStyleClassName='bg-transparent'
                >
                  <Reanimated.Image
                  source={require('../../../../../assets/hand.png')} 
                  style={[handShakeStyle]} 
                  className="w-48 h-48" 
                />
                </TailwindButton>
                
              </View>
            </Reanimated.View>
          </View>
        </View>
      </SafeAreaView>
    );
  }
);

FarewellSection.displayName = 'FarewellSection';

export default FarewellSection; 