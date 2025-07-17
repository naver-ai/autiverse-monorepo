import React from 'react';
import { View, Text, Animated, TouchableOpacity } from 'react-native';
import { ChatMessage } from '../types';
import { ComicPanel, ChatMessageComponent, ChatInput } from '../components';
import { convertComicDataToPanels } from '../utils';
import { styleTemplates } from '../../../styles';
import { LogoImage } from '../../../components/svg-images';

interface ChatStageProps {
  currentStage: string;
  comicData: any;
  focusedPanel: string | null;
  comicGenerationStatus: any;
  progressAnimation: Animated.Value;
  messages: ChatMessage[];
  inputText: string;
  setInputText: (text: string) => void;
  sendMessage: (message: string) => void;
  isLoading: boolean;
  agentName: string;
  agentConfig?: any;
  onTTSComplete?: () => void;
  isInputActive?: boolean;
  sessionId?: string;
  loadSessionInfo?: (sessionId: string) => Promise<any>;
  isAfterFarewell?: boolean;
  onEndSession?: () => void;
}

export const ChatStage: React.FC<ChatStageProps> = ({
  currentStage,
  comicData,
  focusedPanel,
  comicGenerationStatus,
  progressAnimation,
  messages,
  inputText,
  setInputText,
  sendMessage,
  isLoading,
  agentName,
  agentConfig,
  onTTSComplete,
  isInputActive = true,
  sessionId,
  loadSessionInfo,
  isAfterFarewell = false,
  onEndSession
}) => {
  const convertComicDataToPanelsMemo = React.useMemo(() => {
    return convertComicDataToPanels(comicData);
  }, [comicData]);

  // 만화 패널 렌더링 함수
  const renderComicPanels = () => {
    if (!convertComicDataToPanelsMemo) {
      return (
        <View className="flex-1 items-center justify-center">
          <Text className="text-lg text-gray-600 text-center" style={styleTemplates.withSemiboldFont}>
            네가 말해준 내용으로 내가 여기에 조금 이따 4컷 만화를 그릴거야~
          </Text>
        </View>
      );
    }

    const renderPanel = (panelId: string, panelIndex: number) => {
      const panel = convertComicDataToPanelsMemo[panelId];
      const isHighlighted = focusedPanel === panelId;

      return (
        <ComicPanel
          key={panelId}
          panelId={panelId}
          panelIndex={panelIndex}
          panel={panel}
          isHighlighted={isHighlighted}
        />
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
    <View className="flex-1">
      <View className="flex-1 flex-row">
        {/* 왼쪽: 만화 섹션 */}
        <View className="flex-[1.8] bg-white border-r-2 border-gray-200">
          {/* 만화 헤더 */}
            <View className="flex-row justify-between items-center p-3 border-b border-gray-200 pt-4">
              <LogoImage width={150} height={30} />
              <TouchableOpacity
                onPress={onEndSession}
                className="bg-yellow-500 px-3 py-2 rounded-lg"
                activeOpacity={0.8}
              >
                <Text className="text-white font-semibold text-sm" style={styleTemplates.withBoldFont}>
                  종료
              </Text>
              </TouchableOpacity>
          </View>
          
          {/* 만화 콘텐츠 */}
          <View className="flex-1 relative">
            {/* 기존 만화 또는 기본 메시지 */}
            <View className={`flex-1 ${comicGenerationStatus.status === 'generating' ? 'opacity-30' : ''}`}>
              {comicData && (currentStage === 'revision_1' || currentStage === 'comic_context' || currentStage === 'revision_2' || currentStage === 'title' || currentStage === 'complete') ? (
                renderComicPanels()
              ) : (
                <View className="flex-1 items-center justify-center">
                  <Text className="text-lg text-gray-600 text-center" style={styleTemplates.withSemiboldFont}>
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
                  <Text className="text-center mb-4 text-lg font-semibold text-gray-800" style={styleTemplates.withBoldFont}>
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
                  <Text className="text-center text-sm text-gray-600" style={styleTemplates.withSemiboldFont}>
                    {Math.round(comicGenerationStatus.progress)}% 완료
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* 오른쪽: 채팅 섹션 */}
        <View className="flex-1 bg-white">
                  {/* 채팅 헤더 */}
        <View className="bg-blue-500 p-4">
          <Text className="text-2xl font-bold text-white" style={styleTemplates.withBoldFont}>💬 {agentName}와 대화하기</Text>
        </View>

          {/* 현재 Agent 메시지 */}
          <View className="flex-1 p-3 bg-gray-50">
            <ChatMessageComponent
              messages={messages}
              isLoading={isLoading}
              agentName={agentName}
              agentConfig={agentConfig}
              onTTSComplete={onTTSComplete}
            />
          </View>

          {/* 입력 영역 */}
          <ChatInput
            inputText={inputText}
            setInputText={setInputText}
            sendMessage={sendMessage}
            isLoading={isLoading}
            messages={messages}
            currentStage={currentStage}
            comicGenerationStatus={comicGenerationStatus}
            isInputActive={isInputActive}
            agentName={agentName}
            sessionId={sessionId}
            loadSessionInfo={loadSessionInfo}
            isAfterFarewell={isAfterFarewell}
          />
        </View>
      </View>


    </View>
  );
}; 