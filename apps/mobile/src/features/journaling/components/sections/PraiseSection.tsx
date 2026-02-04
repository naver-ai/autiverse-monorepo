import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Animated } from 'react-native';
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
import { useSpeechAnimation } from '../../hooks/useSpeechAnimation';
import Reanimated, { FadeIn, Easing } from 'react-native-reanimated';
import { AnimatedText } from '../../../../components/AnimatedText';
import { twMerge } from 'tailwind-merge';
import { Image } from 'expo-image';
import { Pressable } from 'react-native-gesture-handler';
import { ComicView } from '../ComicView';

// --- Phase: single source of truth for UI and flow ---
type PraisePhase =
  | 'waiting'       // 2초 대기 중
  | 'first'        // 첫 메시지 표시 + TTS
  | 'second'       // 둘째 메시지 표시 + TTS
  | 'stamp_message' // 스탬프 등장 + 스탬프 안내 TTS
  | 'stamps_ready'; // 스탬프 터치 가능

// --- Stamp view (presentational) ---
interface StampViewProps {
  children: React.ReactNode;
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
  onPress,
}) => (
  <Animated.View
    className="bg-transparent"
    style={{
      transform: [
        { scale: stampScale },
        { scale: stampAnimation },
      ],
    }}
  >
    <Pressable
      onPress={() => onPress(index)}
      disabled={isPopped || !isActive}
      className="bg-transparent"
    >
      <Animated.View
        className={twMerge(
          'w-64 h-64 bg-white border-3 border-white/40 rounded-full flex-row items-center justify-center',
          isActive && 'border-2 border-autiverse-yellow'
        )}
        style={{
          transform: [{ scale: bubbleAnimation }],
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.15,
          shadowRadius: 16,
          elevation: 10,
        }}
      >
        {children}
      </Animated.View>
    </Pressable>
  </Animated.View>
);

// --- Stamp assets config ---
const STAMP_IMAGES = [
  { source: require('../../../../../assets/stamp-trophy.png'), width: 180, height: 180 },
  { source: require('../../../../../assets/stamp-star.png'), width: 150, height: 150 },
  { source: require('../../../../../assets/stamp-medal.png'), width: 150, height: 150 },
];

// --- Constants ---
const DELAY_BEFORE_FIRST_MS = 2000;
const DELAY_BETWEEN_MESSAGES_MS = 500;
const SAFETY_TIMEOUT_MS = 45000;
const DELAY_AFTER_ALL_POPPED_MS = 500;

interface PraiseSectionProps {
  childName?: string;
  sessionId?: string;
  onComplete?: () => void;
}

