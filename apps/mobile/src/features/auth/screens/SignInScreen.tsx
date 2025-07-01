import { Platform, Text, TextInput, View, Alert } from "react-native"
import { styleTemplates } from "../../../styles"
import { Fragment, useCallback, useState } from "react"
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
import { useRouter } from "expo-router"

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
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const {control, handleSubmit, setFocus, formState: {isValid, errors}, setError} = useForm({
        resolver: yupResolver(schema)
    })

    const {t} = useTranslation()

    const onSubmit = useCallback(handleSubmit(async (values) => {
        if (!values.passcode.trim()) {
            Alert.alert("오류", "패스코드를 입력해주세요.");
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch("http://10.66.106.38:3000/api/v1/app/auth/passcode", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ passcode: values.passcode.trim() }),
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);
            
            const responseText = await response.text();
            console.log('Response text:', responseText);
            
            if (response.ok) {
                try {
                    const data = JSON.parse(responseText);
                    console.log('Parsed data:', data);
                    // Navigate directly to tablet-comic-chatbot screen with dyad info
                    router.push({
                        pathname: "/(app)/tablet-comic-chatbot",
                        params: { 
                            dyadId: data.dyad.id,
                            dyadName: data.dyad.alias,
                            passcode: values.passcode.trim()
                        }
                    });
                } catch (parseError) {
                    console.error('JSON parse error:', parseError);
                    console.error('Response text was:', responseText);
                    Alert.alert("오류", "서버 응답을 처리할 수 없습니다.");
                }
            } else {
                try {
                    const errorData = JSON.parse(responseText);
                    Alert.alert("인증 실패", errorData.detail || "잘못된 패스코드입니다.");
                } catch (parseError) {
                    console.error('Error response parse error:', parseError);
                    console.error('Error response text was:', responseText);
                    Alert.alert("인증 실패", `서버 오류: ${response.status}`);
                }
            }
        } catch (error) {
            console.error("Authentication error:", error);
            Alert.alert("오류", "서버 연결에 실패했습니다. 다시 시도해주세요.");
        } finally {
            setIsLoading(false);
        }
    }), [handleSubmit, router])

    return <View className="flex-1 items-center justify-center pb-[5%] bg-slate-50">
        <SafeAreaView className="items-stretch">
            <LogoImage className="justify-self-center" width={420} height={150} />
            {
                isLoading === true ? <Text className="text-center text-lg text-slate-500" style={styleTemplates.withBoldFont}>인증 중...</Text> : <Fragment>
                    <PasscodeInput control={control} name="passcode" onSubmit={onSubmit}/>
                    <TailwindButton title="시작하기" containerClassName="mt-5" roundedClassName={"rounded-full"} 
                        titleClassName="text-white"
                        rippleColor="#f0f0f080"
                        disabled={!isValid || isLoading}
                        disabledButtonStyleClassName="bg-[#e0e0e0]"
                        buttonStyleClassName="bg-[#f9aa33]"
                        onPress={onSubmit}
                        />
                </Fragment>
            }
            
        </SafeAreaView>
    </View>
}