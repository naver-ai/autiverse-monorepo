import { DeviceInfo } from "@autiverse-monorepo/ts-core";
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform } from "react-native";


let privateDeviceInfoCache: DeviceInfo | null = null

export async function getDeviceId(): Promise<string> {
    return ( Platform.OS =='ios' ? (await Application.getIosIdForVendorAsync()) : ( Platform.OS == 'android' ? Application.getAndroidId() : "unknown") ) || "unknown"
}

export function isAndroidEmulator(): boolean {
    return Platform.OS == 'android' && Device.isDevice == false
}

export async function getDeviceInfo(): Promise<DeviceInfo> {

    if(privateDeviceInfoCache){
        return privateDeviceInfoCache
    }else{                  
        privateDeviceInfoCache = {
            app: "autiverse",
            app_version: Application.nativeApplicationVersion || "unknown",
            device_id: await getDeviceId(),
            device_os: Device.osName || "unknown",
            device_os_version: Device.osVersion || "unknown",
        } 
    }

    return privateDeviceInfoCache
}