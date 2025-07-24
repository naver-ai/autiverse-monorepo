import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
// @ts-ignore
import format from 'string-format';
import { styleTemplates } from '../../../../styles';
import { useSpeech } from '../../utils';
import { getTTSOptionsFromAgentConfig } from '../../utils/speechUtils';
import { AgentImage } from '../AgentImage';

const { width, height } = Dimensions.get('window');

interface PraiseSectionProps {
  childName?: string; // 아이 이름
  agentConfig?: any; // agent 설정
  onComplete?: () => void;
}

export default function PraiseSection({ childName, agentConfig, onComplete }: PraiseSectionProps) {
  const { t } = useTranslation();
  const [showStamp, setShowStamp] = useState(false);
  const [stampScale] = useState(new Animated.Value(0));
  const [hasCompleted, setHasCompleted] = useState(false);
  const [hasSpoken, setHasSpoken] = useState(false);
  const [poppedStamps, setPoppedStamps] = useState<boolean[]>([false, false, false]);
  const {startSpeech, stopSpeech} = useSpeech()
  // 단계별 메시지 상태
  const [currentStage, setCurrentStage] = useState(0); // 0: 첫번째 메시지, 1: 두번째 메시지, 2: 스탬프 메시지
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
  
  // bounce 애니메이션 ref들
  const bounceAnimations = useRef<Animated.CompositeAnimation[]>([]);
  
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
  
  // 단계별 메시지들
  const actualChildName = childName || t('Journaling.Common.DefaultChildName');
  const firstMessage = format(t('Journaling.PraiseSection.FirstMessageTemplate'), { 
    child_name: actualChildName, 
    child_josa: getVocativeParticle(actualChildName) 
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
  
  // 첫 번째 메시지 시작
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowFirstMessage(true);
      startSpeech(firstMessage, {
          ...getTTSOptionsFromAgentConfig(agentConfig),
          onDone: () => {
          // 첫 번째 메시지 TTS 완료 후 1초 뒤에 사라지고 두 번째 메시지 시작
          setTimeout(() => {
            setShowFirstMessage(false);
            setShowSecondMessage(true);
            setShowStamp(true); // 스탬프도 함께 등장 (비활성화 상태)
            
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
            
            // 두 번째 메시지 TTS 시작
            startSpeech(secondMessage, {
              ...getTTSOptionsFromAgentConfig(agentConfig),
              onDone: () => {
                // 두 번째 메시지 TTS 완료 후 1초 뒤에 사라지고 스탬프 메시지 시작
                setTimeout(() => {
                  setShowSecondMessage(false);
                  setShowStampMessage(true);
                  
                  // 스탬프 메시지 TTS 시작
                  startSpeech(stampMessage, {
                    ...getTTSOptionsFromAgentConfig(agentConfig),
                    onDone: () => {
                      // 스탬프 메시지 TTS 완료 후 스탬프 활성화
                      setTimeout(() => {
                        setStampsActive(true);
                      }, 500);
                    },
                    onError: (error) => {
                      // 에러 시에도 스탬프 활성화
                      setTimeout(() => {
                        setStampsActive(true);
                      }, 500);
                    }
                  });
                }, 500);
              },
              onError: (error) => {
                // 에러 시에도 다음 단계로 진행
                setTimeout(() => {
                  setShowSecondMessage(false);
                  setShowStampMessage(true);
                  setStampsActive(true);
                }, 500);
              }
            });
          }, 500);
        },
        onError: (error) => {
          // 에러 시에도 다음 단계로 진행
          setTimeout(() => {
            setShowFirstMessage(false);
            setShowSecondMessage(true);
            setShowStamp(true);
            setStampsActive(true);
          }, 500);
        }
      });
    }, 500); // 1초 후 첫 번째 메시지 시작

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

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 px-6">
        {/* 상단 Agent + 문구 영역 */}
        <View className="pt-8 pb-4">
          <View className="bg-white rounded-3xl p-6 shadow-lg w-full">
            <View className="flex-row items-center">
                              <AgentImage
                  avatarImage={agentConfig?.avatar_image || ''}
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    resizeMode: 'cover',
                    marginRight: 12
                  }}
                />
              <View className="flex-1">
                {showFirstMessage && (
                  <Text 
                    className="text-2xl text-gray-800 leading-relaxed text-center mb-2" 
                    style={styleTemplates.withBoldFont}
                  >
                    {firstMessage}
                  </Text>
                )}
                {showSecondMessage && (
                  <Text 
                    className="text-2xl text-gray-800 leading-relaxed text-center mb-2" 
                    style={styleTemplates.withBoldFont}
                  >
                    {secondMessage}
                  </Text>
                )}
                {showStampMessage && (
                  <Text 
                    className="text-2xl text-gray-800 leading-relaxed text-center mb-2" 
                    style={styleTemplates.withBoldFont}
                  >
                    {stampMessage}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* 중앙 스탬프 3개 영역 */}
        <View className="flex-1 items-center justify-center bg-transparent">
          {showStamp && (
            <View className="flex-row justify-center space-x-24 bg-transparent">
              <Animated.View
                className="bg-transparent"
                style={{
                  transform: [
                    { scale: stampScale },
                    { scale: stampAnimations[0] }
                  ],
                }}
              >
                <TouchableOpacity
                  onPress={() => popStamp(0)}
                  disabled={poppedStamps[0] || !stampsActive}
                  activeOpacity={stampsActive ? 0.8 : 1}
                  className="bg-transparent"
                >
                  <Animated.View 
                    className="bg-slate-50 border-3 border-white/40 rounded-full p-16"
                    style={{
                      opacity: bubbleAnimations[0],
                      transform: [{ scale: bubbleAnimations[0] }],
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.15,
                      shadowRadius: 16,
                      elevation: 10,
                    }}
                  >
                    <Animated.View
                      className="bg-transparent"
                      style={{
                        transform: [{ scale: contentAnimations[0] }],
                      }}
                    >
                      <Text 
                        className="text-9xl text-center" 
                        style={[
                          styleTemplates.withBoldFont,
                          {
                            textAlign: 'center',
                            includeFontPadding: false,
                            textAlignVertical: 'center',
                          }
                        ]}
                        allowFontScaling={false}
                      >
                        🏆
                      </Text>
                    </Animated.View>
                  </Animated.View>
                </TouchableOpacity>
              </Animated.View>
              
              <Animated.View
                className="bg-transparent"
                style={{
                  transform: [
                    { scale: stampScale },
                    { scale: stampAnimations[1] }
                  ],
                }}
              >
                <TouchableOpacity
                  onPress={() => popStamp(1)}
                  disabled={poppedStamps[1] || !stampsActive}
                  activeOpacity={stampsActive ? 0.8 : 1}
                  className="bg-transparent"
                >
                  <Animated.View 
                    className="bg-slate-50 border-3 border-white/40 rounded-full p-16"
                    style={{
                      opacity: bubbleAnimations[1],
                      transform: [{ scale: bubbleAnimations[1] }],
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.15,
                      shadowRadius: 16,
                      elevation: 10,
                    }}
                  >
                    <Animated.View
                      className="bg-transparent"
                      style={{
                        transform: [{ scale: contentAnimations[1] }],
                      }}
                    >
                      <Text 
                        className="text-9xl text-center" 
                        style={[
                          styleTemplates.withBoldFont,
                          {
                            textAlign: 'center',
                            includeFontPadding: false,
                            textAlignVertical: 'center',
                          }
                        ]}
                        allowFontScaling={false}
                      >
                        ⭐
                      </Text>
                    </Animated.View>
                  </Animated.View>
                </TouchableOpacity>
              </Animated.View>
              
              <Animated.View
                className="bg-transparent"
                style={{
                  transform: [
                    { scale: stampScale },
                    { scale: stampAnimations[2] }
                  ],
                }}
              >
                <TouchableOpacity
                  onPress={() => popStamp(2)}
                  disabled={poppedStamps[2] || !stampsActive}
                  activeOpacity={stampsActive ? 0.8 : 1}
                  className="bg-transparent"
                >
                  <Animated.View 
                    className="bg-slate-50 border-3 border-white/40 rounded-full p-16"
                    style={{
                      opacity: bubbleAnimations[2],
                      transform: [{ scale: bubbleAnimations[2] }],
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.15,
                      shadowRadius: 16,
                      elevation: 10,
                    }}
                  >
                    <Animated.View
                      className="bg-transparent"
                      style={{
                        transform: [{ scale: contentAnimations[2] }],
                      }}
                    >
                      <Text 
                        className="text-9xl text-center" 
                        style={[
                          styleTemplates.withBoldFont,
                          {
                            textAlign: 'center',
                            includeFontPadding: false,
                            textAlignVertical: 'center',
                          }
                        ]}
                        allowFontScaling={false}
                      >
                        🏅
                      </Text>
                    </Animated.View>
                  </Animated.View>
                </TouchableOpacity>
              </Animated.View>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
} 