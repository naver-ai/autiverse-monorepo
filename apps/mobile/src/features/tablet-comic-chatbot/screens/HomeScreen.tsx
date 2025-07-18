import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Animated,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styleTemplates } from '../../../styles';
import { LogoImage } from '../../../components/svg-images';
import { stopSpeech } from '../utils/speechUtils';
import { useDyad } from '../../../api/dyad';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { dyad } = useDyad();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const [showContinueModal, setShowContinueModal] = useState(false);
  const [latestEntry, setLatestEntry] = useState<any>(null);
  const [isButtonPressed, setIsButtonPressed] = useState(false);

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

  // 직전 Entry 확인
  useEffect(() => {
    if (dyad && dyad.journal_entries && dyad.journal_entries.length > 0) {
      // 가장 최근 entry 가져오기
      const sorted = [...dyad.journal_entries].sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const latest = sorted.length > 0 ? sorted[0] : null;
      setLatestEntry(latest);
    } else {
      setLatestEntry(null);
    }
  }, [dyad]);

  const handleStart = () => {
    setIsButtonPressed(true);
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
      // 직전 Entry가 있고 completed가 아니면 팝업 표시
      if (latestEntry && latestEntry.stage !== 'complete') {
        setShowContinueModal(true);
      } else {
        // 새로운 작업 시작
        router.push('/(app)/agent-intro');
      }
    });
  };

  const handleContinue = () => {
    setShowContinueModal(false);
    // 기존 작업 이어가기 - 해당 stage로 직접 이동
    router.push({
      pathname: '/(app)/tablet-comic-chatbot',
      params: {
        journalEntryId: latestEntry.id,
        stage: latestEntry.stage,
        continueExisting: 'true'
      }
    });
  };

  const handleStartNew = () => {
    setShowContinueModal(false);
    // 새로운 작업 시작
    router.push('/(app)/agent-intro');
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

      <View className="flex-1 items-center justify-center px-6 style={{ opacity: isButtonPressed ? 0.3 : 1 }}">
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
                className={`text-3xl text-center font-bold ${isButtonPressed ? 'text-transparent' : 'text-gray-800'}`}
                style={styleTemplates.withBoldFont}
              >
                시작하기
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>

      {/* 이어가기 팝업 */}
      <Modal
        visible={showContinueModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowContinueModal(false)}
      >
        <View className="flex-1 justify-center items-center px-6">
          <View className="bg-white rounded-3xl p-10 w-full max-w-xl">
            <Text className="text-2xl font-bold text-center mb-4" style={styleTemplates.withBoldFont}>
              이전에 완성하지 않은 그림일기를 이어서 써볼까?
            </Text>

            <View style={{ height: 15 }} />

            <View className="space-y-6">
              <TouchableOpacity
                onPress={handleContinue}
                className="bg-blue-500 rounded-2xl py-4"
                activeOpacity={0.8}
              >
                <Text className="text-white text-center font-bold text-xl" style={styleTemplates.withBoldFont}>
                  응, 그럴게!
                </Text>
              </TouchableOpacity>

              <View style={{ height: 10 }} />
              
              <TouchableOpacity
                onPress={handleStartNew}
                className="bg-gray-200 rounded-2xl py-4"
                activeOpacity={0.8}
              >
                <Text className="text-gray-700 text-center font-bold text-xl" style={styleTemplates.withBoldFont}>
                  아니, 새로운 거 쓸 거야!
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
} 