export default function PraiseSection({ childName, sessionId, onComplete }: PraiseSectionProps) {
  const { t } = useTranslation();
  const { dyad, locale, agentConfig } = useDyad();
  const { startSpeech, stopSpeech } = useSpeech();

  const childNameWithJosa = useMemo(() => {
    if (locale === UserLocale.Korean && dyad?.child_name) {
      return appendJosa(dyad.child_name, '이', '');
    }
    return dyad?.child_name ?? t('Journaling.Common.DefaultChildName');
  }, [dyad?.child_name, locale, t]);

  const firstMessage = format(t('Journaling.PraiseSection.FirstMessageTemplate'), {
    child_name: childNameWithJosa,
  });
  const secondMessage = t('Journaling.PraiseSection.SecondMessage');
  const stampMessage = t('Journaling.PraiseSection.StampMessage');
  const ttsOptions = useMemo(
    () => getTTSOptionsFromAgentConfig(agentConfig),
    [agentConfig]
  );

  // Single phase state (replaces showFirstMessage, showSecondMessage, showStampMessage, showStamp, stampsActive)
  const [phase, setPhase] = useState<PraisePhase>('waiting');
  const [poppedStamps, setPoppedStamps] = useState<boolean[]>([false, false, false]);

  const isSpeaking = phase !== 'waiting' && phase !== 'stamps_ready';
  const { ttsScalePulseStyle, ttsBorderColorStyle } = useSpeechAnimation(isSpeaking);

  // Refs to avoid stale closures in TTS callbacks and safety timer
  const phaseRef = useRef(phase);
  const hasCalledCompleteRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  phaseRef.current = phase;

  // Animation values (stable)
  const [stampScale] = useState(() => new Animated.Value(0));
  const [stampAnimations] = useState(() => [
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]);
  const [bubbleAnimations] = useState(() => [
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]);
  const [contentAnimations] = useState(() => [
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]);
  const bounceAnimationsRef = useRef<Animated.CompositeAnimation[]>([]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  const startBounce = useCallback(
    (index: number) => {
      const anim = Animated.loop(
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
          }),
        ])
      );
      bounceAnimationsRef.current[index] = anim;
      anim.start();
    },
    [stampAnimations]
  );

  const playNextAfter = useCallback(
    (ms: number, next: () => void) => {
      schedule(next, ms);
    },
    [schedule]
  );

  const popStamp = useCallback(
    (index: number) => {
      if (poppedStamps[index] || phase !== 'stamps_ready') return;

      if (bounceAnimationsRef.current[index]) {
        bounceAnimationsRef.current[index].stop();
      }

      Animated.parallel([
        Animated.timing(bubbleAnimations[index], {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(contentAnimations[index], { toValue: 1.4, duration: 300, useNativeDriver: true }),
          Animated.timing(contentAnimations[index], { toValue: 1.2, duration: 200, useNativeDriver: true }),
          Animated.timing(contentAnimations[index], { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
      ]).start();

      const next = [...poppedStamps];
      next[index] = true;
      setPoppedStamps(next);

      if (next.every(Boolean) && !hasCalledCompleteRef.current) {
        hasCalledCompleteRef.current = true;
        schedule(() => onComplete?.(), DELAY_AFTER_ALL_POPPED_MS);
      }
    },
    [poppedStamps, phase, bubbleAnimations, contentAnimations, onComplete, schedule]
  );

  // Main flow: start after DELAY_BEFORE_FIRST_MS, then chain TTS by phase
  useEffect(() => {
    const runFirst = () => {
      setPhase('first');
      startSpeech(firstMessage, {
        ...ttsOptions,
        onDone: () => {
          playNextAfter(DELAY_BETWEEN_MESSAGES_MS, () => {
            setPhase('second');
            startSpeech(secondMessage, {
              ...ttsOptions,
              onDone: () => {
                playNextAfter(DELAY_BETWEEN_MESSAGES_MS, () => {
                  setPhase('stamp_message');
                  Animated.spring(stampScale, {
                    toValue: 1,
                    useNativeDriver: true,
                    tension: 100,
                    friction: 8,
                  }).start(() => {
                    startBounce(0);
                    startBounce(1);
                    startBounce(2);
                  });
                  startSpeech(stampMessage, {
                    ...ttsOptions,
                    onDone: () => setPhase('stamps_ready'),
                  });
                });
              },
            });
          });
        },
      });
    };

    schedule(runFirst, DELAY_BEFORE_FIRST_MS);
    schedule(() => {
      if (phaseRef.current !== 'stamps_ready') {
        setPhase('stamps_ready');
      }
    }, SAFETY_TIMEOUT_MS);

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      stopSpeech();
      bounceAnimationsRef.current.forEach((a) => a?.stop());
    };
  }, []); // Intentionally run once on mount; messages/ttsOptions are from closure (initial render). For latest messages on slow load, consider refs.

  // Show comic until we reach stamp phase
  const showComic = !(phase === 'stamp_message' || phase === 'stamps_ready');
  const showStamp = phase === 'stamp_message' || phase === 'stamps_ready';
  const stampsActive = phase === 'stamps_ready';

  const currentMessage =
    phase === 'first'
      ? firstMessage
      : phase === 'second'
        ? secondMessage
        : phase === 'stamp_message' || phase === 'stamps_ready'
          ? stampMessage
          : null;

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 px-6">
        <View className="pt-8 pb-4">
          <Reanimated.View
            entering={FadeIn.easing(Easing.ease)}
            style={ttsBorderColorStyle}
            className="bg-white rounded-3xl p-6 shadow-lg w-full border-2 border-gray-200"
          >
            <View className="flex-row items-center">
              <Reanimated.View style={ttsScalePulseStyle}>
                <AgentImage
                  avatarImage={agentConfig?.avatar_image ?? ''}
                  style={{ width: 50, height: 50, borderRadius: 25, marginRight: 12 }}
                />
              </Reanimated.View>
              <View className="flex-1">
                {currentMessage && (
                  <AnimatedText
                    className="mb-2 justify-center"
                    textClassName="text-2xl text-gray-800"
                    textStyle={styleTemplates.withBoldFont}
                    text={currentMessage}
                    initialDelay={0}
                    charInterval={100}
                  />
                )}
              </View>
            </View>
          </Reanimated.View>
        </View>

        <View className="flex-1 items-center justify-center bg-transparent">
          {showComic && sessionId ? (
            <ComicView
              className="w-full h-full"
              sessionId={sessionId}
              comicGenerationStatus={{ status: 'completed', progress: 100, message: '' }}
              progressAnimation={new Animated.Value(1)}
            />
          ) : showStamp ? (
            <View className="flex-row justify-center space-x-24 bg-transparent">
              {STAMP_IMAGES.map((img, index) => (
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
                  <Image source={img.source} style={{ width: img.width, height: img.height }} />
                </StampView>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
