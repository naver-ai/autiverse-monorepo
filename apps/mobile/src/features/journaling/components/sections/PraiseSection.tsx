import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
// @ts-ignore
import format from 'string-format';
import { styleTemplates } from '../../../../styles';
import { useSpeech } from '../../utils';
import { getTTSOptionsFromAgentConfig } from '../../utils/speechUtils';
import { AgentImage } from '../AgentImage';
import { useDyad } from '../../../../api/dyad';
import { UserLocale, appendJosa } from '@autiverse-monorepo/ts-core';
import { useSpeechAnimation } from '../../hooks/useSpeechAnimation'
import Reanimated, { FadeIn, Easing } from 'react-native-reanimated';
import { AnimatedText } from '../../../../components/AnimatedText';
import { twMerge } from 'tailwind-merge';
import { Image } from 'expo-image';
import { Pressable } from 'react-native-gesture-handler';
import { ComicView } from '../ComicView';
import { useSession } from '../../hooks/useSession';

interface StampViewProps {
  children?: React.ReactNode;
  index: number;
  isPopped: boolean;
  isActive: boolean;
  stampScale: Animated.Value;
  stampAnimation: Animated.Value;
  bubbleAnimation: Animated.Value;
  contentAnimation: Animated.Value;
  onPress: (index: number) => void;
}

