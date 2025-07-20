import 'intl-pluralrules';
import i18next from "i18next";
import merge from 'merge';
import { ko, enUS, Locale } from "date-fns/locale"
import krTranslations from "./translations/kr";
import enTranslations from "./translations/en";
import { UserLocale } from "../types";

export async function initializeI18n(defaultLanguage: UserLocale = UserLocale.Korean, 
    fallbackLanguage: UserLocale = UserLocale.Korean,
    options: {
        middlewares?: Array<any>,
        resources?: {[locale: string]: any}
    } | undefined = undefined) {
    let i18nInstance = i18next

    if(options?.middlewares != null && options.middlewares.length > 0){
        for(const middleware of options.middlewares){
            i18nInstance = i18nInstance.use(middleware)
        }
    }

    await i18nInstance.init({
        fallbackLng: fallbackLanguage,
        lng: defaultLanguage,
        resources: merge.recursive(false, {
            [UserLocale.Korean]: {
                translation: krTranslations
            },
            [UserLocale.English]: {
                translation: enTranslations
            }
        }, options?.resources),
        react: {
            useSuspense: false
        },
        debug: false,
        initImmediate: false
    }, (err, t) => {
        if (err) {
            console.log("Error on initializing i18n - ", err)
        } else {
        }
    })
}

export const getLocale = (language: UserLocale | string): Locale => {
        switch (language) {
            case UserLocale.Korean:
                return ko
            case UserLocale.English:
                return enUS
            default:
                return enUS
        }
    }