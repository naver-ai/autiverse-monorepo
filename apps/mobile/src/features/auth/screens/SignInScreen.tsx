import { Platform, Text, TextInput, View } from "react-native"
import { styleTemplates } from "../../../styles"
import { Fragment, useCallback } from "react"
import { TailwindButton } from "../../../components/TailwindButton"
import { useAuth } from "../hooks"
import { useTranslation } from "react-i18next"
import { twMerge } from "tailwind-merge"
import { Control, useController, useForm } from "react-hook-form"
import colors from "tailwindcss/colors"
import * as yup from "yup"
import { yupResolver } from "@hookform/resolvers/yup"
import { LogoImage } from "../../../components/svg-images"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"

const passcodeInputClassName = twMerge("mt-4 text-xl text-center bg-white rounded-xl border-[#11111345] border-2 focus:border-teal-500 focus:border-[3px]", (Platform.OS == 'android' ? "py-3" : "pt-2.5 pb-3.5"))

const PasscodeInput = (props: {
    control: Control<yup.InferType<typeof schema>>,
    name: string,
    onSubmit?: () => void
}) => {

    const {field, fieldState: {error, invalid}} = useController(props as any)

    const {t} = useTranslation()

    return <TextInput 
    placeholder={t("Auth.SignIn.EnterPasscode")} 
    placeholderTextColor={colors.slate[400]} 
    style={styleTemplates.withSemiboldFont}
    textAlign="center"
    multiline={true}
    numberOfLines={1}
    className={passcodeInputClassName}
    keyboardType="numeric"
    inputMode="numeric"
    autoCapitalize="none"
    autoComplete="off"
    secureTextEntry={true}

    ref={field.ref}
    value={field.value}
    onChangeText={field.onChange}
    onBlur={field.onBlur}
    onSubmitEditing={props.onSubmit}
    blurOnSubmit={true}
    returnKeyType="go"
    />
}

const schema = yup.object({
    passcode: yup.string().length(6).required()
})

export const SignInScreen = () => {

    const {control, handleSubmit, setFocus, formState: {isValid, errors}, setError} = useForm({
        resolver: yupResolver(schema)
    })

    const {isSigningIn, signInError, signIn} = useAuth()

    const onSubmit = useCallback(handleSubmit(async (values) => {
        signIn(values)
    }), [handleSubmit, signIn])

    const {t} = useTranslation()

    return <View className="flex-1 items-center justify-center pb-[5%] bg-slate-50">
        <SafeAreaView className="items-stretch">
            <LogoImage className="justify-self-center" width={420} height={150} />
            {
                isSigningIn === true ? <Text className="text-center text-lg text-slate-500" style={styleTemplates.withBoldFont}>{t("Auth.SignIn.Authenticating")}</Text> : <Fragment>
                    {
                        signInError ? <Text className="text-center text-lg text-red-400 mt-4" style={styleTemplates.withBoldFont}>{t(`Auth.SignIn.Errors.${signInError}`)}</Text> : null
                    }
                    <PasscodeInput control={control} name="passcode" onSubmit={onSubmit}/>
                    <TailwindButton title={t("Auth.SignIn.SignIn")} containerClassName="mt-5" roundedClassName={"rounded-full"} 
                        titleClassName="text-white"
                        rippleColor="#f0f0f080"
                        disabled={!isValid}
                        disabledButtonStyleClassName="bg-[#e0e0e0]"
                        buttonStyleClassName="bg-[#f9aa33]"
                        onPress={onSubmit}
                        />
                </Fragment>
            }
            
        </SafeAreaView>
    </View>
}