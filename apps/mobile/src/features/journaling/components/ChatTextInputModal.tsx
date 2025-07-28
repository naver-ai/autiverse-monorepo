import React, { useCallback, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { styleTemplates } from '../../../styles';
import * as yup from 'yup';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { TailwindButton } from '../../../components/TailwindButton';
import { Modal } from '../../../components/Modal';

const schema = yup.object().shape({
  message: yup.string().trim().required('Message is required'),
}).required();

export const ChatTextInputModal = ({
  visible,
  onSubmitText,
  onClose
}: {
  visible: boolean;
  onSubmitText: (message: string) => void;
  onClose: () => void;
}) => {

  const inputRef = useRef<TextInput>(null);

  const { t } = useTranslation();
  const { reset, control, register, handleSubmit, formState: { errors, isSubmitting, isValid } } = useForm({
    resolver: yupResolver(schema),
    mode: 'onChange',
  });

  const handleClose = useCallback(()=>{
    inputRef.current?.blur();
    onClose();
    reset();
  }, [reset, onClose]);

  const onSubmit = useCallback((data: { message: string }) => {
    onSubmitText(data.message);
    handleClose();
  }, [onSubmitText, handleClose]);

  useEffect(()=>{
    if(visible){
      inputRef.current?.focus();
    }
  }, [visible]);

  return (
    <Modal 
      visible={visible}
      panelClassName='bg-white rounded-3xl p-10 px-10 flex-row items-center w-full'
      dismissOnPressOutside={true}
      onPop={handleClose}
    >
      <Controller
        control={control}
        name="message"
        rules={{ required: true }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            ref={inputRef}
            className={'flex-1 border-2 rounded-xl px-4 py-2 mr-3 text-lg h-18 border-gray-200'}
            placeholder={t('Chat.Placeholder')}
            onChangeText={onChange}
            onBlur={onBlur}
            value={value}
            onSubmitEditing={handleSubmit(onSubmit)}
            style={styleTemplates.withSemiboldFont}
          />
          )}
      />

      <TailwindButton
        title={isSubmitting ? t('Chat.SubmittingMessage') : t('Chat.SendButton')}
        onPress={handleSubmit(onSubmit)}
        buttonStyleClassName="bg-blue-500 px-6 py-3 h-18"
        disabledButtonStyleClassName='bg-gray-400'
        titleClassName="text-white"
        roundedClassName="rounded-xl"
        disabled={!isValid || isSubmitting}
      /></Modal>
  );
}; 