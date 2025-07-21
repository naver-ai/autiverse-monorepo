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

    journal_entries: Array<JournalEntry>;
}

export type DyadInfo = Omit<Dyad, keyof DBModel | "agents" | "people" | "places" | "passcode">;

export enum JournalEntryStatus {
  Initial="initial",
  InProgress="in_progress",
  Completed="completed",
}

export enum JournalEntryStage {
  Prelim="prelim",
  Intro="intro",
  Revision1="revision_1",
  ComicContext="comic_context",
  Revision2="revision_2",
  Title="title",
  Complete="complete"
}

export interface JournalEntry extends DBModel {
    status: JournalEntryStatus;
    stage: JournalEntryStage;
    dyad_id: string;
}

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

// Mobile app specific types
export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export interface Preset {
  location: string;
  people: string[];
  label: string;
  dayInfo?: string[];
}

export interface ComicPanel {
  content: string;
  grid: any[];
}

export interface ComicData {
  panel1?: ComicPanel | string;
  panel2?: ComicPanel | string;
  panel3?: ComicPanel | string;
  panel4?: ComicPanel | string;
}
