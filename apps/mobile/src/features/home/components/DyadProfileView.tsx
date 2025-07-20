import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { useMemo, memo, useCallback } from "react";
import { useAuth } from "../../auth/hooks";
import { useQueries, useQuery } from "@tanstack/react-query";
import { endsWithJongsung, escapeLastJongsungFromKoreanName, NetworkHelper } from "@autiverse-monorepo/ts-core";
import { styleTemplates } from "../../../styles";
import { Image } from "expo-image";
import { twMerge } from "tailwind-merge";
import { TailwindButton } from "../../../components/TailwindButton";
import { router } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import { useDyad } from "../../../api/dyad";


const format = require('string-format')

const styles = StyleSheet.create({
    dyadLabel: {shadowColor: "black", shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.10, shadowRadius: 3.84},
})

export const DyadProfileView = memo(({containerClassName}: {containerClassName?: string}) => {


    const {t} = useTranslation();

    const {jwt, signOut} = useAuth()

    const {dyad} = useDyad()

    const dyadLabel = useMemo(()=>{

        if(dyad?.child_name != null){
            const childName = escapeLastJongsungFromKoreanName(dyad.child_name)
            return format(t(`Label.ChildAndCaregiverTemplate`), {child_name: childName, caregiver_type: t(`Label.CaregiverType.${dyad?.caregiver_type.toUpperCase()}`)})
        } else return undefined
    }, [dyad?.child_name, dyad?.caregiver_type, t])

    const onTripplePress = useCallback(()=>{
        Alert.alert(t("Auth.SignIn.ConfirmSignOut"), undefined, [{text: t("Auth.SignIn.Cancel"), style: 'cancel'}, {text: t("Auth.SignIn.SignOut"), onPress: () => {
            signOut()
        }, style: 'destructive'}], {cancelable: true})
    }, [t, signOut])

    const tripleTap = useMemo(()=>Gesture.Tap().runOnJS(true).maxDuration(600).numberOfTaps(3)
    .onStart(onTripplePress), [onTripplePress])

    return dyadLabel != null && <GestureDetector gesture={tripleTap}><View className={containerClassName}>
    <Text className={`text-2xl text-center text-slate-500`} style={styleTemplates.withSemiboldFont}>{dyadLabel}</Text>
</View></GestureDetector>
    })