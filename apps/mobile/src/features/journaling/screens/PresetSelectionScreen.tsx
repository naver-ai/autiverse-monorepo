import { View, Alert } from "react-native"
import PresetSelectionStage from "../components/stages/PresetSelectionStage"
import { useJournalingStore } from "../store";
import { useChatbot } from "../hooks/useChatbot";
import { Preset, ChatMessage, ChatbotResponse, Place } from "@autiverse-monorepo/ts-core";
import { useDyad } from "../../../api/dyad";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { LoadingOverlay } from "../../../components/LoadingOverlay";
import { useCallback } from "react";

export const PresetSelectionScreen = () => {
    
    const {dyad} = useDyad();

    const router = useRouter();

    const {t} = useTranslation();

  const {startChatbot: startChatbotFromHook, 
        startChatbotWithSuggestion: startChatbotWithSuggestionFromHook,
        isStartingChatbot
        } = useChatbot(useCallback((data: ChatbotResponse, withSuggestion: boolean) => {
            router.replace({
              pathname: '/(app)/create-comic',
              params: {
                journalEntryId: data.journal_entry_id,
                stage: data.stage,
                continueExistingStr: 'false'
              }
            });
          }, [router]));

  const startChatbot = async (preset?: Preset) => {
    console.log('startChatbot called with preset:', preset);
    try {
      await startChatbotFromHook(preset || {});
    } catch (error) {
      console.error('Failed to start chatbot:', error);
      Alert.alert('오류', t('Journaling.Errors.ChatbotStartError'));
    } finally {
    }
  };

  const startChatbotWithSuggestion = async () => {
    console.log('startChatbotWithSuggestion called');
    try {
      await startChatbotWithSuggestionFromHook();
    } catch (error) {
      console.error('Failed to start chatbot with suggestion:', error);
      Alert.alert('오류', t('Journaling.Errors.ChatbotStartError'));
    } finally {
    }
  };


  // 자유롭게 시작하기 핸들러
  const handleFreeStart = async () => {
    // 자유롭게 시작하기는 항상 아무 정보 없이 시작
    await startChatbot();
  };

  // 선택 완료 핸들러 (API 데이터 또는 프리셋 데이터 사용)
  const handleSelectionComplete = async (selectedLocation: Place, selectedPersonIds: string[]) => {
    if (dyad) {
      let peopleList: string[] = [];
      
      if (selectedPersonIds.length > 0) {
        // API 데이터에서 선택된 사람들의 이름 가져오기
        peopleList = dyad.people.filter(person => selectedPersonIds.includes(person.id))
          .map(person => person.name);
      }
      
      if (peopleList.length > 0) {
        const customPreset: Preset = {
          location: selectedLocation.name,
          people: peopleList,
          label: `${selectedLocation.name}에서 ${peopleList.join(', ')}와`,
          dayInfo: []
        };
        await startChatbot(customPreset);
      }
    }
  };

    return (
        <View className="flex-1 bg-gray-100">   
            <PresetSelectionStage 
                onSelectionComplete={handleSelectionComplete}
                onStartChatbotWithSuggestion={startChatbotWithSuggestion}
                onFreeStart={handleFreeStart}
                isStartingChatbot={isStartingChatbot}
            />
            <LoadingOverlay message={t('Journaling.PresetSelection.Preparing')} isLoading={isStartingChatbot} />
        </View>
    )
}