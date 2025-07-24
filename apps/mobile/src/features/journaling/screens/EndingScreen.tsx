import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useCallback, useRef, useEffect } from "react";
import { View } from "react-native";
import PraiseSection from "../components/sections/PraiseSection";
import FarewellSection, { FarewellSectionRef } from "../components/sections/FarewellSection";
import { useDyad } from "../../../api/dyad";
import { LoadingOverlay } from "../../../components/LoadingOverlay";
import { usePrevious } from "@uidotdev/usehooks";

export const EndingScreen = () => {

  const {journalEntryId} = useLocalSearchParams();

  const [mode, setMode] = useState<'farewell' | 'praise'>('praise');
  const previousMode = usePrevious(mode)

  const {dyad, isDyadLoading} = useDyad()

  const router = useRouter()

  const farewellSectionRef = useRef<FarewellSectionRef>(null);

  // 인사말 섹션 완료 콜백 (intro 화면으로 돌아가기)
  const handleFarewellComplete = useCallback(() => {
    // Home 화면으로 돌아가기
    router.replace('/(app)/home');
  }, [router]);


  useEffect(()=>{
    if(previousMode !== mode && mode === 'farewell'){
      farewellSectionRef.current?.runAnimation(handleFarewellComplete);
    }
  }, [
    previousMode,
    mode,
    handleFarewellComplete
  ])

  return (
    <View className="flex-1 bg-slate-50">
        {
            dyad ? (mode == 'praise' ? (
                <PraiseSection childName={dyad?.child_name} onComplete={() => setMode('farewell')} />
            ) : (
                <FarewellSection ref={farewellSectionRef} childName={dyad?.child_name} />
            )) : null
        }
        <LoadingOverlay isLoading={isDyadLoading} />
    </View>
  )
}