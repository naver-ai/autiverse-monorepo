import React, { useEffect, useRef, useState, memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { styleTemplates } from '../../../styles';
import { useVoiceRecorderState, useSpeechState } from '../utils';
import { useTranslation } from 'react-i18next';
import format from 'string-format';
import { escapeJongseong } from '@autiverse-monorepo/ts-core';

import Reanimated, { Easing, FadeIn, FadeOut } from 'react-native-reanimated';

export const VoiceRecordingStatus = memo(({
  agentName,
  onComplete
}: {
  agentName: string;
  isVoiceMode?: boolean;
  onComplete: () => void;
}) => {

  const {isRecording} = useVoiceRecorderState()

  const pulseAnimation = useRef(new Animated.Value(1)).current;

  const bounceAnimation = useRef(new Animated.Value(1)).current;

  const {t} = useTranslation();
  const listeningText = useMemo(()=>{
    return format(t('ChatInput.VoiceRecording.ListeningTextTemplate'), { agentName: escapeJongseong(agentName)});
  }, [t, agentName]);


  // 음성 녹음 애니메이션
  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      
      // Bounce 애니메이션
      const bounce = Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnimation, {
            toValue: 1.15,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(bounceAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      bounce.start();
      
      return () => {
        pulse.stop();
        bounce.stop();
      };
    }
  }, [isRecording]);

  // TTS나 음성 녹음이 활성화되지 않았으면 아무것도 표시하지 않음
  if (!isRecording) {
    return null;
  }

  return (isRecording && <Reanimated.View entering={FadeIn.duration(300).easing(Easing.out(Easing.cubic))} exiting={FadeOut.duration(200).easing(Easing.out(Easing.cubic))} 
          className={"flex-row items-center justify-between p-4 rounded-xl mb-4 bg-white border-2 border-gray-200 min-h-[110px]"}>
      <View className="flex-row items-center flex-1"><View className="flex-row items-center mr-3">
            <Animated.View
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                marginRight: 8,
                backgroundColor: '#ef4444',
                transform: [{ scale: pulseAnimation }],
              }}
            />
          </View>
        <Text className={`text-xl ${
          'text-blue-800' 
        }`} style={styleTemplates.withBoldFont}>
          {listeningText}
        </Text>
      </View>
      
      <Animated.View
          style={{
            transform: [{ scale: bounceAnimation }],
          }}
        >
        <TouchableOpacity
          onPress={onComplete}
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
        </Animated.View>
    </Reanimated.View>)
})