import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Dimensions, Animated, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styleTemplates } from '../styles';

const { width, height } = Dimensions.get('window');

interface PraiseSectionProps {
  message: string; // 백엔드에서 받은 메시지
  agentConfig?: any; // agent 설정
  onComplete?: () => void;
}



export default function PraiseSection({ message, agentConfig, onComplete }: PraiseSectionProps) {
  const [showStamp, setShowStamp] = useState(false);
  const [stampScale] = useState(new Animated.Value(0));
  const [hasCompleted, setHasCompleted] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [visibleSentences, setVisibleSentences] = useState<string[]>([]);
  
  // 메시지를 문장 단위로 분리
  const sentences = message.split('.').filter(s => s.trim().length > 0).map(s => s.trim() + '.');
  
  // 이미지 매핑 함수
  const getImageSource = (imageName: string) => {
    switch (imageName) {
      case 'robot':
        return require('../../assets/robot.png');
      case 'doll':
        return require('../../assets/doll.png');
      default:
        return require('../../assets/icon.png');
    }
  };

  // 문장 애니메이션 효과
  useEffect(() => {
    if (currentSentenceIndex < sentences.length) {
      const timer = setTimeout(() => {
        setVisibleSentences(prev => [...prev, sentences[currentSentenceIndex]]);
        setCurrentSentenceIndex(prev => prev + 1);
      }, 1000); // 1초마다 문장 추가

      return () => clearTimeout(timer);
    } else {
      // 모든 문장이 표시된 후 2초 뒤에 스탬프 표시
      const timer = setTimeout(() => {
        setShowStamp(true);
        Animated.spring(stampScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [currentSentenceIndex, sentences.length]);

  useEffect(() => {
    // 스탬프 애니메이션 완료 후 3초 뒤에 완료 콜백 호출 (스탬프를 충분히 볼 시간)
    if (showStamp) {
      const timer = setTimeout(() => {
        if (!hasCompleted) {
          setHasCompleted(true);
          onComplete?.();
        }
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [showStamp, hasCompleted, onComplete]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 px-6">
        {/* 상단 Agent + 문구 영역 (장소 고를 때와 동일한 스타일) */}
        <View className="pt-8 pb-4">
          <View className="bg-white rounded-3xl p-6 shadow-lg w-full">
            <View className="flex-row items-center">
              <Image 
                source={
                  agentConfig?.avatar_image 
                    ? (agentConfig.avatar_image.startsWith('http') 
                        ? { uri: agentConfig.avatar_image }
                        : getImageSource(agentConfig.avatar_image))
                    : require('../../assets/robot.png')
                }
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  resizeMode: 'cover',
                  marginRight: 12
                }}
              />
              <View className="flex-1">
                {visibleSentences.map((sentence, index) => (
                  <Text 
                    key={index} 
                    className="text-xl text-gray-800 leading-relaxed text-center mb-2" 
                    style={styleTemplates.withBoldFont}
                  >
                    {sentence}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* 중앙 스탬프 3개 영역 */}
        <View className="flex-1 items-center justify-center">
          {showStamp && (
            <View className="flex-row justify-center space-x-6">
              <Animated.View
                style={{
                  transform: [{ scale: stampScale }],
                }}
              >
                <View className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full p-12 shadow-2xl border-4 border-white">
                  <Text className="text-8xl text-white text-center" style={styleTemplates.withBoldFont}>
                    🏆
                  </Text>
                </View>
              </Animated.View>
              
              <Animated.View
                style={{
                  transform: [{ scale: stampScale }],
                }}
              >
                <View className="bg-gradient-to-br from-green-400 to-blue-500 rounded-full p-12 shadow-2xl border-4 border-white">
                  <Text className="text-8xl text-white text-center" style={styleTemplates.withBoldFont}>
                    ⭐
                  </Text>
                </View>
              </Animated.View>
              
              <Animated.View
                style={{
                  transform: [{ scale: stampScale }],
                }}
              >
                <View className="bg-gradient-to-br from-purple-400 to-pink-500 rounded-full p-12 shadow-2xl border-4 border-white">
                  <Text className="text-8xl text-white text-center" style={styleTemplates.withBoldFont}>
                    🎯
                  </Text>
                </View>
              </Animated.View>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
} 