import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Router } from 'expo-router';

const { width, height } = Dimensions.get('window');

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface Place {
  id: string;
  name: string;
  monday?: boolean;
  tuesday?: boolean;
  wednesday?: boolean;
  thursday?: boolean;
  friday?: boolean;
  saturday?: boolean;
  sunday?: boolean;
}

interface Person {
  id: string;
  name: string;
  avatar_config?: any;
}

interface Preset {
  location: string;
  people: string[];
  label: string;
  dayInfo?: string[];
}

interface TabletComicChatbotScreenProps {
  dyadId?: string;
  dyadName?: string;
  passcode?: string;
  router?: Router;
}

const DAY_INFO = {
  'Monday': { name: '월요일', locations: ['학교', '센터', '태권도장'] },
  'Tuesday': { name: '화요일', locations: ['학교'] },
  'Wednesday': { name: '수요일', locations: ['학교', '센터', '태권도장'] },
  'Thursday': { name: '목요일', locations: ['학교'] },
  'Friday': { name: '금요일', locations: ['학교', '센터', '태권도장'] },
  'Saturday': { name: '토요일', locations: ['애버랜드'] },
  'Sunday': { name: '일요일', locations: ['집'] }
};

const PRESETS: Preset[] = [
  {
    location: "학교",
    people: ["선생님", "민수", "소현", "영호"],
    label: "학교에서 민수와",
    dayInfo: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  },
  {
    location: "센터",
    people: ["선생님", "정은이"],
    label: "센터에서 선생님과",
    dayInfo: ["Monday", "Wednesday", "Friday"]
  },
  {
    location: "태권도장",
    people: ["관장님", "사범님", "미경이"],
    label: "태권도장에서",
    dayInfo: ["Monday", "Wednesday", "Friday"]
  },
  {
    location: "집",
    people: ["엄마", "아빠", "연선이", "할머니"],
    label: "집에서 가족과",
    dayInfo: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
  },
  {
    location: "애버랜드",
    people: ["가족", "엄마", "아빠", "연선이"],
    label: "애버랜드에서",
    dayInfo: ["Sunday"]
  }
];

