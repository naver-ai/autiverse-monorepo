import React, { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeInUp, 
  SlideInDown,
  Easing
} from 'react-native-reanimated';
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
import { useAuth } from '../../auth/hooks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { continueSessionAPI } from '../../journaling/api';
const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { dyad } = useDyad();
  const [showContinueModal, setShowContinueModal] = useState(false);

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

  const {jwt} = useAuth();

  const queryClient = useQueryClient();

  const {mutate: continueSession} = useMutation({
    mutationFn: async () => {
      await continueSessionAPI(jwt!!, latestEntry!.id, latestEntry!.stage);
    },
    onMutate: () => {
      setShowContinueModal(false);
    },
    onSuccess: () => {
      router.push({
        pathname: '/(app)/create-comic',
        params: {
          journalEntryId: latestEntry!.id,
          stage: latestEntry!.stage,
          continueExistingStr: 'true'
        }
      });
      queryClient.invalidateQueries({ queryKey: ['session', latestEntry!.id] });
    }
  })

  const handleContinue = useCallback(() => {
    continueSession()  
  }, [continueSession]);

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
      <Animated.View
        entering={FadeInDown.delay(300).duration(800).easing(Easing.out(Easing.cubic))}
      >
        <TailwindButton
          onPress={handleGallery}
          containerClassName="absolute top-12 right-8 z-10"
          buttonStyleClassName="bg-white p-4 px-6"
          shadowClassName="shadow-lg"
          roundedClassName="rounded-full"
          title={t('Home.ViewPastDiaries')}
          titleClassName="text-2xl"
        />
      </Animated.View>

      <View className="flex-1 items-center justify-center px-6">
        {/* 로고 영역 */}
        <Animated.View 
          className="flex-1 items-center justify-center"
          entering={FadeIn.delay(200).duration(1000).easing(Easing.out(Easing.cubic))}
        >
          <Animated.View 
            style={{ marginTop: 60 }}
            entering={FadeInUp.delay(400).duration(800).easing(Easing.out(Easing.cubic))}
          >
            <LogoImage 
              width={width * 0.6} 
              height={width * 0.18} 
              style={{
                marginBottom: 40,
              }}
            />
          </Animated.View>
        </Animated.View>

        {/* 시작하기 버튼 영역 */}
        <Animated.View 
          className="w-full pb-20 items-center"
          entering={SlideInDown.delay(0).duration(800).easing(Easing.out(Easing.cubic))}
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

      {/* 이어가기 팝업 */}
      <Modal
        visible={showContinueModal}
        panelClassName='bg-white rounded-3xl p-10 px-10'
        dismissOnPressOutside={true}
        onPop={() => setShowContinueModal(false)}
      >
        <Animated.View
          entering={FadeIn.duration(300)}
        >
          <Text className="text-2xl text-center mb-8 leading-10" style={styleTemplates.withBoldFont}>
                {t('Home.ContinueModal.Message')}
              </Text>

              <View className="flex flex-row gap-4 justify-center">
                <TailwindButton
                  onPress={handleContinue}
                  roundedClassName="rounded-2xl"
                  buttonStyleClassName="bg-blue-500 py-4"
                  title={t('Home.ContinueModal.Continue')}
                  titleClassName="text-white text-center text-2xl"
                />
                
                <TailwindButton
                  onPress={handleStartNew}
                  roundedClassName="rounded-2xl"
                  buttonStyleClassName="bg-gray-200 py-4"
                  title={t('Home.ContinueModal.StartNew')}
                  titleClassName="text-gray-700 text-center text-2xl"
                />
              </View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
} 