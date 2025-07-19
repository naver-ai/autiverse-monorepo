import { useEffect } from 'react';
import { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, interpolate, interpolateColor, Easing } from 'react-native-reanimated';

interface UseSpeechAnimationReturn {
  ttsScalePulseStyle: any;
  ttsOpacityPulseStyle: any;
  ttsBorderColorStyle: any;
}

export const useSpeechAnimation = (isSpeaking: boolean): UseSpeechAnimationReturn => {
  // 공유 애니메이션 값 (0: 평상시, 1: 애니메이션 최대치)
  const ttsAnimationValue = useSharedValue(0);
  const ttsSlowAnimationValue = useSharedValue(0);

  // TTS 애니메이션 관리
  useEffect(() => {
    if (isSpeaking) {
      ttsAnimationValue.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );

      ttsSlowAnimationValue.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      ttsAnimationValue.value = withTiming(0, { duration: 150, easing: Easing.inOut(Easing.ease) });
      ttsSlowAnimationValue.value = withTiming(0, { duration: 300, easing: Easing.inOut(Easing.ease) });
    }
  }, [isSpeaking, ttsAnimationValue, ttsSlowAnimationValue]);

  const ttsScalePulseStyle = useAnimatedStyle(() => {
    return {
      transform: [{ 
        scale: interpolate(
          ttsAnimationValue.value,
          [0, 1],
          [1, 1.1]
        )
      }],
    };
  });

  const ttsOpacityPulseStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        ttsAnimationValue.value,
        [0, 1],
        [1, 0.8]
      ),
    };
  });

  const ttsBorderColorStyle = useAnimatedStyle(() => {
    return {
      borderColor: interpolateColor(
        ttsSlowAnimationValue.value,
        [0, 1],
        ['#00000000', '#FFA500']
      ),
    };
  });

  return {
    ttsScalePulseStyle,
    ttsOpacityPulseStyle,
    ttsBorderColorStyle,
  };
}; 