export const TabletComicChatbotScreen: React.FC<TabletComicChatbotScreenProps> = ({ 
  dyadId, 
  dyadName, 
  passcode, 
  router 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStage, setCurrentStage] = useState('intro');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [comicData, setComicData] = useState<any>(null);
  const [focusedPanel, setFocusedPanel] = useState<string | null>(null);
  
  // 2단계 선택을 위한 state (웹 버전과 동일)
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [selectionStep, setSelectionStep] = useState<'location' | 'people'>('location');
  const [showPresetSelection, setShowPresetSelection] = useState(true);
  
  // 새로운 API 기반 state
  const [places, setPlaces] = useState<Place[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [useApiData, setUseApiData] = useState(false);
  
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (dyadId && dyadName) {
      console.log('Dyad authenticated:', { dyadId, dyadName, passcode });
      // dyad의 places 로드
      loadPlaces();
    }
  }, [dyadId, dyadName, passcode]);

  // API 함수들
  const loadPlaces = async () => {
    if (!dyadId) return;
    
    try {
      const response = await fetch(`http://10.66.106.38:3000/api/v1/app/chatbot/dyad/${dyadId}/places`);
      if (response.ok) {
        const data = await response.json();
        setPlaces(data.places);
        console.log('Loaded places:', data.places);
      } else {
        console.log('Failed to load places, using preset data');
        setUseApiData(false);
      }
    } catch (error) {
      console.error('Error loading places:', error);
      setUseApiData(false);
    }
  };

  const loadPeople = async (placeId: string) => {
    try {
      const response = await fetch(`http://10.66.106.38:3000/api/v1/app/chatbot/place/${placeId}/people`);
      if (response.ok) {
        const data = await response.json();
        setPeople(data.people);
        console.log('Loaded people:', data.people);
      } else {
        console.log('Failed to load people');
      }
    } catch (error) {
      console.error('Error loading people:', error);
    }
  };

  // 세션 정보 로드 (패널 데이터 포함)
  const loadSessionInfo = async () => {
    if (!sessionId) {
      console.log('No sessionId available for loadSessionInfo');
      return;
    }
    
    try {
      console.log('Loading session info for sessionId:', sessionId);
      const response = await fetch(`http://10.66.106.38:3000/api/v1/app/chatbot/session/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Session info received:', data);
        console.log('Current stage:', data.stage);
        console.log('Panels data:', data.panels);
        
        // 패널 데이터 업데이트 - admin-web과 동일한 구조로 설정
        if (data.panels) {
          console.log('Setting comic data with panels:', data.panels);
          setComicData(data.panels);
          console.log('Comic data updated:', data.panels);
        } else {
          console.log('No panels data in session info');
        }
        
        // 현재 단계 업데이트
        if (data.stage) {
          console.log('Updating current stage to:', data.stage);
          setCurrentStage(data.stage);
        }
        
        // focusedPanel 업데이트 (comic_context 단계에서만)
        if (data.stage === 'comic_context' && data.focusedPanel) {
          console.log('Setting focused panel to:', data.focusedPanel);
          setFocusedPanel(data.focusedPanel);
        } else {
          setFocusedPanel(null);
        }
      } else {
        console.error('Failed to load session info, status:', response.status);
      }
    } catch (error) {
      console.error('Error loading session info:', error);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const startChatbot = async (preset?: Preset) => {
    console.log('startChatbot called with preset:', preset);
    console.log('dyadId value:', dyadId);
    setIsLoading(true);
    try {
      console.log('Making API request to start chatbot...');
      const requestBody = {
        dyad_id: dyadId,
        location: preset?.location,
        people: preset?.people
      };
      console.log('Request body:', requestBody);
      const response = await fetch('http://10.66.106.38:3000/api/v1/app/chatbot/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('Response data:', data);
        setSessionId(data.journal_entry_id);
        setCurrentStage(data.stage);
        
        const newMessage: ChatMessage = {
          id: Date.now().toString(),
          text: data.response,
          isUser: false,
          timestamp: new Date(),
        };
        
        setMessages([newMessage]);
        setShowPresetSelection(false);
        
        // 세션 정보에서 패널 데이터 가져오기
        await loadSessionInfo();
        
        console.log('Chatbot started successfully');
      } else {
        console.log('Response not ok, status:', response.status);
        const errorText = await response.text();
        console.log('Error response:', errorText);
        Alert.alert('오류', '챗봇을 시작할 수 없습니다.');
      }
    } catch (error) {
      console.error('Failed to start chatbot:', error);
      Alert.alert('오류', '챗봇을 시작할 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (messageText: string) => {
    if (!sessionId || !messageText.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: messageText,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await fetch('http://10.66.106.38:3000/api/v1/app/chatbot/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journal_entry_id: sessionId,
          message: messageText,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentStage(data.stage);
        
        const botMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          text: data.response,
          isUser: false,
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, botMessage]);
        
        // 세션 정보에서 최신 패널 데이터 가져오기
        console.log('Loading session info after message sent...');
        await loadSessionInfo();
        
        // 만화 데이터 상태 확인
        setTimeout(() => {
          console.log('Current comic data state after message:', comicData);
        }, 100);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('오류', '메시지를 보낼 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 장소 선택 핸들러 (API 데이터 또는 프리셋 데이터 사용)
  const handleLocationSelect = (location: string, placeId?: string) => {
    setSelectedLocation(location);
    setSelectedPlaceId(placeId || null);
    
    if (placeId) {
      // API 데이터 사용
      loadPeople(placeId);
      setUseApiData(true);
    } else {
      // 프리셋 데이터 사용
      setUseApiData(false);
    }
    
    setSelectedPeople([]);
    setSelectedPersonIds([]);
    setSelectionStep('people');
  };

  // 등장인물 선택/해제 핸들러 (API 데이터 또는 프리셋 데이터 사용)
  const handlePersonToggle = (person: string, personId?: string) => {
    if (useApiData && personId) {
      setSelectedPersonIds(prev => 
        prev.includes(personId) 
          ? prev.filter(p => p !== personId)
          : [...prev, personId]
      );
    } else {
      setSelectedPeople(prev => 
        prev.includes(person) 
          ? prev.filter(p => p !== person)
          : [...prev, person]
      );
    }
  };

  // 선택 완료 핸들러 (API 데이터 또는 프리셋 데이터 사용)
  const handleSelectionComplete = async () => {
    if (selectedLocation) {
      let peopleList: string[] = [];
      
      if (useApiData && selectedPersonIds.length > 0) {
        // API 데이터에서 선택된 사람들의 이름 가져오기
        peopleList = people
          .filter(person => selectedPersonIds.includes(person.id))
          .map(person => person.name);
      } else if (selectedPeople.length > 0) {
        // 프리셋 데이터 사용
        peopleList = selectedPeople;
      }
      
      if (peopleList.length > 0) {
        const customPreset: Preset = {
          location: selectedLocation,
          people: peopleList,
          label: `${selectedLocation}에서 ${peopleList.join(', ')}와`,
          dayInfo: PRESETS.find(p => p.location === selectedLocation)?.dayInfo || []
        };
        await startChatbot(customPreset);
      }
    }
  };

  // 뒤로가기 핸들러 (웹 버전과 동일)
  const handleBackToLocation = () => {
    setSelectedLocation(null);
    setSelectedPeople([]);
    setSelectionStep('location');
  };

  // 현재 요일 가져오기 (웹 버전과 동일)
  const getCurrentDay = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  };

  // 자유롭게 시작하기 핸들러 (웹 버전과 동일)
  const handleFreeStart = async () => {
    const todayLocations = getLocationsForToday();
    if (todayLocations.length > 0) {
      const recommendedLocation = todayLocations[0];
      const today = getCurrentDay();
      const koreanDay = DAY_INFO[today as keyof typeof DAY_INFO]?.name || '오늘';
      
      const customPreset: Preset = {
        location: recommendedLocation.location,
        people: recommendedLocation.people,
        label: `${koreanDay} ${recommendedLocation.location}에서 ${recommendedLocation.people.join(', ')}와`,
        dayInfo: recommendedLocation.dayInfo
      };
      await startChatbot(customPreset);
    } else {
      await startChatbot();
    }
  };

  // 요일에 맞는 장소들 필터링 (웹 버전과 동일)
  const getLocationsForToday = () => {
    const today = getCurrentDay();
    return PRESETS.filter(preset => preset.dayInfo?.includes(today));
  };

  // ComicData를 Record<string, Panel> 형태로 변환 (admin-web과 동일한 구조)
  const convertComicDataToPanels = (comicData: any) => {
    if (!comicData) return null;
    
    console.log('Raw comic data received:', comicData);
    
    // admin-web의 TabletFourSceneComic과 동일한 구조로 변환
    const panels: Record<string, any> = {};
    
    // backend에서 오는 데이터 구조를 처리
    // 1. 이미 올바른 구조인 경우 (admin-web과 동일)
    if (comicData.panel1 && typeof comicData.panel1 === 'object' && comicData.panel1.content !== undefined) {
      panels.panel1 = {
        content: comicData.panel1.content || '',
        grid: comicData.panel1.grid || []
      };
    } else if (comicData.panel1) {
      // 2. 단순 문자열인 경우
      panels.panel1 = {
        content: comicData.panel1,
        grid: []
      };
    } else {
      // 3. 데이터가 없는 경우 빈 패널 생성
      panels.panel1 = {
        content: '',
        grid: []
      };
    }
    
    if (comicData.panel2 && typeof comicData.panel2 === 'object' && comicData.panel2.content !== undefined) {
      panels.panel2 = {
        content: comicData.panel2.content || '',
        grid: comicData.panel2.grid || []
      };
    } else if (comicData.panel2) {
      panels.panel2 = {
        content: comicData.panel2,
        grid: []
      };
    } else {
      panels.panel2 = {
        content: '',
        grid: []
      };
    }
    
    if (comicData.panel3 && typeof comicData.panel3 === 'object' && comicData.panel3.content !== undefined) {
      panels.panel3 = {
        content: comicData.panel3.content || '',
        grid: comicData.panel3.grid || []
      };
    } else if (comicData.panel3) {
      panels.panel3 = {
        content: comicData.panel3,
        grid: []
      };
    } else {
      panels.panel3 = {
        content: '',
        grid: []
      };
    }
    
    if (comicData.panel4 && typeof comicData.panel4 === 'object' && comicData.panel4.content !== undefined) {
      panels.panel4 = {
        content: comicData.panel4.content || '',
        grid: comicData.panel4.grid || []
      };
    } else if (comicData.panel4) {
      panels.panel4 = {
        content: comicData.panel4,
        grid: []
      };
    } else {
      panels.panel4 = {
        content: '',
        grid: []
      };
    }
    
    console.log('Converted panels:', panels);
    return panels;
  };

  // 만화 패널 렌더링 함수 (admin-web의 TabletFourSceneComic과 동일한 스타일)
  const renderComicPanels = () => {
    const panels = convertComicDataToPanels(comicData);
    if (!panels) {
      return (
        <View className="flex-1 items-center justify-center">
          <Text className="text-lg text-gray-600 text-center">
            어떤 이야기로 오늘 만화 일기를 쓸지 도도와 이야기해보자!
          </Text>
        </View>
      );
    }

    // 타일 타입별 색상 정의 (admin-web과 동일)
    const getTileColor = (type: string) => {
      switch (type) {
        case 'figure': return '#FFE0B2';  // 연한 주황색 (인물)
        case 'object': return '#B2DFDB';  // 연한 청록색 (물건)
        case 'location': return '#E1BEE7';  // 연한 보라색 (장소)
        case 'think': return '#C8E6C9';  // 연한 초록색 (생각)
        case 'tell': return '#BBDEFB';  // 연한 파란색 (대화)
        case 'emotion': return '#F8BBD0';  // 연한 분홍색 (감정)
        default: return '#FFFFFF';  // 흰색 (빈 칸)
      }
    };

    const renderPanel = (panelId: string, panelIndex: number) => {
      const panel = panels[panelId];
      
      // admin-web과 동일: 패널이 없으면 아예 렌더링하지 않음
      if (!panel) {
        return null;
      }
      
      const isHighlighted = currentStage === 'comic_context' && focusedPanel === panelId;

      return (
        <View 
          key={panelId}
          className={`bg-white p-2 rounded-xl shadow-md border-2 ${
            isHighlighted ? 'border-red-500 border-3' : 'border-gray-200'
          }`}
          style={{ 
            height: 330, 
            maxHeight: 330,
            flex: 1,
            marginHorizontal: 4,
            ...(isHighlighted && {
              borderWidth: 3,
              borderColor: '#e53935',
              shadowColor: '#e53935',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 8
            })
          }}
        >
          {/* 스토리 텍스트 (admin-web과 동일한 스타일) */}
          <View className="mb-2 p-2 bg-gray-50 rounded-lg border-l-3 border-blue-500">
            <Text className="text-sm text-gray-800 leading-5">
              <Text className="font-bold text-blue-500">{panelIndex + 1}. </Text>
              {!panel.content?.startsWith('null') && panel.content}
            </Text>
          </View>

          {/* 5x5 그리드 (admin-web과 동일: 항상 표시) */}
          <View className="flex-1 justify-center items-center">
            <View style={{ width: 200, height: 200 }}>
              {/* backend에서 받은 layout 데이터를 5x5 grid로 변환 */}
              {panel?.grid && panel.grid.length > 0 ? (
                // 5x5 빈 그리드 생성 후 layout 데이터로 채우기
                (() => {
                  // 5x5 빈 그리드 생성
                  const grid = Array.from({ length: 5 }, () => 
                    Array.from({ length: 5 }, () => ({
                      type: 'empty',
                      content: '',
                      position: [0, 0]
                    }))
                  );
                  
                  // layout 데이터를 position에 따라 배치
                  panel.grid.forEach((item: any) => {
                    const [x, y] = item.position || [0, 0];
                    if (x >= 0 && x < 5 && y >= 0 && y < 5) {
                      grid[y][x] = {
                        type: item.type || 'empty',
                        content: item.content || '',
                        position: [x, y]
                      };
                    }
                  });
                  
                  // 5x5 grid 렌더링
                  return grid.map((row: any[], y: number) => (
                    <View key={y} style={{ flexDirection: 'row', height: 40 }}>
                      {row.map((tile: any, x: number) => (
                        <View
                          key={`${x}-${y}`}
                          style={{ 
                            width: 40,
                            height: 40,
                            borderWidth: 1,
                            borderColor: '#ddd',
                            borderRadius: 4,
                            backgroundColor: getTileColor(tile.type),
                            justifyContent: 'center',
                            alignItems: 'center',
                            padding: 4
                          }}
                        >
                          <Text style={{ 
                            fontSize: 12,
                            textAlign: 'center',
                            lineHeight: 14,
                            color: '#333'
                          }} numberOfLines={2}>
                            {tile.content}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ));
                })()
              ) : (
                // 빈 그리드 표시 (5x5)
                Array.from({ length: 5 }, (_, y) => (
                  <View key={y} style={{ flexDirection: 'row', height: 40 }}>
                    {Array.from({ length: 5 }, (_, x) => (
                      <View
                        key={`${x}-${y}`}
                        style={{ 
                          width: 40,
                          height: 40,
                          borderWidth: 1,
                          borderColor: '#ddd',
                          borderRadius: 4,
                          backgroundColor: '#FFFFFF',
                          justifyContent: 'center',
                          alignItems: 'center'
                        }}
                      />
                    ))}
                  </View>
                ))
              )}
            </View>
          </View>
        </View>
      );
    };

    return (
      <View className="flex-1 p-4">
        <View className="flex-1">
          {/* 첫 번째 행 */}
          <View className="flex-row flex-1 mb-4">
            {renderPanel('panel1', 0)}
            {renderPanel('panel2', 1)}
          </View>
          {/* 두 번째 행 */}
          <View className="flex-row flex-1">
            {renderPanel('panel3', 2)}
            {renderPanel('panel4', 3)}
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 bg-gray-100">
        {showPresetSelection ? (
          // 선택 화면 (전체 화면)
          <View className="flex-1 p-6">
            <ScrollView className="flex-1">
              {/* 웹 버전과 동일한 환영 메시지 */}
              <View className="items-center justify-center py-8">
                <Text className="text-3xl font-bold text-gray-800 mb-6 text-center">
                  만화일기 챗봇에 오신 것을 환영합니다! 🎨
                </Text>
                <Text className="text-lg text-gray-600 mb-8 text-center leading-6">
                  오늘 있었던 일을 이야기해주시면 4컷 만화로 만들어드릴게요!
                </Text>
              </View>

              {selectionStep === 'location' ? (
                <>
                  <Text className="text-xl font-bold mb-4 text-gray-800 text-center">
                    어디서 일어난 일인가요?
                  </Text>
                  
                  {/* 장소 선택 그리드 */}
                  <View className="grid grid-cols-2 gap-4 mb-6">
                    {places.length > 0 ? (
                      // API 데이터 사용
                      places.map((place) => (
                        <TouchableOpacity
                          key={place.id}
                          className="p-6 border-2 border-gray-200 rounded-xl bg-white"
                          onPress={() => handleLocationSelect(place.name, place.id)}
                        >
                          <Text className="text-lg font-semibold text-gray-800 text-center">
                            {place.name}
                          </Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      // 프리셋 데이터 사용
                      PRESETS.filter(preset => (preset.dayInfo?.length || 0) >= 2).map((preset) => (
                        <TouchableOpacity
                          key={preset.location}
                          className="p-6 border-2 border-gray-200 rounded-xl bg-white"
                          onPress={() => handleLocationSelect(preset.location)}
                        >
                          <Text className="text-lg font-semibold text-gray-800 text-center">
                            {preset.location}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                  
                  {/* 자유롭게 시작하기 버튼 */}
                  <View className="border-t-2 border-gray-200 pt-6 mt-6">
                    <TouchableOpacity
                      className="bg-blue-500 rounded-xl p-4"
                      onPress={handleFreeStart}
                      disabled={isLoading}
                    >
                      <Text className="text-white text-lg font-semibold text-center">
                        {isLoading ? '시작 중...' : '자유롭게 시작하기'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  {/* 뒤로가기 버튼 */}
                  <TouchableOpacity
                    className="mb-4 p-2"
                    onPress={handleBackToLocation}
                  >
                    <Text className="text-blue-500 text-lg">← 장소 다시 선택</Text>
                  </TouchableOpacity>
                  
                  {/* 선택된 장소 표시 */}
                  <View className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <Text className="text-lg text-gray-800">
                      <Text className="font-bold">선택된 장소:</Text> {selectedLocation}
                    </Text>
                  </View>
                  
                  <Text className="text-xl font-bold mb-4 text-gray-800 text-center">
                    누구와 함께 있었나요? (여러 명 선택 가능)
                  </Text>
                  
                  {/* 사람 선택 그리드 */}
                  <View className="grid grid-cols-2 gap-4 mb-6">
                    {useApiData && people.length > 0 ? (
                      // API 데이터 사용
                      people.map((person) => (
                        <TouchableOpacity
                          key={person.id}
                          className={`p-4 border-2 rounded-xl ${
                            selectedPersonIds.includes(person.id)
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 bg-white'
                          }`}
                          onPress={() => handlePersonToggle(person.name, person.id)}
                        >
                          <Text className={`text-center font-semibold ${
                            selectedPersonIds.includes(person.id)
                              ? 'text-blue-600'
                              : 'text-gray-800'
                          }`}>
                            {person.name}
                          </Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      // 프리셋 데이터 사용
                      selectedLocation && PRESETS.find(p => p.location === selectedLocation)?.people.map((person: string) => (
                        <TouchableOpacity
                          key={person}
                          className={`p-4 border-2 rounded-xl ${
                            selectedPeople.includes(person)
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 bg-white'
                          }`}
                          onPress={() => handlePersonToggle(person)}
                        >
                          <Text className={`text-center font-semibold ${
                            selectedPeople.includes(person)
                              ? 'text-blue-600'
                              : 'text-gray-800'
                          }`}>
                            {person}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                  
                  {/* 시작하기 버튼 */}
                  <TouchableOpacity
                    className={`rounded-xl p-4 ${
                      ((useApiData && selectedPersonIds.length === 0) || (!useApiData && selectedPeople.length === 0)) || isLoading
                        ? 'bg-gray-400'
                        : 'bg-blue-500'
                    }`}
                    onPress={handleSelectionComplete}
                    disabled={((useApiData && selectedPersonIds.length === 0) || (!useApiData && selectedPeople.length === 0)) || isLoading}
                  >
                    <Text className="text-white text-lg font-semibold text-center">
                      {isLoading ? '시작 중...' : `시작하기 (${
                        useApiData ? selectedPersonIds.length : selectedPeople.length
                      }명 선택됨)`}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        ) : (
          // 2컬럼 레이아웃 (웹 버전과 동일)
          <View className="flex-1 flex-row">
            {/* 왼쪽: 만화 섹션 */}
            <View className="flex-[1.8] bg-white border-r-2 border-gray-200">
              {/* 만화 헤더 */}
              <View className="flex-row justify-between items-center p-3 border-b border-gray-200 pt-6">
                <Text className="text-lg font-bold text-gray-800">🎨 만화일기</Text>
                <View className="bg-blue-100 px-2 py-1 rounded">
                  <Text className="text-xs font-semibold text-blue-800">
                    {currentStage === 'intro' ? '대화' :
                     currentStage === 'revision_1' ? '수정 1' :
                     currentStage === 'comic_context' ? '만화 완성' :
                     currentStage === 'revision_2' ? '수정 2' :
                     currentStage === 'complete' ? '완료' : '대화'}
                  </Text>
                </View>
              </View>
              
              {/* 만화 콘텐츠 */}
              <View className="flex-1">
                {comicData && (currentStage === 'revision_1' || currentStage === 'comic_context' || currentStage === 'revision_2' || currentStage === 'complete') ? (
                  renderComicPanels()
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <Text className="text-lg text-gray-600 text-center">
                      어떤 이야기로 오늘 만화 일기를 쓸지 도도와 이야기해보자!
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* 오른쪽: 채팅 섹션 */}
            <View className="flex-1 bg-white">
              {/* 채팅 헤더 */}
              <View className="bg-blue-500 p-4">
                <Text className="text-xl font-bold text-white">💬 도도와 대화하기</Text>
              </View>

              {/* 채팅 메시지 */}
              <ScrollView 
                ref={scrollViewRef}
                className="flex-1 p-3 bg-gray-50"
                onContentSizeChange={scrollToBottom}
              >
                {messages.length === 0 ? (
                  <View className="items-center justify-center py-8">
                    <Text className="text-base text-gray-600 text-center">
                      왼쪽에서 시작하기를 눌러주세요!
                    </Text>
                  </View>
                ) : (
                  <>
                    {messages.map((message) => (
                      <View
                        key={message.id}
                        className={`mb-3 ${message.isUser ? 'items-end' : 'items-start'}`}
                      >
                        <View
                          className={`max-w-[80%] p-3 rounded-lg ${
                            message.isUser
                              ? 'bg-blue-500'
                              : 'bg-white border border-gray-200'
                          }`}
                        >
                          <Text
                            className={`text-sm ${
                              message.isUser ? 'text-white' : 'text-gray-800'
                            }`}
                          >
                            {message.text}
                          </Text>
                        </View>
                      </View>
                    ))}
                    
                    {isLoading && (
                      <View className="items-start mb-3">
                        <View className="bg-white border border-gray-200 p-3 rounded-lg">
                          <View className="flex-row items-center">
                            <ActivityIndicator size="small" color="#666" />
                            <Text className="text-gray-600 ml-2 text-sm">도도가 생각 중...</Text>
                          </View>
                        </View>
                      </View>
                    )}
                  </>
                )}
              </ScrollView>

              {/* 입력 영역 */}
              <View className="p-4 border-t-2 border-gray-200">
                {/* Yes/No 버튼 */}
                {(() => {
                  const lastBotMessage = messages
                    .filter(m => !m.isUser)
                    .pop()?.text;
                  
                  // revision_1에서 "여기서 틀린 부분 있어?" 또는 "이제 다 맞을까?" 질문일 때만 버튼 표시
                  const showYesNoRevision1 = currentStage === 'revision_1' && 
                    (lastBotMessage?.includes('여기서 틀린 부분 있어?') || 
                     lastBotMessage?.includes('이제 다 맞을까?')) && 
                    !isLoading && 
                    !inputText.trim();
                  
                  // revision_2에서 "수정하거나 추가하고 싶은 부분 있어?" 또는 "이제 다 맞을까?" 질문일 때만 버튼 표시
                  const showYesNoRevision2 = currentStage === 'revision_2' && 
                    (lastBotMessage?.includes('수정하거나 추가하고 싶은 부분 있어?') || 
                     lastBotMessage?.includes('이제 다 맞을까?')) && 
                    !isLoading && 
                    !inputText.trim();
                  
                  // comic_context에서 "좋아! 그럼 이제 만화를 더 완성해볼게!" 메시지일 때만 버튼 표시
                  const showYesNoComicContext = currentStage === 'comic_context' && 
                    lastBotMessage?.includes('좋아! 그럼 이제 만화를 더 완성해볼게!') && 
                    !isLoading && 
                    !inputText.trim();
                  
                  const showYesNoButtons = showYesNoRevision1 || showYesNoRevision2 || showYesNoComicContext;
                  
                  return showYesNoButtons ? (
                    <View className="flex-row justify-center mb-3">
                      <TouchableOpacity
                        className="bg-green-500 px-6 py-3 rounded-lg mr-3"
                        onPress={() => sendMessage('응')}
                        disabled={isLoading}
                      >
                        <Text className="text-white font-semibold text-base">응</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="bg-red-500 px-6 py-3 rounded-lg"
                        onPress={() => sendMessage('아니')}
                        disabled={isLoading}
                      >
                        <Text className="text-white font-semibold text-base">아니</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null;
                })()}
                
                <View className="flex-row items-center">
                  <TextInput
                    className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 mr-3 text-base"
                    placeholder="메시지를 입력하세요..."
                    value={inputText}
                    onChangeText={setInputText}
                    onSubmitEditing={() => sendMessage(inputText)}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    className={`px-6 py-3 rounded-xl ${
                      isLoading || !inputText.trim() ? 'bg-gray-400' : 'bg-blue-500'
                    }`}
                    onPress={() => sendMessage(inputText)}
                    disabled={isLoading || !inputText.trim()}
                  >
                    <Text className="text-white font-semibold text-base">전송</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};