const StampView: React.FC<StampViewProps> = ({
  children,
  index,
  isPopped,
  isActive,
  stampScale,
  stampAnimation,
  bubbleAnimation,
  contentAnimation,
  onPress
}) => {
  
  return (
    <Animated.View
      className={twMerge("bg-transparent")}  
      style={{
        transform: [
          { scale: stampScale },
          { scale: stampAnimation }
        ],
      }}
    >
      <Pressable
        onPress={() => onPress(index)}
        disabled={isPopped || !isActive}
        className="bg-transparent"
      >
        <Animated.View 
          className={twMerge("w-64 h-64 bg-white border-3 border-white/40 rounded-full flex-row items-center justify-center", isActive && "border-2 border-autiverse-yellow")}
          style={{
            transform: [{ scale: bubbleAnimation }],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.15,
            shadowRadius: 16,
            elevation: 10,
          }}
        >{children}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

interface PraiseSectionProps {
  childName?: string; // 아이 이름
  sessionId?: string; // 세션 ID
  onComplete?: () => void;
}

export default function PraiseSection({ childName, sessionId, onComplete }: PraiseSectionProps) {
  const { t } = useTranslation();
  const [showStamp, setShowStamp] = useState(false);
  const [stampScale] = useState(new Animated.Value(0));
  const [hasCompleted, setHasCompleted] = useState(false);
  const [poppedStamps, setPoppedStamps] = useState<boolean[]>([false, false, false]);
  const {startSpeech, stopSpeech} = useSpeech()
  // 단계별 메시지 상태
  const [showFirstMessage, setShowFirstMessage] = useState(false);
  const [showSecondMessage, setShowSecondMessage] = useState(false);
  const [showStampMessage, setShowStampMessage] = useState(false);
  const [stampsActive, setStampsActive] = useState(false);
  
  // 각 스탬프의 애니메이션 값들
  const [stampAnimations] = useState([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1)
  ]);
  
  // 각 스탬프의 bubble 애니메이션 값들 (터트릴 때 사라짐)
  const [bubbleAnimations] = useState([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1)
  ]);
  
  // 각 스탬프의 콘텐츠 애니메이션 값들 (터트린 후 움직임)
  const [contentAnimations] = useState([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1)
  ]);
 
  const {dyad, locale, agentConfig} = useDyad();

  const childNameWithJosa = useMemo(() => {
    if(locale === UserLocale.Korean && dyad?.child_name) {
      return appendJosa(dyad?.child_name, '이', '');
    }
    return dyad?.child_name || t('Journaling.Common.DefaultChildName')
  }, [dyad?.child_name, locale, t]);

  // 디버깅용 로그
  useEffect(() => {
    console.log('PraiseSection - sessionId:', sessionId);
    console.log('PraiseSection - showStamp:', showStamp);
  }, [sessionId, showStamp]);

  // bounce 애니메이션 ref들
  const bounceAnimations = useRef<Animated.CompositeAnimation[]>([]);

  const firstMessage = format(t('Journaling.PraiseSection.FirstMessageTemplate'), { 
    child_name: childNameWithJosa, 
  });
  const secondMessage = t('Journaling.PraiseSection.SecondMessage');
  const stampMessage = t('Journaling.PraiseSection.StampMessage');
  
  // 지속적인 bounce 애니메이션 시작
  const startBounceAnimation = (index: number) => {
    const bounceAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(stampAnimations[index], {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(stampAnimations[index], {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ])
    );
    
    bounceAnimations.current[index] = bounceAnimation;
    bounceAnimation.start();
  };
  
  // 스탬프 터트리기 함수
  const popStamp = (index: number) => {
    if (poppedStamps[index] || !stampsActive) return; // 이미 터트린 스탬프이거나 비활성화 상태면 무시
    
    // bounce 애니메이션 정지
    if (bounceAnimations.current[index]) {
      bounceAnimations.current[index].stop();
    }
    
    // 터트리는 애니메이션 시퀀스
    Animated.parallel([
      // bubble 사라지는 애니메이션
      Animated.timing(bubbleAnimations[index], {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      // 콘텐츠가 튀어나오는 애니메이션
      Animated.sequence([
        Animated.timing(contentAnimations[index], {
          toValue: 1.4,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(contentAnimations[index], {
          toValue: 1.2,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(contentAnimations[index], {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ])
    ]).start();
    
    // 터트린 상태로 설정
    const newPoppedStamps = [...poppedStamps];
    newPoppedStamps[index] = true;
    setPoppedStamps(newPoppedStamps);
    
    // 모든 스탬프가 터트렸는지 확인
    if (newPoppedStamps.every(popped => popped)) {
      setTimeout(() => {
        if (!hasCompleted) {
          setHasCompleted(true);
          onComplete?.();
        }
      }, 500); // 0.5초 후 farewell section으로 이동
    }
  };

  const [isSpeaking, setIsSpeaking] = useState(false);

  const {ttsScalePulseStyle, ttsBorderColorStyle} = useSpeechAnimation(isSpeaking);
  
  // 첫 번째 메시지 시작
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowFirstMessage(true);
      setIsSpeaking(true);
      startSpeech(firstMessage, {
          ...getTTSOptionsFromAgentConfig(agentConfig),
          onDone: () => {
          // 첫 번째 메시지 TTS 완료 후 0.3초 뒤에 사라지고 두 번째 메시지 시작
          setTimeout(() => {
            setShowFirstMessage(false);
            setShowSecondMessage(true);
            
            // 두 번째 메시지 TTS 시작
            startSpeech(secondMessage, {
              ...getTTSOptionsFromAgentConfig(agentConfig),
              onDone: () => {
                // 두 번째 메시지 TTS 완료 후 0.3초 뒤에 사라지고 스탬프 메시지 시작
                setTimeout(() => {
                  setShowSecondMessage(false);
                  setShowStampMessage(true);
                  
                  // 스탬프 메시지 TTS 시작과 동시에 스탬프 등장
                  setShowStamp(true);
                  
                  // 스탬프 애니메이션 시작
                  Animated.spring(stampScale, {
                    toValue: 1,
                    useNativeDriver: true,
                    tension: 100,
                    friction: 8,
                  }).start(() => {
                    // 스탬프가 나타난 후 bounce 애니메이션 시작 (비활성화 상태)
                    startBounceAnimation(0);
                    startBounceAnimation(1);
                    startBounceAnimation(2);
                  });
                  
                  startSpeech(stampMessage, {
                    ...getTTSOptionsFromAgentConfig(agentConfig),
                    onDone: () => {
                      // 스탬프 메시지 TTS 완료 후 활성화
                      setStampsActive(true);
                      setIsSpeaking(false);
                    }
                  });
                }, 500);
              }
            });
          }, 500);
        }
      });

      // 안전장치: 12초 후에도 완료되지 않으면 강제로 스탬프 활성화
      const safetyTimer = setTimeout(() => {
        if (!stampsActive) {
          console.log('PraiseSection: TTS 타임아웃, 강제로 스탬프 활성화');
          setShowFirstMessage(false);
          setShowSecondMessage(false);
          setShowStampMessage(true);
          setShowStamp(true);
          setStampsActive(true);
          setIsSpeaking(false);
        }
      }, 12000); // 12초로 변경

      return () => {
        clearTimeout(safetyTimer);
      };
    }, 2000); // 2초 후 첫 번째 메시지 시작

    return () => clearTimeout(timer);
  }, []);

  // 컴포넌트 언마운트 시 TTS 정지 및 애니메이션 정리
  useEffect(() => {
    return () => {
      stopSpeech();
      // 모든 bounce 애니메이션 정지
      bounceAnimations.current.forEach(animation => {
        if (animation) {
          animation.stop();
        }
      });
    };
  }, []);

  const stampEmojis = [
    <Image
    source={require('../../../../../assets/stamp-trophy.png')}
    style={{
      width: 180,
      height: 180,
    }}
  />,
  <Image
                    source={require('../../../../../assets/stamp-star.png')}
                    style={{
                      width: 150,
                      height: 150,
                    }}
                  />,
  <Image
    source={require('../../../../../assets/stamp-medal.png')}
    style={{
      width: 150,
      height: 150,
    }}
  />];

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 px-6">
        {/* 상단 Agent + 문구 영역 */}
        <View className="pt-8 pb-4">
          <Reanimated.View entering={FadeIn.easing(Easing.ease)} 
              style={ttsBorderColorStyle} className="bg-white rounded-3xl p-6 shadow-lg w-full border-2 border-gray-200">
            <View className="flex-row items-center">
              <Reanimated.View style={ttsScalePulseStyle}>
                <AgentImage
                  avatarImage={agentConfig?.avatar_image || ''}
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    marginRight: 12
                  }}
                />
              </Reanimated.View>
              <View className="flex-1">
                {showFirstMessage && (
                  <AnimatedText 
                    className="mb-2 justify-center"
                    textClassName="text-2xl text-gray-800" 
                    textStyle={styleTemplates.withBoldFont}
                    text={firstMessage}
                    initialDelay={0}
                    charInterval={100}
                  />
                )}
                {showSecondMessage && (
                  <AnimatedText 
                    className="mb-2 justify-center"
                    textClassName="text-2xl text-gray-800" 
                    textStyle={styleTemplates.withBoldFont}
                    text={secondMessage}
                    initialDelay={0}
                    charInterval={100}
                  />    
                )}
                {showStampMessage && (
                  <AnimatedText 
                    className="mb-2 justify-center"
                    textClassName="text-2xl text-gray-800" 
                    textStyle={styleTemplates.withBoldFont}
                    text={stampMessage}
                    initialDelay={0}
                    charInterval={100}
                  />
                )}
              </View>
            </View>
          </Reanimated.View>
        </View>

        {/* 중앙 영역 - 스탬프가 나오기 전에는 일기 내용, 나온 후에는 스탬프 */}
        <View className="flex-1 items-center justify-center bg-transparent">
          {!showStamp && sessionId ? (
            // 스탬프가 나오기 전: 완성된 일기 내용 표시
            <ComicView 
              className="w-full h-full" 
              sessionId={sessionId}
              comicGenerationStatus={{ 
                status: 'completed',
                progress: 100,
                message: ''
              }}
              progressAnimation={new Animated.Value(1)}
            />
          ) : showStamp ? (
            // 스탬프가 나온 후: 스탬프 3개 표시
            <View className="flex-row justify-center space-x-24 bg-transparent">
              {stampEmojis.map((emoji, index) => (
                <StampView
                  key={index}
                  index={index}
                  isPopped={poppedStamps[index]}
                  isActive={stampsActive}
                  stampScale={stampScale}
                  stampAnimation={stampAnimations[index]}
                  bubbleAnimation={bubbleAnimations[index]}
                  contentAnimation={contentAnimations[index]}
                  onPress={popStamp}
                >
                  {emoji}
                </StampView>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
} 