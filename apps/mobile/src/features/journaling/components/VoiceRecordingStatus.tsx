import React, { useEffect, useRef, useState, memo, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styleTemplates } from '../../../styles';
import { useVoiceRecorderState, useSpeechState } from '../utils';
import { useTranslation } from 'react-i18next';
import format from 'string-format';
import { escapeJongseong } from '@autiverse-monorepo/ts-core';

import Reanimated, { 
  Easing, 
  FadeIn, 
  FadeOut, 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming,
  withSequence,
  withSpring
} from 'react-native-reanimated';
import { useAudioMetering } from '../utils/voiceRecordingUtils';

export const VoiceRecordingStatus = memo(({
  agentName,
  onComplete
}: {
  agentName: string;
  isVoiceMode?: boolean;
  onComplete: () => void;
}) => {

  const {isRecording} = useVoiceRecorderState()

  const audioMetering = useAudioMetering()

  const bounceScale = useSharedValue(1);

  const {t} = useTranslation();
  const listeningText = useMemo(()=>{
    return format(t('ChatInput.VoiceRecording.ListeningTextTemplate'), { agentName: escapeJongseong(agentName)});
  }, [t, agentName]);

  // Pulse animation style - audioMetering에 직접 연동
  const pulseAnimatedStyle = useAnimatedStyle(() => {
    if (!isRecording || !audioMetering.value) {
      return {
        transform: [{ scale: withSpring(0, {
          damping: 15,
          stiffness: 150,
        }) }],
      };
    }
    
    // audioMetering: -160 ~ -40 -> scale: 0 ~ 1.2
    const meteringValue = audioMetering.value;
    const normalizedValue = Math.max(0, (meteringValue + 160) / 120); // 120 = -40 - (-160)
    const targetScale = normalizedValue;
    
    return {
      transform: [{ scale: withSpring(targetScale, {
        damping: 15,
        stiffness: 150,
        mass: 0.5,
      }) }],
    };
  });

  // Bounce animation style
  const bounceAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: bounceScale.value }],
    };
  });



  // Bounce 애니메이션
  useEffect(() => {
    if (isRecording) {
      bounceScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1, // infinite repeat
        false // reverse
      );
    } else {
      // 애니메이션 중지
      bounceScale.value = withTiming(1, { duration: 200 });
    }
  }, [isRecording]);

  // TTS나 음성 녹음이 활성화되지 않았으면 아무것도 표시하지 않음
  if (!isRecording) {
    return null;
  }

  return (isRecording && <Reanimated.View entering={FadeIn.duration(300).easing(Easing.out(Easing.cubic))} exiting={FadeOut.duration(200).easing(Easing.out(Easing.cubic))} 
          className={"flex-row items-center justify-between p-4 rounded-xl mb-4 bg-white border-2 border-gray-200 min-h-[110px]"}>
      <View className="flex-row items-center flex-1"><View className="flex-row items-center mr-3">
            <Reanimated.View
              style={[{
                width: 16,
                height: 16,
                borderRadius: 8,
                marginRight: 8,
                backgroundColor: '#ef4444',
              }, pulseAnimatedStyle]}
            />
          </View>
        <Text className={'text-xl text-rose-400 animate-pulse'} style={styleTemplates.withBoldFont}>
          {listeningText}
        </Text>
      </View>
      
      <Reanimated.View style={bounceAnimatedStyle}>
        <TouchableOpacity
          onPress={() => onComplete()}
            className="bg-green-500 rounded-lg items-center justify-center p-10"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
            <Text className="text-white text-xl" style={styleTemplates.withBoldFont}>
              {t('Chat.VoiceCompleteButton')}
          </Text>
        </TouchableOpacity>
        </Reanimated.View>
    </Reanimated.View>)
})