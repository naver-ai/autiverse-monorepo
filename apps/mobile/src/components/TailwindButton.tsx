import { ButtonProps, Pressable, View, Text, PressableProps } from "react-native";
import { styleTemplates } from "../styles";
import { useMemo } from "react";
import { twMerge } from 'tailwind-merge'

export const TailwindButton = (props: {
    containerClassName?: string
    roundedClassName?: string
    buttonStyleClassName?: string
    disabledButtonStyleClassName?: string
    disabledTitleClassName?: string
    titleClassName?: string,
    rippleColor?: string,
    shadowClassName?: string,
    title?: string,
    children?: any
} & Omit<ButtonProps, "title"> & PressableProps) => {

    const rippleConfig = useMemo(()=>{
        return {color: props.rippleColor || "##f9aa3330"}
    }, [props.rippleColor])

    const containerClassName = useMemo(()=>{
        return twMerge('overflow-hidden', props.shadowClassName || "shadow-lg shadow-slate-500/50", props.roundedClassName, props.containerClassName)
    }, [props.shadowClassName, props.roundedClassName, props.containerClassName])

    const buttonClassName = useMemo(()=>{
        return twMerge('items-center flex-row justify-center px-8 py-3 bg-white', props.buttonStyleClassName, props.roundedClassName, props.disabled === true ? (props.disabledButtonStyleClassName || "") : "")
    }, [props.buttonStyleClassName, props.roundedClassName, props.disabled, props.disabledButtonStyleClassName])

    const titleClassName = useMemo(()=>{
        return twMerge('text-lg text-center text-slate-600', props.titleClassName, props.disabled === true ? (props.disabledTitleClassName || "") : "")
    }, [props.titleClassName, props.disabled, props.disabledTitleClassName])

    return <View accessible={false} className={containerClassName} removeClippedSubviews={true}>
        <Pressable accessible={false} aria-selected={false} disabled={props.disabled} android_ripple={rippleConfig} onPress={props.onPress} onLongPress={props.onLongPress}
        className={buttonClassName}>
            {
                props.children || <Text className={titleClassName} style={styleTemplates.withBoldFont}>{props.title}</Text>
            }
        </Pressable></View>
}