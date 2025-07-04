import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ChatMessage } from '../types';

interface ChatInputProps {
  inputText: string;
  setInputText: (text: string) => void;
  sendMessage: (message: string) => void;
  isLoading: boolean;
  messages: ChatMessage[];
  currentStage: string;
  comicGenerationStatus: any;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputText,
  setInputText,
  sendMessage,
  isLoading,
  messages,
  currentStage,
  comicGenerationStatus
}) => {
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

  return (
    <View className="p-4 border-t-2 border-gray-200">
      {/* Yes/No 버튼 */}
      {showYesNoButtons && (
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
      )}
      
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
  );
}; 