import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { styleTemplates } from '../../../styles';

// 한국어 조사 선택 함수
const getKoreanParticle = (name: string): string => {
  if (!name) return '가';
  
  // 받침이 있는지 확인 (한글 유니코드 범위: 44032-55203)
  const lastChar = name.charAt(name.length - 1);
  const lastCharCode = lastChar.charCodeAt(0);
  
  // 한글이 아니거나 받침이 없는 경우
  if (lastCharCode < 44032 || lastCharCode > 55203) {
    return '가';
  }
  
  // 받침 계산: (유니코드 - 44032) % 28
  const baseCode = lastCharCode - 44032;
  const finalConsonant = baseCode % 28;
  
  // 받침이 있으면 '이가', 없으면 '가'
  return finalConsonant > 0 ? '이가' : '가';
};

interface VoiceRecordingStatusProps {
  agentName: string;
  isVoiceMode?: boolean;
  isVoiceRecording?: boolean;
  isTTSActive?: boolean;
  onComplete: () => void;
}

export const VoiceRecordingStatus: React.FC<VoiceRecordingStatusProps> = ({
  agentName,
  isVoiceMode,
  isVoiceRecording,
  isTTSActive,
  onComplete
}) => {
  const voiceMode = isVoiceMode ?? false;
  const voiceRecording = isVoiceRecording ?? false;
  const ttsActive = isTTSActive ?? false;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const bounceAnimation = useRef(new Animated.Value(1)).current;

  // 음성 녹음 애니메이션
  useEffect(() => {
    if (voiceRecording) {
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
  }, [voiceRecording]);

  // TTS나 음성 녹음이 활성화되지 않았으면 아무것도 표시하지 않음
  if (!ttsActive && !voiceRecording) {
    return null;
  }

  return (
    <View className={`flex-row items-center justify-between p-4 rounded-xl mb-4 ${
      voiceMode && voiceRecording 
        ? 'bg-blue-50 border-2 border-blue-200' 
        : 'bg-white border-2 border-gray-200'
    }`} style={{ minHeight: 110 }}>
      <View className="flex-row items-center flex-1">
        {voiceRecording ? (
          <View className="flex-row items-center mr-3">
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
        ) : (
          <View className="w-4 h-4 bg-gray-400 rounded-full mr-3" />
        )}
        <Text className={`text-xl ${
          voiceRecording 
            ? 'text-blue-800' 
            : 'text-gray-600'
        }`} style={styleTemplates.withBoldFont}>
          {`${agentName}${getKoreanParticle(agentName)} ${
            voiceRecording ? '듣는 중...' : '말하는 중...'
          }`}
        </Text>
      </View>
      
      {/* 완료 버튼은 음성 녹음 중일 때만 표시 */}
      {voiceRecording && (
        <Animated.View
          style={{
            transform: [{ scale: bounceAnimation }],
          }}
        >
        <TouchableOpacity
          onPress={onComplete}
            className="bg-green-500 rounded-lg items-center justify-center"
          style={{
              width: 90, // 정사각형 크기 (기존의 약 2배)
              height: 90,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
            <Text className="text-white text-2xl" style={styleTemplates.withBoldFont}>
            완료
          </Text>
        </TouchableOpacity>
        </Animated.View>
      )}
      
      {/* 말하는 중일 때는 빈 공간으로 높이 맞춤 */}
      {!voiceRecording && <View style={{ width: 90, height: 90 }} />}
    </View>
  );
}; 