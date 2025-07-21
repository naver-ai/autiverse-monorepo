import React, { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Dimensions,
  Animated,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { styleTemplates } from '../../../styles';
import { LogoImage } from '../../../components/svg-images';
import { useDyad } from '../../../api/dyad';
import { TailwindButton } from '../../../components/TailwindButton';
import { DyadProfileView } from '../components/DyadProfileView';
import { check, PERMISSIONS, RESULTS, request } from 'react-native-permissions';
import { JournalEntryStage } from '@autiverse-monorepo/ts-core';
import { Modal } from '../../../components/Modal';
const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { dyad } = useDyad();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const [showContinueModal, setShowContinueModal] = useState(false);
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

  const latestEntry = useMemo(() => {
    if(dyad && dyad.journal_entries && dyad.journal_entries.length > 0){
      const sorted = [...dyad.journal_entries].sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const latest = sorted.length > 0 ? sorted[0] : null;
      return latest;
    }else return null;
  }, [dyad?.id, dyad?.journal_entries]);

    const handleStart = useCallback(() => {

      console.log("handle start")

      // 직전 Entry가 있고 completed가 아니면 팝업 표시
      if (latestEntry && latestEntry.stage !== JournalEntryStage.Complete) {
        setShowContinueModal(true);
      } else {
        // 새로운 작업 시작
        router.push('/(app)/agent-intro');
      }
  }, [latestEntry?.stage, router]);

 

  console.log("latestEntry", latestEntry)

  const handleContinue = async () => {
    setShowContinueModal(false);
    
    try {
      // 이어쓰기 시작 시점을 백엔드에 기록
      const { continueSessionAPI } = await import('../../journaling/api');
      await continueSessionAPI(latestEntry!.id, latestEntry!.stage);
    } catch (error) {
      console.error('Failed to record continue session:', error);
      // 에러가 발생해도 이어쓰기는 계속 진행
    }
    
    // 기존 작업 이어가기 - 해당 stage로 직접 이동
    router.push({
      pathname: '/(app)/create-comic',
      params: {
        journalEntryId: latestEntry!.id,
        stage: latestEntry!.stage,
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

  useEffect(() => {
    if(Platform.OS === 'android'){
      check(PERMISSIONS.ANDROID.RECORD_AUDIO).then((status) => {
        console.log("Microphone permission status:", status)
        if(status === RESULTS.DENIED){
          request(PERMISSIONS.ANDROID.RECORD_AUDIO).then((status) => {
            console.log("Microphone permission status:", status)
          })
        }
      })
    }
  }, []);

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
        panelClassName='bg-white rounded-3xl p-10 px-10'
        dismissOnPressOutside={true}
        onPop={() => setShowContinueModal(false)}
      >
        <Text className="text-2xl text-center mb-8 leading-10" style={styleTemplates.withBoldFont}>
              {t('Home.ContinueModal.Message')}
            </Text>

            <View className="flex flex-row gap-4 justify-center">
              <TailwindButton
                onPress={handleContinue}
                buttonStyleClassName="bg-blue-500 rounded-2xl py-4"
                title={t('Home.ContinueModal.Continue')}
                titleClassName="text-white text-center text-2xl"
              />
              
              <TailwindButton
                onPress={handleStartNew}
                buttonStyleClassName="bg-gray-200 rounded-2xl py-4"
                title={t('Home.ContinueModal.StartNew')}
                titleClassName="text-gray-700 text-center text-2xl"
              />
            </View>
      </Modal>
    </SafeAreaView>
  );
} 