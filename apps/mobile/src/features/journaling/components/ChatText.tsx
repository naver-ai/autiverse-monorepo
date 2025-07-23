import React, { useCallback, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { styleTemplates } from '../../../styles';
import * as yup from 'yup';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { TailwindButton } from '../../../components/TailwindButton';
import { useJournalingStore } from '../store';

const schema = yup.object().shape({
  message: yup.string().trim().required('Message is required'),
}).required();

export const ChatText = ({
  sendMessage,
  isDisabled,
  isVoiceMode,
  onFocus,
  showButtons = false
}: {
  sendMessage: (message: string) => void;
  isDisabled: boolean;
  isVoiceMode: boolean;
  onFocus: () => void;
  showButtons?: boolean;
}) => {
  const { t } = useTranslation();

  const { isLoading } = useJournalingStore();

  const { reset, control, register, handleSubmit, formState: { errors, isSubmitting, isValid } } = useForm({
    resolver: yupResolver(schema),
    mode: 'onChange',
  });

  const onSubmit = useCallback((data: { message: string }) => {
    sendMessage(data.message);
    reset();
  }, [sendMessage]);

  useEffect(() => {
    if (!isSubmitting) {
      reset();
    }
  }, [isSubmitting]);

  return (
    <View className="flex-row items-center">
      <Controller
        control={control}
        name="message"
        rules={{ required: true }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            className={`flex-1 border-2 rounded-xl px-4 mr-3 text-lg h-18 ${
              (isDisabled && !isVoiceMode) || showButtons ? 'border-gray-300 bg-gray-100' : 'border-gray-200'
            }`}
            placeholder={isVoiceMode ? t('Chat.VoiceModePlaceholder') : isSubmitting ? t('Chat.SubmittingMessage') : isLoading ? t('Chat.LoadingMessage') : ""}
            onChangeText={onChange}
            onBlur={onBlur}
            value={value}
            onSubmitEditing={handleSubmit(onSubmit)}
            onFocus={onFocus}
            editable={(!isDisabled || isVoiceMode) && !showButtons}
            style={styleTemplates.withSemiboldFont}
          />
          )}
      />

      <TailwindButton
        title={t('Chat.SendButton')}
        onPress={handleSubmit(onSubmit)}
        buttonStyleClassName="bg-blue-500 px-6 py-3 h-18"
        disabledButtonStyleClassName='bg-gray-400'
        titleClassName="text-white"
        roundedClassName="rounded-xl"
        disabled={isDisabled || !isValid || showButtons}
      />
    </View>
  );
}; 