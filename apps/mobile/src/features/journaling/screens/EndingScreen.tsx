import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useCallback, useRef, useEffect } from "react";
import { View } from "react-native";
import PraiseSection from "../components/sections/PraiseSection";
import FarewellSection, { FarewellSectionRef } from "../components/sections/FarewellSection";
import { useDyad } from "../../../api/dyad";
import { LoadingOverlay } from "../../../components/LoadingOverlay";
import { usePrevious } from "@uidotdev/usehooks";

export const EndingScreen = () => {

  const [mode, setMode] = useState<'farewell' | 'praise'>('praise');
  const previousMode = usePrevious(mode)

  const {dyad, isDyadLoading} = useDyad()
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const router = useRouter()

  const farewellSectionRef = useRef<FarewellSectionRef>(null);

  // 인사말 섹션 완료 콜백 (intro 화면으로 돌아가기)
  const handleFarewellComplete = useCallback(() => {
    // Home 화면으로 돌아가기
    if(router.canDismiss()){
      router.dismissAll();
    } else if(router.canGoBack()) {
      router.back();
    } else {
      router.replace({
        pathname: '/(app)/home',
      });
    }
  }, [router]);


  useEffect(()=>{
    if(previousMode !== mode && mode === 'farewell'){
      farewellSectionRef.current?.runAnimation();
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
                <PraiseSection 
                  childName={dyad?.child_name} 
                  sessionId={sessionId}
                  onComplete={() => setMode('farewell')} 
                />
            ) : (
                dyad && <FarewellSection ref={farewellSectionRef} childName={dyad?.child_name} agentConfig={dyad?.agents[0]?.agent_config} locale={dyad?.locale} onCompleteHandler={handleFarewellComplete} />
            )) : null
        }
        <LoadingOverlay isLoading={isDyadLoading} />
    </View>
  )
}