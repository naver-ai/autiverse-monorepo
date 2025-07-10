import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
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
  isVoiceMode = false,
  isVoiceRecording = false,
  isTTSActive = false,
  onComplete
}) => {
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  // 음성 녹음 애니메이션
  useEffect(() => {
    if (isVoiceRecording) {
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
      return () => pulse.stop();
    }
  }, [isVoiceRecording]);

  // TTS나 음성 녹음이 활성화되지 않았으면 아무것도 표시하지 않음
  if (!isTTSActive && !isVoiceRecording) {
    return null;
  }

  return (
    <View className={`flex-row items-center justify-between p-4 rounded-xl mb-4 ${
      isVoiceMode && isVoiceRecording 
        ? 'bg-blue-50 border-2 border-blue-200' 
        : 'bg-white border-2 border-gray-200'
    }`}>
      <View className="flex-row items-center flex-1">
        {isVoiceRecording ? (
          <Animated.View
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              marginRight: 12,
              backgroundColor: '#ef4444',
              transform: [{ scale: pulseAnimation }],
            }}
          />
        ) : (
          <View className="w-4 h-4 bg-gray-400 rounded-full mr-3" />
        )}
        <Text className={`text-lg font-semibold ${
          isVoiceRecording 
            ? 'text-blue-800' 
            : 'text-gray-600'
        }`} style={styleTemplates.withBoldFont}>
          {`${agentName}${getKoreanParticle(agentName)} ${
            isVoiceRecording ? '듣는 중...' : '말하는 중...'
          }`}
        </Text>
      </View>
      
      {/* 완료 버튼은 음성 녹음 중일 때만 표시 */}
      {isVoiceRecording && (
        <TouchableOpacity
          onPress={onComplete}
          className="bg-green-500 px-4 py-2 rounded-lg"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <Text className="text-white font-bold text-base" style={styleTemplates.withBoldFont}>
            완료
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}; 