import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Dimensions,
  Animated,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { styleTemplates } from '../../../styles';
import { LogoImage } from '../../../components/svg-images';
import { useDyad } from '../../../api/dyad';
import { TailwindButton } from '../../../components/TailwindButton';
import { DyadProfileView } from '../components/DyadProfileView';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { dyad } = useDyad();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const [showContinueModal, setShowContinueModal] = useState(false);
  const [latestEntry, setLatestEntry] = useState<any>(null);
  const [isButtonPressed, setIsButtonPressed] = useState(false);

  useEffect(() => {
    
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

    const handleStart = useCallback(() => {
      // 직전 Entry가 있고 completed가 아니면 팝업 표시
      if (latestEntry && latestEntry.stage !== 'complete') {
        setShowContinueModal(true);
      } else {
        // 새로운 작업 시작
        router.push('/(app)/agent-intro');
      }
  }, [latestEntry?.stage, router]);

  const handleContinue = () => {
    setShowContinueModal(false);
    // 기존 작업 이어가기 - 해당 stage로 직접 이동
    router.push({
      pathname: '/(app)/create-comic',
      params: {
        journalEntryId: latestEntry.id,
        stage: latestEntry.stage,
        continueExistingStr: 'true'
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

      <DyadProfileView containerClassName="absolute top-12 left-8 z-10"/>

      {/* 갤러리 아이콘 */}
     <TailwindButton
          onPress={handleGallery}
          containerClassName="absolute top-12 right-8 z-10"
          buttonStyleClassName="bg-white p-4 px-6"
          shadowClassName="shadow-lg"
          roundedClassName="rounded-full"
          title={t('Home.ViewPastDiaries')}
          titleClassName="text-2xl"
        />

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
            <TailwindButton
              onPress={handleStart}
              containerClassName=""
              buttonStyleClassName="bg-transparent px-8 py-6"
              shadowClassName="shadow-none"
              roundedClassName="rounded-full"
              title={t('Home.WriteDiary')}
              titleClassName={`text-3xl text-center`}
            />
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
          <View className="bg-white rounded-3xl p-10 w-full max-w-xl shadow-lg">
            <Text className="text-2xl text-center mb-4" style={styleTemplates.withBoldFont}>
              {t('Home.ContinueModal.Message')}
            </Text>

            <View style={{ height: 15 }} />

            <View className="space-y-6">
              <TailwindButton
                onPress={handleContinue}
                buttonStyleClassName="bg-blue-500 rounded-2xl py-4"
                title={t('Home.ContinueModal.Continue')}
                titleClassName="text-white text-center text-2xl"
              />

              <View style={{ height: 10 }} />
              
              <TailwindButton
                onPress={handleStartNew}
                buttonStyleClassName="bg-gray-200 rounded-2xl py-4"
                title={t('Home.ContinueModal.StartNew')}
                titleClassName="text-gray-700 text-center text-2xl"
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
} 