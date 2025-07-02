import React, { useEffect, useState } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styleTemplates } from '../styles';

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
  const [hasCompleted, setHasCompleted] = useState(false);

  const childJosa = getKoreanJosa(childName);

  useEffect(() => {
    // 5초 후에 완료 콜백 호출 (인사말을 충분히 읽을 시간)
    const timer = setTimeout(() => {
      if (!hasCompleted) {
        setHasCompleted(true);
        onComplete?.();
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [hasCompleted, onComplete]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 px-6">
        {/* 중앙 인사말 영역 */}
        <View className="flex-1 items-center justify-center">
          <View className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-3xl p-10 shadow-2xl w-full max-w-lg border border-pink-100">
            <Text className="text-3xl text-gray-800 leading-relaxed text-center mb-8" style={styleTemplates.withBoldFont}>
            {childName}{childJosa}, 우리 다음에 또 만나서 재미있게 그림 일기 써보자. 안녕~
            </Text>
            
            <View className="items-center">
              <Text className="text-8xl text-center mb-6">
                👋
              </Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
} 