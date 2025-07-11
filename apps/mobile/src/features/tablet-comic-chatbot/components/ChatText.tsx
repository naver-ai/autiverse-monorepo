import React from 'react';
import { View, TextInput, TouchableOpacity, Text } from 'react-native';
import { styleTemplates } from '../../../styles';

interface ChatTextProps {
  inputText: string;
  setInputText: (text: string) => void;
  sendMessage: (message: string) => void;
  isDisabled: boolean;
  isVoiceMode: boolean;
  onFocus: () => void;
  showButtons?: boolean;
}

export const ChatText: React.FC<ChatTextProps> = ({
  inputText,
  setInputText,
  sendMessage,
  isDisabled,
  isVoiceMode,
  onFocus,
  showButtons = false
}) => {
  return (
    <View className="flex-row items-center">
      <TextInput
        className={`flex-1 border-2 rounded-xl px-4 py-3 mr-3 text-base ${
          (isDisabled && !isVoiceMode) || showButtons ? 'border-gray-300 bg-gray-100' : 'border-gray-200'
        }`}
        placeholder={isVoiceMode ? "채팅으로 하려면 여기를 클릭하세요" : ""}
        value={inputText}
        onChangeText={setInputText}
        onSubmitEditing={() => {
          if (inputText.trim() && !isDisabled) {
            sendMessage(inputText);
          }
        }}
        onFocus={onFocus}
        editable={(!isDisabled || isVoiceMode) && !showButtons}
        style={{
          minHeight: 48,
          fontSize: 16,
          ...styleTemplates.withSemiboldFont,
        }}
      />
      <TouchableOpacity
        className={`px-6 py-3 rounded-xl ${
          isDisabled || showButtons
            ? 'bg-gray-400' 
            : 'bg-blue-500'
        }`}
        onPress={() => {
          if (inputText.trim() && !isDisabled && !showButtons) {
            sendMessage(inputText);
          }
        }}
        disabled={isDisabled || !inputText.trim() || showButtons}
        style={{
          minHeight: 48,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDisabled ? 0.05 : 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        <Text className="text-white font-semibold text-base" style={styleTemplates.withBoldFont}>전송</Text>
      </TouchableOpacity>
    </View>
  );
}; 