import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Animated } from 'react-native';

interface ProgressLoadingOverlayProps {
  visible: boolean;
  message?: string;
  progress?: number; // 0-100 사이의 값
}

export const ProgressLoadingOverlay: React.FC<ProgressLoadingOverlayProps> = ({ 
  visible, 
  message = "4컷 만화를 열심히 그리고 있다아~~",
  progress = 0
}) => {
  const [animatedProgress] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.timing(animatedProgress, {
        toValue: progress,
        duration: 500,
        useNativeDriver: false,
      }).start();
    }
  }, [progress, visible]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
    >
      <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
        <View className="bg-white p-6 rounded-xl shadow-lg max-w-sm w-4/5">
          {/* 로딩 애니메이션 */}
          <View className="flex-row justify-center mb-4">
            <View className="flex-row space-x-1">
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  className="w-3 h-3 bg-blue-500 rounded-full"
                  style={{
                    opacity: 0.3,
                    transform: [{ scale: 0.8 }],
                  }}
                />
              ))}
            </View>
          </View>

          {/* 메시지 */}
          <Text className="text-center mb-4 text-lg font-semibold text-gray-800">
            {message}
          </Text>

          {/* 프로그레스 바 */}
          <View className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <Animated.View
              className="bg-blue-500 h-2 rounded-full"
              style={{
                width: animatedProgress.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
              }}
            />
          </View>

          {/* 프로그레스 퍼센트 */}
          <Text className="text-center text-sm text-gray-600">
            {Math.round(progress)}% 완료
          </Text>

          {/* 추가 설명 */}
        </View>
      </View>
    </Modal>
  );
}; 