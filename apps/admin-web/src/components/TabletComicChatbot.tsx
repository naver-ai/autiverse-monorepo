import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { TabletFourSceneComic } from './TabletFourSceneComic';
import { StageIndicator } from './StageIndicator';
import { ChatbotFlow as ChatbotFlowUtil, ChatResponse, ComicData } from '../utils/chatbotFlow';
import { Link } from '@tanstack/react-router';
import styled from '@emotion/styled';

interface Preset {
  location: string;
  people: string[];
  label: string;
  dayInfo?: string[];
}

// 요일별 장소 정보 (comic_intro.py 기반)
const DAY_INFO = {
  'Monday': {
    name: '월요일',
    locations: ['학교', '센터', '태권도장']
  },
  'Tuesday': {
    name: '화요일',
    locations: ['학교']
  },
  'Wednesday': {
    name: '수요일',
    locations: ['학교', '센터', '태권도장']
  },
  'Thursday': {
    name: '목요일',
    locations: ['학교']
  },
  'Friday': {
    name: '금요일',
    locations: ['학교', '센터', '태권도장']
  },
  'Saturday': {
    name: '토요일',
    locations: ['애버랜드']
  },
  'Sunday': {
    name: '일요일',
    locations: ['집']
  }
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

// Galaxy Tab S9 Fixed Size Container (2560 x 1600) - Desktop Simulation
const TabletContainer = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2560px;
  height: 1600px;
  background: #f5f5f5;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  max-width: 100vw;
  max-height: 100vh;
  transform: translate(-50%, -50%) scale(min(100vw / 2560, 100vh / 1600));
`;

const ComicSection = styled.div`
  flex: 1.8;
  background: white;
  padding: 12px;
  display: flex;
  flex-direction: column;
  border-right: 2px solid #e0e0e0;
  height: 100%;
  min-height: 0;
`;

const ChatSection = styled.div`
  flex: 1;
  background: white;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
`;

const ComicHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e0e0e0;
  height: 35px;
  flex-shrink: 0;
`;

const ComicTitle = styled.h1`
  font-size: 18px;
  font-weight: bold;
  color: #333;
  margin: 0;
`;

const ComicContent = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  height: 100%;
  overflow: hidden;
`;

const ChatHeader = styled.div`
  background: #4A90E2;
  color: white;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 50px;
  flex-shrink: 0;
`;

const ChatTitle = styled.h2`
  font-size: 24px;
  font-weight: bold;
  margin: 0;
`;

const ChatMessages = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  background: #f8f9fa;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
  min-height: 0;
  height: 100%;
  min-height: 300px;
`;

const ChatInputContainer = styled.div`
  padding: 24px;
  background: white;
  border-top: 2px solid #e0e0e0;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
`;

const PresetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin: 24px 0;
`;

const PresetButton = styled.button`
  padding: 20px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  background: white;
  text-align: left;
  transition: all 0.2s;
  font-size: 16px;
  min-height: 80px;
  
  &:hover {
    border-color: #4A90E2;
    background: #f0f8ff;
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const PresetLabel = styled.div`
  font-weight: bold;
  color: #333;
  margin-bottom: 6px;
`;

const PresetDetails = styled.div`
  font-size: 12px;
  color: #666;
`;

const WelcomeContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 48px;
`;

const WelcomeTitle = styled.h3`
  font-size: 32px;
  font-weight: bold;
  color: #333;
  margin-bottom: 24px;
`;

const WelcomeText = styled.p`
  font-size: 18px;
  color: #666;
  margin-bottom: 32px;
  line-height: 1.6;
`;

const LocationGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin: 24px 0;
  width: 100%;
  max-width: 600px;
`;

const LocationButton = styled.button`
  padding: 24px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  background: white;
  text-align: center;
  transition: all 0.2s;
  font-size: 18px;
  font-weight: bold;
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    border-color: #4A90E2;
    background: #f0f8ff;
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const PeopleGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin: 24px 0;
  width: 100%;
  max-width: 800px;
`;

const PersonButton = styled.button<{ selected: boolean }>`
  padding: 16px 12px;
  border: 2px solid ${props => props.selected ? '#4A90E2' : '#e0e0e0'};
  border-radius: 8px;
  background: ${props => props.selected ? '#4A90E2' : 'white'};
  color: ${props => props.selected ? 'white' : '#333'};
  text-align: center;
  transition: all 0.2s;
  font-size: 16px;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    border-color: #4A90E2;
    background: ${props => props.selected ? '#357ABD' : '#f0f8ff'};
  }
  
  &:active {
    transform: scale(0.98);
  }
`;

const BackButton = styled.button`
  padding: 12px 24px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 16px;
  
  &:hover {
    background: #5a6268;
  }
`;

const CompleteButton = styled.button`
  padding: 16px 32px;
  background: #4A90E2;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 16px;
  
  &:hover {
    background: #357ABD;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SelectionInfo = styled.div`
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  text-align: center;
`;

const StartButton = styled.button`
  padding: 24px 48px;
  background: #4A90E2;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 80px;
  min-width: 240px;
  
  &:hover {
    background: #357ABD;
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const InputForm = styled.form`
  display: flex;
  gap: 16px;
`;

const InputField = styled.input`
  flex: 1;
  padding: 16px 20px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  font-size: 16px;
  outline: none;
  min-height: 56px;
  
  &:focus {
    border-color: #4A90E2;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
  }
  
  &:disabled {
    opacity: 0.6;
  }
`;

const SendButton = styled.button`
  padding: 16px 32px;
  background: #4A90E2;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 56px;
  min-width: 80px;
  
  &:hover {
    background: #357ABD;
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const LoadingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  color: #666;
  font-size: 16px;
  padding: 15px;
`;

const LoadingSpinner = styled.div`
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #4A90E2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const YesNoButtons = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
`;

const YesNoButton = styled.button`
  flex: 1;
  padding: 16px 24px;
  background: #4A90E2;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 56px;
  
  &:hover {
    background: #357ABD;
    transform: translateY(-2px);
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const NoButton = styled(YesNoButton)`
  background: #6c757d;
  
  &:hover {
    background: #5a6268;
  }
`;

export const TabletComicChatbot: React.FC = () => {
  const [messages, setMessages] = useState<Array<{ id: string; text: string; isUser: boolean; timestamp: Date }>>([]);
  const [currentStage, setCurrentStage] = useState<string>('intro');
  const [isLoading, setIsLoading] = useState(false);
  const [comicData, setComicData] = useState<ComicData | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [chatbotFlow, setChatbotFlow] = useState<ChatbotFlowUtil | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [showPresetSelection, setShowPresetSelection] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [focusedPanel, setFocusedPanel] = useState<string | undefined>(undefined);
  
  // 2단계 선택을 위한 state
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [selectionStep, setSelectionStep] = useState<'location' | 'people'>('location');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // comicData 디버깅
  useEffect(() => {
    console.log('[DEBUG] comicData updated:', comicData);
    console.log('[DEBUG] currentStage:', currentStage);
  }, [comicData, currentStage]);

  const startChatbot = async (preset?: Preset) => {
    setIsLoading(true);
    try {
      const apiKey = import.meta.env.OPENAI_API_KEY;
      console.log('API Key exists:', !!apiKey);
      console.log('API Key length:', apiKey?.length);
      
      if (!apiKey) {
        throw new Error('OpenAI API 키가 설정되지 않았습니다.');
      }

      const chatbot = new ChatbotFlowUtil(apiKey);
      setChatbotFlow(chatbot);

      // Preset이 있으면 해당 정보로 초기화
      if (preset) {
        setSelectedPreset(preset);
        const response: ChatResponse = await chatbot.startWithPreset(preset.location, preset.people);
        setCurrentStage(response.stage);
        
        setMessages([{
          id: '1',
          text: response.response,
          isUser: false,
          timestamp: new Date()
        }]);

        if (response.data) {
          if (response.data.panels) setComicData(response.data.panels);
          if (response.data.events) setEvents(response.data.events);
          if (response.data.summary) setSummary(response.data.summary);
        }
      } else {
        // Preset 없이 시작
        const response: ChatResponse = await chatbot.start();
        setCurrentStage(response.stage);
        
        setMessages([{
          id: '1',
          text: response.response,
          isUser: false,
          timestamp: new Date()
        }]);

        if (response.data) {
          if (response.data.panels) setComicData(response.data.panels);
          if (response.data.events) setEvents(response.data.events);
          if (response.data.summary) setSummary(response.data.summary);
        }
      }

      setShowPresetSelection(false);
    } catch (error) {
      console.error('Error starting chatbot:', error);
      setMessages([{
        id: '1',
        text: '챗봇을 시작하는데 문제가 발생했습니다. API 키를 확인해주세요.',
        isUser: false,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (messageText: string) => {
    if (!chatbotFlow || !messageText.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      text: messageText,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response: ChatResponse = await chatbotFlow.sendMessage(messageText);
      
      const botMessage = {
        id: (Date.now() + 1).toString(),
        text: response.response,
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
      setCurrentStage(response.stage);

      if (response.data) {
        if (response.data.panels) setComicData(response.data.panels);
        if (response.data.events) setEvents(response.data.events);
        if (response.data.summary) setSummary(response.data.summary);
        if (response.data.focusedPanel) setFocusedPanel(response.data.focusedPanel);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: '죄송해요, 오류가 발생했어요. 다시 시도해주세요.',
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetChatbot = () => {
    setMessages([]);
    setCurrentStage('intro');
    setComicData(null);
    setEvents([]);
    setSummary('');
    setChatbotFlow(null);
    setSelectedPreset(null);
    setShowPresetSelection(true);
    // 2단계 선택 상태도 초기화
    setSelectedLocation(null);
    setSelectedPeople([]);
    setSelectionStep('location');
  };

  // 장소 선택 핸들러
  const handleLocationSelect = (location: string) => {
    setSelectedLocation(location);
    setSelectedPeople([]);
    setSelectionStep('people');
  };

  // 등장인물 선택/해제 핸들러
  const handlePersonToggle = (person: string) => {
    setSelectedPeople(prev => 
      prev.includes(person) 
        ? prev.filter(p => p !== person)
        : [...prev, person]
    );
  };

  // 선택 완료 핸들러
  const handleSelectionComplete = async () => {
    if (selectedLocation && selectedPeople.length > 0) {
      const customPreset: Preset = {
        location: selectedLocation,
        people: selectedPeople,
        label: `${selectedLocation}에서 ${selectedPeople.join(', ')}와`,
        dayInfo: PRESETS.find(p => p.location === selectedLocation)?.dayInfo || []
      };
      await startChatbot(customPreset);
    }
  };

  // 뒤로가기 핸들러
  const handleBackToLocation = () => {
    setSelectedLocation(null);
    setSelectedPeople([]);
    setSelectionStep('location');
  };

  // 현재 요일 가져오기
  const getCurrentDay = () => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long' });
  };

  // 요일에 맞는 장소들 필터링
  const getLocationsForToday = () => {
    const today = getCurrentDay();
    return PRESETS.filter(preset => preset.dayInfo?.includes(today));
  };

  // 자유롭게 시작하기 핸들러 (요일 기반 추천)
  const handleFreeStart = async () => {
    const todayLocations = getLocationsForToday();
    if (todayLocations.length > 0) {
      // 오늘 요일에 맞는 장소가 있으면 추천
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
      // 추천할 장소가 없으면 기존 방식으로 시작
      await startChatbot();
    }
  };

  // ComicData를 Record<string, Panel> 형태로 변환
  const convertComicDataToPanels = (comicData: ComicData | null) => {
    if (!comicData) return null;
    
    const panels: Record<string, any> = {};
    
    if (comicData.panel1) {
      panels.panel1 = {
        content: comicData.panel1.content || '',
        grid: comicData.panel1.grid || []
      };
    }
    if (comicData.panel2) {
      panels.panel2 = {
        content: comicData.panel2.content || '',
        grid: comicData.panel2.grid || []
      };
    }
    if (comicData.panel3) {
      panels.panel3 = {
        content: comicData.panel3.content || '',
        grid: comicData.panel3.grid || []
      };
    }
    if (comicData.panel4) {
      panels.panel4 = {
        content: comicData.panel4.content || '',
        grid: comicData.panel4.grid || []
      };
    }
    
    console.log('[DEBUG] Converted comicData to panels:', panels);
    return panels;
  };

  return (
    <TabletContainer>
      {/* 왼쪽: 4컷 만화 섹션 */}
      <ComicSection>
        <ComicHeader>
          <ComicTitle>🎨 만화일기</ComicTitle>
          <StageIndicator stage={currentStage} />
        </ComicHeader>
        
        <ComicContent>
          {showPresetSelection ? (
            <WelcomeContainer>
              <WelcomeTitle>만화일기 챗봇에 오신 것을 환영합니다! 🎨</WelcomeTitle>
              <WelcomeText>
                오늘 있었던 일을 이야기해주시면 4컷 만화로 만들어드릴게요!
              </WelcomeText>
              
              <div style={{ width: '100%', maxWidth: '800px' }}>
                {selectionStep === 'location' ? (
                  <>
                    <h4 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px', color: '#333' }}>
                      어디서 일어난 일인가요?
                    </h4>
                    <LocationGrid>
                      {PRESETS.filter(preset => (preset.dayInfo?.length || 0) >= 2).map((preset) => (
                        <LocationButton
                          key={preset.location}
                          onClick={() => handleLocationSelect(preset.location)}
                        >
                          {preset.location}
                        </LocationButton>
                      ))}
                    </LocationGrid>
                    
                    <div style={{ borderTop: '2px solid #e0e0e0', paddingTop: '20px', marginTop: '20px' }}>
                      <StartButton
                        onClick={() => handleFreeStart()}
                        disabled={isLoading}
                      >
                        {isLoading ? '시작 중...' : '자유롭게 시작하기'}
                      </StartButton>
                    </div>
                  </>
                ) : (
                  <>
                    <BackButton onClick={handleBackToLocation}>
                      ← 장소 다시 선택
                    </BackButton>
                    
                    <SelectionInfo>
                      <strong>선택된 장소:</strong> {selectedLocation}
                    </SelectionInfo>
                    
                    <h4 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px', color: '#333' }}>
                      누구와 함께 있었나요? (여러 명 선택 가능)
                    </h4>
                    <PeopleGrid>
                      {selectedLocation && PRESETS.find(p => p.location === selectedLocation)?.people.map((person: string) => (
                        <PersonButton
                          key={person}
                          selected={selectedPeople.includes(person)}
                          onClick={() => handlePersonToggle(person)}
                        >
                          {person}
                        </PersonButton>
                      ))}
                    </PeopleGrid>
                    
                    <CompleteButton
                      onClick={handleSelectionComplete}
                      disabled={selectedPeople.length === 0 || isLoading}
                    >
                      {isLoading ? '시작 중...' : `시작하기 (${selectedPeople.length}명 선택됨)`}
                    </CompleteButton>
                  </>
                )}
              </div>
            </WelcomeContainer>
          ) : comicData && (currentStage === 'revision_1' || currentStage === 'comic_context' || currentStage === 'revision_2' || currentStage === 'complete') ? (
            <TabletFourSceneComic 
              panels={convertComicDataToPanels(comicData) || {}} 
              focusedPanel={currentStage === 'comic_context' ? focusedPanel : undefined} 
            />
          ) : (
            <div style={{ textAlign: 'center', color: '#666', fontSize: '18px' }}>
              어떤 이야기로 오늘 만화 일기를 쓸지 도도와 이야기해보자!
            </div>
          )}
        </ComicContent>
      </ComicSection>

      {/* 오른쪽: 챗봇 섹션 */}
      <ChatSection>
        <ChatHeader>
          <ChatTitle>💬 도도와 대화하기</ChatTitle>
        </ChatHeader>

        <ChatMessages>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#666', fontSize: '16px', marginTop: '50px' }}>
              왼쪽에서 시작하기를 눌러주세요!
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isLoading && (
                <LoadingIndicator>
                  <LoadingSpinner />
                  <span>도도가 생각 중...</span>
                </LoadingIndicator>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </ChatMessages>

        {messages.length > 0 && (
          <ChatInputContainer>
            <ChatInput 
              onSendMessage={sendMessage} 
              isLoading={isLoading} 
              currentStage={currentStage}
              messages={messages}
            />
          </ChatInputContainer>
        )}
      </ChatSection>
    </TabletContainer>
  );
};

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  currentStage: string;
  messages: Array<{ id: string; text: string; isUser: boolean; timestamp: Date }>;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading, currentStage, messages }) => {
  const [message, setMessage] = useState('');
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleYesNoClick = (response: string) => {
    if (!isLoading) {
      onSendMessage(response);
    }
  };

  const handleEmotionClick = (emotion: string) => {
    if (selectedEmotions.includes(emotion)) {
      setSelectedEmotions(selectedEmotions.filter(e => e !== emotion));
    } else {
      setSelectedEmotions([...selectedEmotions, emotion]);
    }
  };

  const handleEmotionComplete = () => {
    if (selectedEmotions.length > 0 && !isLoading) {
      onSendMessage(selectedEmotions.join(', '));
      setSelectedEmotions([]);
    }
  };

  const showYesNoButtons = (() => {
    const lastBotMessage = messages
      .filter(m => !m.isUser)
      .pop()?.text;
    
    // revision_1에서 "여기서 틀린 부분 있어?" 또는 "이제 다 맞을까?" 질문일 때만 버튼 표시
    if (currentStage === 'revision_1') {
      return (lastBotMessage?.includes('여기서 틀린 부분 있어?') || 
              lastBotMessage?.includes('이제 다 맞을까?')) && 
             !isLoading && 
             message.trim() === '';
    }
    
    // revision_2에서 "수정하거나 추가하고 싶은 부분 있어?" 또는 "이제 다 맞을까?" 질문일 때만 버튼 표시
    if (currentStage === 'revision_2') {
      return (lastBotMessage?.includes('수정하거나 추가하고 싶은 부분 있어?') || 
              lastBotMessage?.includes('이제 다 맞을까?') ||
              lastBotMessage?.includes('일기 제목')) && 
             !isLoading && 
             message.trim() === '';
    }
    
    // comic_context에서 "좋아! 그럼 이제 만화를 더 완성해볼게!" 메시지일 때만 버튼 표시
    if (currentStage === 'comic_context') {
      return lastBotMessage?.includes('좋아! 그럼 이제 만화를 더 완성해볼게!') && 
             !isLoading && 
             message.trim() === '';
    }
    
    return false;
  })();

  const showEmotionButtons = (() => {
    const lastBotMessage = messages
      .filter(m => !m.isUser)
      .pop()?.text;
    
    // comic_context에서 "기분이 어땠어?" 질문일 때 감정 버튼 표시
    if (currentStage === 'comic_context') {
      return lastBotMessage?.includes('기분이 어땠어?') && 
             !isLoading && 
             message.trim() === '';
    }
    
    return false;
  })();

  const emotionButtons = [
    { text: '즐거웠다', emoji: '😊' },
    { text: '기뻤다', emoji: '😄' },
    { text: '행복했다', emoji: '🥰' },
    { text: '신났다', emoji: '🤩' },
    { text: '슬펐다', emoji: '😢' },
    { text: '화났다', emoji: '😠' },
    { text: '속상했다', emoji: '😞' },
    { text: '무서웠다', emoji: '😨' },
    { text: '두려웠다', emoji: '😰' },
    { text: '놀랐다', emoji: '😲' },
    { text: '감탄했다', emoji: '😍' },
    { text: '지루했다', emoji: '😴' }
  ];

  return (
    <>
      <YesNoButtons style={{ visibility: showYesNoButtons ? 'visible' : 'hidden' }}>
        <YesNoButton onClick={() => handleYesNoClick('응')}>
          응
        </YesNoButton>
        <NoButton onClick={() => handleYesNoClick('아니')}>
          아니
        </NoButton>
      </YesNoButtons>
      
      {showEmotionButtons && (
        <div style={{ 
          marginBottom: '16px',
          padding: '16px',
          backgroundColor: '#f8f9fa',
          borderRadius: '12px',
          border: '2px solid #e0e0e0'
        }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gap: '8px', 
            marginBottom: '12px'
          }}>
            {emotionButtons.map((emotion) => {
              const isSelected = selectedEmotions.includes(emotion.text);
              return (
                <button
                  key={emotion.text}
                  onClick={() => handleEmotionClick(emotion.text)}
                  disabled={isLoading}
                  style={{
                    padding: '12px 8px',
                    backgroundColor: isSelected ? '#28a745' : '#4A90E2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.6 : 1,
                    transition: 'all 0.2s ease',
                    minHeight: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    boxShadow: isSelected ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading && !isSelected) {
                      e.currentTarget.style.backgroundColor = '#357ABD';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isLoading && !isSelected) {
                      e.currentTarget.style.backgroundColor = '#4A90E2';
                    }
                  }}
                >
                  <span>{emotion.emoji}</span>
                  <span>{emotion.text}</span>
                </button>
              );
            })}
          </div>
          
          {selectedEmotions.length > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                marginBottom: '8px', 
                fontSize: '14px', 
                color: '#666',
                fontWeight: 'bold'
              }}>
                선택된 감정: {selectedEmotions.join(', ')}
              </div>
              <button
                onClick={handleEmotionComplete}
                disabled={isLoading}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.backgroundColor = '#218838';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.backgroundColor = '#28a745';
                  }
                }}
              >
                선택 완료
              </button>
            </div>
          )}
        </div>
      )}
      
      <InputForm onSubmit={handleSubmit}>
        <InputField
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="메시지를 입력하세요..."
          disabled={isLoading}
        />
        <SendButton
          type="submit"
          disabled={!message.trim() || isLoading}
        >
          전송
        </SendButton>
      </InputForm>
    </>
  );
}; 