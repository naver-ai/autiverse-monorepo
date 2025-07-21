import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
// @ts-ignore
import format from 'string-format';
import { styleTemplates } from '../../../../styles';
import { useSpeech } from '../../utils';

const { width, height } = Dimensions.get('window');

interface FarewellSectionProps {
  childName: string;
  onComplete?: () => void;
}

// 한글 조사 처리 함수 (종성에 따라 '아'/'야' 선택)
const getKoreanJosa = (name: string): string => {
  if (!name) return '야';
  
  const lastName = name.charAt(name.length - 1);
  const lastNameCode = lastName.charCodeAt(0);
  
  // 한글 유니코드 범위: 44032 ~ 55203
  if (lastNameCode >= 44032 && lastNameCode <= 55203) {
    // 한글 유니코드에서 종성 계산: (유니코드 - 44032) % 28
    const jongseong = (lastNameCode - 44032) % 28;
    // 종성이 있으면 (0이 아니면) '아', 없으면 (0이면) '야'
    return jongseong === 0 ? '야' : '아';
  }
  
  // 한글이 아닌 경우 기본값
  return '야';
};

export default function FarewellSection({ childName, onComplete }: FarewellSectionProps) {
  const { t } = useTranslation();
  const [hasCompleted, setHasCompleted] = useState(false);
  const [hasSpoken, setHasSpoken] = useState(false);
  const {startSpeech, stopSpeech} = useSpeech()

  const childJosa = getKoreanJosa(childName);
  const farewellMessage = useMemo(() => {
    return format(t('Journaling.FarewellSection.MessageTemplate'), { 
      child_name: childName, 
      child_josa: childJosa 
    });
  }, [t, childName, childJosa]);

  const memoizedOnComplete = useMemo(() => onComplete, [onComplete]);

  // TTS 시작
  useEffect(() => {
    if (!hasSpoken) {
      startSpeech(farewellMessage, {
        ...getTTSOptionsFromAgentConfig(agentConfig),
        onDone: () => {
          setHasSpoken(true);
          // TTS 완료 후 0.5초 뒤에 완료 콜백 호출
          setTimeout(() => {
            if (!hasCompleted) {
              setHasCompleted(true);
              memoizedOnComplete?.();
            }
          }, 500);
        },
        onError: (error) => {
          setHasSpoken(true);
          // 에러 발생 시에도 5초 후 완료
          setTimeout(() => {
            if (!hasCompleted) {
              setHasCompleted(true);
              memoizedOnComplete?.();
            }
          }, 5000);
        }
      });
    } else if (!hasSpoken && !agentConfig) {
      console.log('FarewellSection: Waiting for agentConfig to be available');
    } else {
      console.log('FarewellSection: TTS already spoken, skipping');
    }
  }, [hasSpoken, hasCompleted, memoizedOnComplete, farewellMessage, agentConfig]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 px-6">
        {/* 중앙 인사말 영역 */}
        <View className="flex-1 items-center justify-center">
          <View className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-3xl p-10 w-full max-w-lg border border-pink-100">
            <Text className="text-3xl text-gray-800 leading-relaxed text-center mb-8" style={styleTemplates.withBoldFont}>
            {farewellMessage}
            </Text>
            
            <View className="items-center">
              <Text className="text-8xl text-center mb-6" style={styleTemplates.withBoldFont}>
                👋
              </Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
} 