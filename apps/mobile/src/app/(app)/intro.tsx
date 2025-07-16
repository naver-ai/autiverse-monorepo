import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styleTemplates } from '../../styles';
import { LogoImage } from '../../components/svg-images';
import { stopSpeech } from '../../features/tablet-comic-chatbot/utils/speechUtils';

const { width, height } = Dimensions.get('window');

export default function IntroScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // intro 화면 로드 시 TTS 정리
    console.log('IntroScreen: Stopping any ongoing speech');
    stopSpeech();
    
    // 로고와 텍스트 페이드인 애니메이션
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleStart = () => {
    // 버튼 클릭 애니메이션
    Animated.sequence([
      Animated.timing(buttonScaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      router.push('/(app)/agent-intro');
    });
  };

  const handleGallery = () => {
    router.push('/(app)/gallery');
  };

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-b from-blue-50 to-indigo-100">
      {/* 갤러리 아이콘 */}
      <View className="absolute top-12 right-4 z-10">
        <TouchableOpacity
          onPress={handleGallery}
          className="bg-white rounded-full p-4 shadow-lg"
          activeOpacity={0.8}
        >
          <Text className="text-3xl">🖼️</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        {/* 로고 영역 */}
        <Animated.View 
          className="flex-1 items-center justify-center"
          style={{
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }}
        >
          <View style={{ marginTop: 60 }}>
            <LogoImage 
              width={width * 0.6} 
              height={width * 0.18} 
              style={{
                marginBottom: 40,
              }}
            />
          </View>
        </Animated.View>

        {/* 시작하기 버튼 영역 */}
        <View className="w-full pb-20 items-center">
          <Animated.View
            style={{
              transform: [{ scale: buttonScaleAnim }],
            }}
          >
            <TouchableOpacity
              onPress={handleStart}
              className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl py-5 px-12"
              activeOpacity={0.9}
            >
              <Text
                className="text-3xl text-gray-800 text-center font-bold"
                style={styleTemplates.withBoldFont}
              >
                시작하기
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
} 