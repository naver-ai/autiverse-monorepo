export interface DeviceInfo{
    app: "autiverse";
    app_version: string;
    device_id: string;
    device_os: string;
    device_os_version: string;
    browser_name?: string | undefined;
    browser_version?: string | undefined;
  }

export interface DBModel {
    id: string;
    created_at: string;
    updated_at: string;
}

export enum UserLocale {
    Korean = "Korean",
    English = "English",
}

export enum CaregiverType {
    Mother = "mother",
    Father = "father",
    Teacher = "teacher",
}

export enum ChildGender {
    Boy = "boy",
    Girl = "girl",
}

export enum ProcessingStatus {
    Pending="pending",
    Processing="processing",
    Completed="completed",
    Failed="failed",
}

export interface Dyad extends DBModel {
    alias: string;
    passcode: string;
    locale: UserLocale;
    caregiver_type: CaregiverType;
    child_gender: ChildGender;
    child_name: string;
    child_age: number;

    agents: Agent[];
    people: Person[];
    places: Place[];

    journal_entries: []; //TODO define journal entry type
}

export type DyadInfo = Omit<Dyad, keyof DBModel | "agents" | "people" | "places" | "passcode">;


export interface AgentData {
    id: string;
    name: string;
    description: string;
    agent_config?: any;
  }

export interface ContextEntity extends DBModel {
    name: string;
    dyad_id: string;
}

export interface Agent extends DBModel {
    interest: string;
    agent_name: string;
    agent_config?: Record<string, any>;
    dyad_id: string;
}

export interface Person extends ContextEntity {
    avatar_config: {} | undefined
}


export interface Place extends ContextEntity {
    monday?: boolean | undefined;
    tuesday?: boolean | undefined;
    wednesday?: boolean | undefined;
    thursday?: boolean | undefined;
    friday?: boolean | undefined;
    saturday?: boolean | undefined;
    sunday?: boolean | undefined;

    people: Person[];
}
