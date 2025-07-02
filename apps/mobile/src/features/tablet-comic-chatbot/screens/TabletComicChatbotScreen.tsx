import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Image,
  Animated,
} from 'react-native';
import { Router } from 'expo-router';
import { ProgressLoadingOverlay } from '../../../components/ProgressLoadingOverlay';
import { useComicGeneration } from '../hooks/useComicGenerationQuery';
import { useChatbot } from '../hooks/useChatbot';
import PraiseSection from '../../../components/PraiseSection';
import FarewellSection from '../../../components/FarewellSection';

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
  'Monday': { name: '월요일' },
  'Tuesday': { name: '화요일' },
  'Wednesday': { name: '수요일' },
  'Thursday': { name: '목요일' },
  'Friday': { name: '금요일' },
  'Saturday': { name: '토요일' },
  'Sunday': { name: '일요일' }
};

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
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);

  // 만화 생성 완료 플래그 (무한 루프 방지)
  const [isComicCompleted, setIsComicCompleted] = useState(false);

  // 칭찬 섹션 관련 상태
  const [showPraiseSection, setShowPraiseSection] = useState(false);
  const [showFarewellSection, setShowFarewellSection] = useState(false);
  const [completionMessage, setCompletionMessage] = useState<string>('');

  // Chatbot 훅 사용
  const {
    places,
    people,
    agentName,
    agentConfig,
    childName,
    useApiData,
    loadAgentInfo: loadAgentInfoFromHook,
    loadPlaces: loadPlacesFromHook,
    loadPeople: loadPeopleFromHook,
    loadSessionInfo: loadSessionInfoFromHook,
    startChatbot: startChatbotFromHook,
    startChatbotWithSuggestion: startChatbotWithSuggestionFromHook,
    sendMessage: sendMessageFromHook,
    startAutoComicGeneration: startAutoComicGenerationFromHook
  } = useChatbot(dyadId || '', passcode || '');

  // 칭찬 섹션 완료 콜백
  const handlePraiseComplete = () => {
    console.log('Praise section completed');
    setShowPraiseSection(false);
    setShowFarewellSection(true);
  };

  // 인사말 섹션 완료 콜백 (첫 화면으로 돌아가기)
  const handleFarewellComplete = () => {
    console.log('Farewell section completed, navigating to home');
    setShowFarewellSection(false);
    // 첫 화면으로 돌아가기
    if (router) {
      router.replace('/');
    }
  };

  // 만화 생성 훅 (React Query 기반)
  const { 
    status: comicGenerationStatus, 
    startGeneration, 
    isLoading: isComicGenerating,
    startError: comicGenerationError 
  } = useComicGeneration(sessionId || null);

  // 만화 생성 완료 처리
  useEffect(() => {
    if (comicGenerationStatus.status === 'completed' && comicGenerationStatus.comic_data) {
      console.log('Comic generation completed:', comicGenerationStatus.comic_data);
      
      // 만화 생성이 완료되면 고정 메시지들을 제거
      setMessages(prev => {
        const filteredMessages = prev.filter(msg => 
          msg.text !== '다행이다:) 그럼 네가 확인해준 내용을 내가 그림으로 그려볼게! 잠깐만 기다려줘~' &&
          msg.text !== '내가 물어보는 질문에 잘 답해줘서 고마워. 네 덕분에 비어있던 부분을 채울 수 있을 것 같아! 조금만 기다려줘~'
        );
        return filteredMessages;
      });
      
      // 세션 정보를 다시 로드하여 최신 만화 데이터 가져오기
      setTimeout(() => {
        loadSessionInfo();
      }, 100);
    }
  }, [comicGenerationStatus.status]);

  // 프로그레스바 애니메이션
  const progressAnimation = useRef(new Animated.Value(0)).current;

  // 이미지 매핑 함수
  const getImageSource = (imageName: string) => {
    switch (imageName) {
      case 'robot':
        return require('../../../../assets/robot.png');
      case 'doll':
          return require('../../../../assets/doll.png');
      default:
        return require('../../../../assets/icon.png');
    }
  };



  useEffect(() => {
    if (dyadId && dyadName) {
      console.log('Dyad authenticated:', { dyadId, dyadName, passcode });
      // dyad의 places 로드
      loadPlacesFromHook();
      // agent 정보 로드
      loadAgentInfoFromHook();
    }
  }, [dyadId, dyadName, passcode, loadPlacesFromHook, loadAgentInfoFromHook]);

  // 프로그레스바 애니메이션 업데이트
  useEffect(() => {
    if (comicGenerationStatus.status === 'generating') {
      console.log('Progress animation update:', comicGenerationStatus.progress);
      Animated.timing(progressAnimation, {
        toValue: comicGenerationStatus.progress,
        duration: 500,
        useNativeDriver: false,
      }).start();
    }
  }, [comicGenerationStatus.progress, comicGenerationStatus.status]);

  // 만화 생성 상태 디버깅 (개발 모드에서만)
  useEffect(() => {
    if (__DEV__) {
      console.log('Comic generation status changed:', {
        status: comicGenerationStatus.status,
        progress: comicGenerationStatus.progress,
        message: comicGenerationStatus.message,
        has_comic_data: !!comicGenerationStatus.comic_data
      });
    }
  }, [comicGenerationStatus.status, comicGenerationStatus.progress, comicGenerationStatus.message]);


  
  const loadSessionInfo = async () => {
    if (!sessionId) return;
    
    try {
      const data = await loadSessionInfoFromHook(sessionId);
      if (data) {
        if (data.panels) {
          setComicData(data.panels);
        }
        if (data.stage) {
          setCurrentStage(data.stage);
        }
        if (data.stage === 'comic_context' && data.focusedPanel) {
          setFocusedPanel(data.focusedPanel);
        } else {
          setFocusedPanel(null);
        }
      }
    } catch (error) {
      console.error('Error loading session info:', error);
    }
  };



  const startChatbot = async (preset?: Preset) => {
    console.log('startChatbot called with preset:', preset);
    console.log('dyadId value:', dyadId);
    setIsLoading(true);
    try {
      const data = await startChatbotFromHook(preset);
      if (data) {
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
        Alert.alert('오류', '챗봇을 시작할 수 없습니다.');
      }
    } catch (error) {
      console.error('Failed to start chatbot:', error);
      Alert.alert('오류', '챗봇을 시작할 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const startChatbotWithSuggestion = async () => {
    console.log('startChatbotWithSuggestion called');
    console.log('dyadId value:', dyadId);
    setIsLoading(true);
    try {
      const data = await startChatbotWithSuggestionFromHook();
      if (data) {
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
        
        console.log('Chatbot started with suggestion successfully');
      } else {
        Alert.alert('오류', '챗봇을 시작할 수 없습니다.');
      }
    } catch (error) {
      console.error('Failed to start chatbot with suggestion:', error);
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

    // Revision_1에서 다음 단계로 넘어가는 기준이 달성될 때 고정 메시지를 먼저 추가
    if (currentStage === 'revision_1' && 
        ((messageText === '아니' || messageText === '아니요') || 
         (messageText === '응' || messageText === '네'))) {
      
      // 고정 메시지를 즉시 추가
      const fixedMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: '다행이다:) 그럼 네가 확인해준 내용을 내가 그림으로 그려볼게! 잠깐만 기다려줘~',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, fixedMessage]);
    }

    try {
      const data = await sendMessageFromHook(sessionId, messageText);
      if (data) {
        setCurrentStage(data.stage);
        
        const botMessage: ChatMessage = {
          id: (Date.now() + 2).toString(),
          text: data.response,
          isUser: false,
          timestamp: new Date(),
        };

        // 완료 메시지 감지 (5초 후 칭찬 섹션 표시)
        if (data.response.includes('우와~ 이렇게 멋진 그림 일기 완성이라니!')) {
          console.log('Completion message detected, will show praise section in 5 seconds...');
          setCompletionMessage(data.response);
          setMessages(prev => [...prev, botMessage]);
          
          // 5초 후에 칭찬 섹션 표시
          setTimeout(() => {
            setShowPraiseSection(true);
          }, 5000);
        }
        // comic_context 메시지는 바로 표시 (만화 생성 완료 시 onComplete에서 "다행이다~" 메시지가 제거됨)
        else if (data.stage === 'comic_context') {
          console.log('Comic context message detected, adding immediately...');
          setMessages(prev => [...prev, botMessage]);
        } else if (data.stage === 'revision_2' && data.response.includes('완성! 이제 수정하거나 추가하고 싶은 부분 있어? 🤔')) {
          // Revision_2에서 만화 생성이 시작될 때 고정 메시지 추가
          console.log('Revision_2 comic generation detected, adding fixed message...');
          
          const fixedMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            text: '내가 물어보는 질문에 잘 답해줘서 고마워. 네 덕분에 비어있던 부분을 채울 수 있을 것 같아! 조금만 기다려줘~',
            isUser: false,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, fixedMessage]);
          
          // revision_2 메시지는 바로 표시 (만화 생성 완료 시 onComplete에서 고정 메시지가 제거됨)
          setMessages(prev => [...prev, botMessage]);
        } else {
          // 다른 메시지들은 바로 표시
          setMessages(prev => [...prev, botMessage]);
        }
        
        // 세션 정보에서 최신 패널 데이터 가져오기 (만화 생성이 진행 중이지 않을 때만)
        if (comicGenerationStatus.status !== 'generating' && !isComicCompleted) {
          console.log('Loading session info after message sent...');
          await loadSessionInfo();
        } else {
          console.log('Skipping session info load - comic generation in progress or completed');
        }
        
        // React Query가 자동으로 만화 생성 상태를 폴링하므로 수동 호출 불필요
        if (data.stage === 'comic_context' || data.stage === 'revision_2') {
          console.log('Comic generation stage detected:', data.stage);
        }
        
        // auto_comic_generation 플래그 확인
        console.log('Response data:', data);
        console.log('auto_comic_generation flag:', data.auto_comic_generation);
        if (data.auto_comic_generation && !isComicCompleted) {
          console.log('Auto comic generation detected, starting in 0.5 seconds...');
          
          // 만화 생성 상태 모니터링 시작
          setTimeout(async () => {
            try {
              // 만화 생성 시작 (프로그레스바와 연결됨)
              if (sessionId) {
                console.log('Starting comic generation with progress tracking...');
                // 패널 내용을 빈 객체로 시작 (실제로는 서버에서 자동 생성)
                startGeneration({});
              }
              
              // auto-comic-generation API 호출
              const autoData = await startAutoComicGenerationFromHook(sessionId);
              if (autoData) {
                
                // 만화가 화면에 렌더링될 시간을 주기 위해 0.2초 대기
                setTimeout(async () => {
                  setCurrentStage(autoData.stage);
                  
                  const autoBotMessage: ChatMessage = {
                    id: (Date.now() + 3).toString(),
                    text: autoData.response,
                    isUser: false,
                    timestamp: new Date(),
                  };
                  
                  setMessages(prev => [...prev, autoBotMessage]);
                  
                  // 세션 정보 다시 로드 (한 번만)
                  if (!isComicCompleted) {
                    await loadSessionInfo();
                  }
                }, 200); // 만화 렌더링을 위한 0.2초 대기
              }
            } catch (error) {
              console.error('Failed to start auto comic generation:', error);
            }
          }, 200);
        }
        
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
      loadPeopleFromHook(placeId);
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
          dayInfo: []
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
    // 자유롭게 시작하기는 항상 아무 정보 없이 시작
    await startChatbot();
  };

  // 요일에 맞는 장소들 필터링 (DB 데이터 사용)
  const getLocationsForToday = () => {
    const today = getCurrentDay();
    return places.filter(place => {
      const dayKey = today.toLowerCase() as keyof typeof place;
      return place[dayKey] === true;
    });
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
            네가 말해준 내용으로 내가 여기에 조금 이따 4컷 만화를 그릴거야~
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

  // 인사말 섹션이 표시되어야 하는 경우
  if (showFarewellSection) {
    return (
      <FarewellSection 
        childName={childName} 
        onComplete={handleFarewellComplete}
      />
    );
  }

  // 칭찬 섹션이 표시되어야 하는 경우
  if (showPraiseSection) {
    return (
      <PraiseSection 
        childName={dyadName || "친구"}
        agentConfig={agentConfig}
        onComplete={handlePraiseComplete}
      />
    );
  }

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* 만화 생성 로딩 오버레이 - 제거하고 왼쪽 만화일기 섹션에서 표시 */}
      
      <View className="flex-1 bg-gray-100">
        {showPresetSelection ? (
          // 선택 화면 (전체 화면)
          <View className="flex-1 p-6">
            <ScrollView className="flex-1">
              {/* 상단 메시지 */}
              <View className="pt-8 pb-20">
                <View className="bg-white rounded-3xl p-6 shadow-lg w-full">
                  <View className="flex-row items-center">
                    <Image 
                      source={
                        agentConfig?.avatar_image 
                          ? (agentConfig.avatar_image.startsWith('http') 
                              ? { uri: agentConfig.avatar_image }
                              : getImageSource(agentConfig.avatar_image))
                          : require('../../../../assets/robot.png')
                      }
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        resizeMode: 'cover',
                        marginRight: 12
                      }}
                    />
                    <Text className="text-xl text-gray-800 leading-relaxed flex-1 text-center" style={{ fontFamily: 'NanumSquareNeo-dEb' }}>
                      {selectionStep === 'location' 
                        ? '오늘은 어디서 있었던 일을 그림 일기로 써볼까?'
                        : '거기서 누구랑 있었던 일을 그림 일기로 써볼까? 여러명이면 여러명을 선택해!'
                      }
                    </Text>
                  </View>
                </View>
              </View>

              {selectionStep === 'location' ? (
                <>
                  
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
                      // API 데이터가 없을 때 빈 상태 표시
                      <View className="p-6 border-2 border-gray-200 rounded-xl bg-white">
                        <Text className="text-lg font-semibold text-gray-500 text-center">
                          장소 정보를 불러올 수 없습니다
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  {/* 자유롭게 시작하기 버튼들 */}
                  <View className="border-t-2 border-gray-200 pt-6 mt-6">
                    <TouchableOpacity
                      className="bg-blue-500 rounded-xl p-4"
                      style={{ marginBottom: 20 }}
                      onPress={startChatbotWithSuggestion}
                      disabled={isLoading}
                    >
                      <Text className="text-white text-lg font-semibold text-center">
                        {isLoading ? '시작 중...' : '뭘 쓸지 모르겠네..'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="bg-blue-500 rounded-xl p-4"
                      onPress={handleFreeStart}
                      disabled={isLoading}
                    >
                      <Text className="text-white text-lg font-semibold text-center">
                        {isLoading ? '시작 중...' : '오늘은 내가 쓰고 싶은 게 있어!'}
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
                      // API 데이터가 없을 때 빈 상태 표시
                      <View className="p-4 border-2 border-gray-200 rounded-xl bg-white">
                        <Text className="text-center font-semibold text-gray-500">
                          사람 정보를 불러올 수 없습니다
                        </Text>
                      </View>
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
              <View className="flex-1 relative">
                {/* 기존 만화 또는 기본 메시지 */}
                <View className={`flex-1 ${comicGenerationStatus.status === 'generating' ? 'opacity-30' : ''}`}>
                  {comicData && (currentStage === 'revision_1' || currentStage === 'comic_context' || currentStage === 'revision_2' || currentStage === 'complete') ? (
                    renderComicPanels()
                  ) : (
                    <View className="flex-1 items-center justify-center">
                      <Text className="text-lg text-gray-600 text-center">
                      네가 말해준 내용으로 내가 여기에 조금 이따 4컷 만화를 그릴거야~
                      </Text>
                    </View>
                  )}
                </View>
                
                {/* 만화 생성 중일 때 반투명 오버레이와 프로그레스 바 */}
                {comicGenerationStatus.status === 'generating' && (
                  <View className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center">
                    <View className="bg-white p-6 rounded-xl shadow-lg max-w-sm w-4/5">
                      {/* 로딩 애니메이션 */}
                      <View className="flex-row justify-center mb-4">
                        <View className="flex-row space-x-1">
                          {[0, 1, 2].map((i) => (
                            <View
                              key={i}
                              className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"
                              style={{
                                opacity: 0.6,
                                transform: [{ scale: 0.8 }],
                              }}
                            />
                          ))}
                        </View>
                      </View>

                      {/* 메시지 */}
                      <Text className="text-center mb-4 text-lg font-semibold text-gray-800">
                        {comicGenerationStatus.message}
                      </Text>

                      {/* 프로그레스 바 */}
                      <View className="w-full bg-gray-200 rounded-full h-2 mb-2 overflow-hidden">
                        <Animated.View
                          className="bg-blue-500 h-2 rounded-full"
                          style={{
                            width: progressAnimation.interpolate({
                              inputRange: [0, 100],
                              outputRange: ['0%', '100%'],
                            }),
                          }}
                        />
                      </View>

                      {/* 프로그레스 퍼센트 */}
                      <Text className="text-center text-sm text-gray-600">
                        {Math.round(comicGenerationStatus.progress)}% 완료
                      </Text>

                      {/* 추가 설명 */}
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* 오른쪽: 채팅 섹션 */}
            <View className="flex-1 bg-white">
              {/* 채팅 헤더 */}
              <View className="bg-blue-500 p-4">
                <Text className="text-xl font-bold text-white">💬 {agentName}와 대화하기</Text>
              </View>

              {/* 현재 Agent 메시지 */}
              <View className="flex-1 p-3 bg-gray-50">
                {(() => {
                  const lastBotMessage = messages
                    .filter(m => !m.isUser)
                    .pop();
                  
                  if (messages.length === 0) {
                    return (
                      <View className="items-center justify-center py-8">
                        <Text className="text-base text-gray-600 text-center">
                          왼쪽에서 시작하기를 눌러주세요!
                        </Text>
                      </View>
                    );
                  }
                  
                  // Revision_1에서 고정 메시지가 이미 추가되었는지 확인
                  const showFixedMessage = false; // 이제 sendMessage에서 직접 추가하므로 여기서는 표시하지 않음
                  
                  if (showFixedMessage) {
                    return (
                      <View className="items-start">
                        <View className="bg-white border border-gray-200 p-3 rounded-lg max-w-[90%]">
                          <Text className="text-sm text-gray-800">
                            다행이다:) 그럼 네가 확인해준 내용을 내가 그림으로 그려볼게! 잠깐만 기다려줘~
                          </Text>
                        </View>
                      </View>
                    );
                  }
                  
                  if (isLoading) {
                    return (
                      <View className="items-start">
                        <View className="bg-white border border-gray-200 p-3 rounded-lg">
                          <View className="flex-row items-center">
                            <ActivityIndicator size="small" color="#666" />
                            <Text className="text-gray-600 ml-2 text-sm">{agentName}가 생각 중...</Text>
                          </View>
                        </View>
                      </View>
                    );
                  }
                  
                  if (lastBotMessage) {
                    return (
                      <View className="items-start">
                        <View className="bg-white border border-gray-200 p-3 rounded-lg max-w-[90%]">
                          <Text className="text-sm text-gray-800">
                            {lastBotMessage.text}
                          </Text>
                        </View>
                      </View>
                    );
                  }
                  
                  return null;
                })()}
              </View>

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
                    editable={!isLoading && comicGenerationStatus.status !== 'generating'}
                  />
                  <TouchableOpacity
                    className={`px-6 py-3 rounded-xl ${
                      isLoading || !inputText.trim() || comicGenerationStatus.status === 'generating' ? 'bg-gray-400' : 'bg-blue-500'
                    }`}
                    onPress={() => sendMessage(inputText)}
                    disabled={isLoading || !inputText.trim() || comicGenerationStatus.status === 'generating'}
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