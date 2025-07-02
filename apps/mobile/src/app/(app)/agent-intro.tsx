import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Image, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styleTemplates } from '../../styles';
import { TailwindButton } from '../../components/TailwindButton';

const { width, height } = Dimensions.get('window');

// 이미지 매핑 함수
const getImageSource = (imageName: string) => {
  switch (imageName) {
    case 'robot':
      return require('../../../assets/robot.png');
    case 'doll':
      return require('../../../assets/doll.png');
    default:
      return require('../../../assets/icon.png');
  }
};

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

interface DyadData {
  id: string;
  alias: string;
  child_name: string;
  visit_count: number;
}

interface AgentData {
  id: string;
  name: string;
  description: string;
  agent_config?: any;
}

export default function AgentIntroScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [dyadData, setDyadData] = useState<DyadData | null>(null);
  const [agentData, setAgentData] = useState<AgentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [autoNavigate, setAutoNavigate] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (dyadData && agentData) {
      // 3초 후에 자동으로 다음 화면으로 이동
      const timer = setTimeout(() => {
        setAutoNavigate(true);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [dyadData, agentData]);

  useEffect(() => {
    if (autoNavigate && !hasNavigated) {
      setHasNavigated(true);
      router.push({
        pathname: "/(app)/tablet-comic-chatbot",
        params: { 
          dyadId: params.dyadId,
          dyadName: params.dyadName,
          passcode: params.passcode
        }
      });
    }
  }, [autoNavigate, router, params, hasNavigated]);

  const fetchData = async () => {
    try {
      const dyadId = params.dyadId as string;
      const passcode = params.passcode as string;

      // Dyad 정보 가져오기
      const dyadResponse = await fetch(`http://10.66.106.38:3000/api/v1/app/dyads/${dyadId}`, {
        headers: {
          'Authorization': `Bearer ${passcode}`,
          'Content-Type': 'application/json',
        },
      });

      if (!dyadResponse.ok) {
        throw new Error('Failed to fetch dyad data');
      }

      const dyadResult = await dyadResponse.json();
      setDyadData(dyadResult);

      // Agent 정보 가져오기 (dyad에 연결된 agent)
      const agentResponse = await fetch(`http://10.66.106.38:3000/api/v1/app/agents/${dyadResult.agent_id}`, {
        headers: {
          'Authorization': `Bearer ${passcode}`,
          'Content-Type': 'application/json',
        },
      });

      if (!agentResponse.ok) {
        throw new Error('Failed to fetch agent data');
      }

      const agentResult = await agentResponse.json();
      setAgentData(agentResult);

    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('오류', '데이터를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    if (!hasNavigated) {
      setHasNavigated(true);
      router.push({
        pathname: "/(app)/tablet-comic-chatbot",
        params: { 
          dyadId: params.dyadId,
          dyadName: params.dyadName,
          passcode: params.passcode
        }
      });
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-1 items-center justify-center">
          <Text className="text-lg text-slate-500" style={styleTemplates.withBoldFont}>
            로딩 중...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!dyadData || !agentData) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-1 items-center justify-center">
          <Text className="text-lg text-red-500" style={styleTemplates.withBoldFont}>
            데이터를 불러올 수 없습니다.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isFirstVisit = dyadData.visit_count <= 1;
  const childJosa = getKoreanJosa(dyadData.child_name);
  const agentJosa = getKoreanJosa(agentData.name);
  
  const greetingText = isFirstVisit 
    ? `안녕, ${dyadData.child_name}${childJosa}. 나는 2주간 너와 함께 그림 일기를 쓸 ${agentData.name}${agentJosa}. 만나서 반가워!`
    : `안녕, ${dyadData.child_name}${childJosa}. 또 만나니 너무 좋다.`;



  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 px-6">
        {/* 상단 인사말 영역 */}
        <View className="pt-8 pb-4">
          <View className="bg-white rounded-3xl p-6 shadow-lg w-full">
            <Text className="text-xl text-gray-800 leading-relaxed text-center mb-4" style={styleTemplates.withBoldFont}>
              {greetingText}
            </Text>
            
            <View className="items-center">
              <Text className="text-base text-gray-600 text-center" style={styleTemplates.withSemiboldFont}>
                {agentData.name}
              </Text>
            </View>
          </View>
        </View>



        {/* 중앙 에이전트 이미지 영역 */}
        <View className="flex-1 items-center justify-center">
          <Image 
            source={
              agentData.agent_config?.avatar_image 
                ? (agentData.agent_config.avatar_image.startsWith('http') 
                    ? { uri: agentData.agent_config.avatar_image }
                    : getImageSource(agentData.agent_config.avatar_image))
                : require('../../../assets/robot.png')
            }
            style={{
              width: width * 0.4,
              height: width * 0.4,
              resizeMode: 'contain'
            }}
          />
        </View>

        {/* 하단 버튼 영역 */}
        <View className="pb-8">
          <TailwindButton 
            title="시작하기" 
            containerClassName="w-full" 
            roundedClassName="rounded-full"
            titleClassName="text-white text-lg"
            rippleColor="#f0f0f080"
            buttonStyleClassName="bg-gradient-to-r from-teal-500 to-blue-500"
            onPress={handleContinue}
          />
        </View>
      </View>
    </SafeAreaView>
  );
} 