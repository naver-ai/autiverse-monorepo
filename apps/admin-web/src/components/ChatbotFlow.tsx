import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { ComicDisplay } from './ComicDisplay';
import { StageIndicator } from './StageIndicator';
import { ChatbotFlow as ChatbotFlowUtil, ChatResponse, ComicData } from '../utils/chatbotFlow';

interface Preset {
  location: string;
  people: string[];
  label: string;
}

const PRESETS: Preset[] = [
  {
    location: "학교",
    people: ["민수"],
    label: "학교에서 민수와"
  },
  {
    location: "센터",
    people: ["선생님", "정은이"],
    label: "센터에서 선생님과"
  },
  {
    location: "태권도장",
    people: ["관장님", "사범님", "미경이"],
    label: "태권도장에서"
  },
  {
    location: "집",
    people: ["엄마", "아빠", "연선이", "할머니"],
    label: "집에서 가족과"
  },
  {
    location: "애버랜드",
    people: ["가족"],
    label: "애버랜드에서"
  }
];

export const ChatbotFlow: React.FC = () => {
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">만화일기 챗봇</h1>
          <div className="flex items-center space-x-4">
            {selectedPreset && (
              <div className="text-sm text-gray-600">
                📍 {selectedPreset.location} | 👥 {selectedPreset.people.join(', ')}
              </div>
            )}
            <StageIndicator stage={currentStage} />
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {showPresetSelection ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-2xl">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    만화일기 챗봇에 오신 것을 환영합니다! 🎨
                  </h3>
                  <p className="text-gray-600 mb-6">
                    오늘 있었던 일을 이야기해주시면 4컷 만화로 만들어드릴게요!
                  </p>
                  
                  <div className="mb-6">
                    <h4 className="text-md font-medium text-gray-900 mb-3">장소와 사람을 선택해주세요:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {PRESETS.map((preset, index) => (
                        <button
                          key={index}
                          onClick={() => startChatbot(preset)}
                          disabled={isLoading}
                          className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                        >
                          <div className="font-medium text-gray-900">{preset.label}</div>
                          <div className="text-sm text-gray-600">
                            {preset.location} • {preset.people.join(', ')}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-500 mb-3">또는 자유롭게 시작하기:</p>
                    <button
                      onClick={() => startChatbot()}
                      disabled={isLoading}
                      className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isLoading ? '시작 중...' : '자유롭게 시작하기'}
                    </button>
                  </div>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    만화일기 챗봇에 오신 것을 환영합니다! 🎨
                  </h3>
                  <p className="text-gray-600 mb-4">
                    오늘 있었던 일을 이야기해주시면 4컷 만화로 만들어드릴게요!
                  </p>
                  <button
                    onClick={() => startChatbot()}
                    disabled={isLoading}
                    className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isLoading ? '시작 중...' : '대화 시작하기'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                {isLoading && (
                  <div className="flex items-center space-x-2 text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span>도도가 생각 중...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          {messages.length > 0 && (
            <div className="border-t bg-white p-4">
              <ChatInput onSendMessage={sendMessage} isLoading={isLoading} />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-white border-l overflow-y-auto">
          <div className="p-4">
            {events.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">수집된 이벤트</h3>
                <div className="space-y-2">
                  {events.map((event, index) => (
                    <div key={index} className="p-3 bg-blue-50 rounded-lg">
                      <span className="text-sm text-blue-800">{event}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {summary && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">대화 요약</h3>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-800">{summary}</p>
                </div>
              </div>
            )}

            {comicData && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">현재 만화</h3>
                <ComicDisplay panels={comicData} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading }) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex space-x-2">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="메시지를 입력하세요..."
        disabled={isLoading}
        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={!message.trim() || isLoading}
        className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        전송
      </button>
    </form>
  );
}; 