import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Dimensions, Animated, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styleTemplates } from '../../styles';
import { speakText, stopSpeech } from '../../features/tablet-comic-chatbot/utils/speechUtils';

const { width, height } = Dimensions.get('window');

interface PraiseSectionProps {
  childName?: string; // 아이 이름
  agentConfig?: any; // agent 설정
  onComplete?: () => void;
}



export default function PraiseSection({ childName = "친구", agentConfig, onComplete }: PraiseSectionProps) {
  const [showStamp, setShowStamp] = useState(false);
  const [stampScale] = useState(new Animated.Value(0));
  const [hasCompleted, setHasCompleted] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [visibleSentences, setVisibleSentences] = useState<string[]>([]);
  const [hasSpoken, setHasSpoken] = useState(false);
  
  // 한국어 종성에 따른 호격 조사 처리 함수
  const getVocativeParticle = (name: string): string => {
    if (!name || name.length === 0) return '';
    
    const lastChar = name.charAt(name.length - 1);
    const code = lastChar.charCodeAt(0);
    
    // 한글 범위 체크 (가-힣: 44032-55203)
    if (code < 44032 || code > 55203) return '';
    
    // 종성 계산: (유니코드 - 44032) % 28
    const unicode = code - 44032;
    const jong = unicode % 28;
    
    // 종성이 있으면 '이', 없으면 '야'
    return jong !== 0 ? '이' : '';
  };
  
  // 종성에 따른 조사를 적용한 칭찬 메시지
  const praiseMessage = `우리 ${childName}${getVocativeParticle(childName)} 오늘 그림 일기 쓰는 모습 만점!! 오늘 있었던 일 잘 떠올리고, 질문에 답변 잘해주고, 내가 그림 그리는 거 기다려줘서 고마워~`;
  
  // 메시지를 문장 단위로 분리
  const sentences = praiseMessage.split('.').filter((s: string) => s.trim().length > 0).map((s: string) => s.trim() + '.');
  
  // 이미지 매핑 함수
  const getImageSource = (imageName: string) => {
    switch (imageName) {
      case 'robot':
        return require('../../../assets/robot.png');
      case 'doll':
        return require('../../../assets/doll.png');
      default:
        return require('../../../assets/icon.png');
    }
  };

  // TTS 시작
  useEffect(() => {
    if (!hasSpoken) {
      speakText(praiseMessage, {
        language: 'ko-KR',
        pitch: 1.0,
        rate: 0.8,
        onDone: () => {
          setHasSpoken(true);
        },
        onError: (error) => {
          setHasSpoken(true);
        }
      });
    }
  }, [hasSpoken, praiseMessage]);

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
    // TTS 완료 후 스탬프 애니메이션 완료까지 기다린 후 완료 콜백 호출
    if (showStamp && hasSpoken) {
      const timer = setTimeout(() => {
        if (!hasCompleted) {
          setHasCompleted(true);
          onComplete?.();
        }
      }, 500); // 0.5초로 단축

      return () => clearTimeout(timer);
    }
  }, [showStamp, hasSpoken, hasCompleted, onComplete]);

  // 컴포넌트 언마운트 시 TTS 정지
  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

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
                    : require('../../../assets/robot.png')
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