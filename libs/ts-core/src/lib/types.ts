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

export interface AvatarConfig {
    avatar_type?: string;
    color?: string;
}

export interface Person extends ContextEntity {
    avatar_config: AvatarConfig | undefined
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
  intent?: MessageIntent | null;
  metadata?: Record<string, any> | null;
}

export interface Preset {
  location: string;
  people: string[];
  label: string;
  dayInfo?: string[];
}

export enum ComicGridItemType {
  Figure = "figure",
  Object = "object",
  Empty = "empty",
}

export interface ComicGridItem {
  type: ComicGridItemType;
  content: string;
  position: [number, number];
  action?: Array<{type: 'tell'|'emotion'|'think', content: string}>;
}

export interface ComicPanelInfo {
  content: string;
  place?: string;
  grid: Array<ComicGridItem>;
}

export interface IncompleteComicData {
  panel1?: ComicPanelInfo | string;
  panel2?: ComicPanelInfo | string;
  panel3?: ComicPanelInfo | string;
  panel4?: ComicPanelInfo | string;
}

export interface CompleteComicData {
  panel1: ComicPanelInfo;
  panel2: ComicPanelInfo;
  panel3: ComicPanelInfo;
  panel4: ComicPanelInfo;
}

// Backend API response types
export interface JournalingSessionInfo {
  journal_entry_id: string;
  stage: JournalEntryStage;
  status: string;
  location?: string | null;
  people?: string[] | null;
  events?: string[] | null;
  summary?: string | null;
  title?: string | null;
  panels?: IncompleteComicData | null;
  message_count: number;
  focusedPanel?: string | null;
  messages: ChatMessage[];
}

// Chatbot response types
export interface ChatbotResponse {
  journal_entry_id: string;
  message_id?: string | null;
  response: string;
  stage: string;
  focusedPanel?: string | null;
  intent?: MessageIntent | null;
  metadata?: Record<string, any> | null;
  data?: Record<string, any> | null;
}

export enum MessageIntent {
  InitialTitleConfirm = "initial_title_confirm",
  CustomTitleConfirm = "custom_title_confirm",
  PromptNext = "prompt_next",
  PromptEmotion = "prompt_emotion",
  
  PromptTextInput = "prompt_text_input",
  PromptOpenEndedAnswer = "prompt_open_ended_answer",
  PromptIssueExist = "prompt_issue_exist",
  PromptRevision2IssueExist = "prompt_revision2_issue_exist",
  StartComicGeneration = "start_comic_generation",
  TransitionToTitle="transition_to_title",

  AnswerPositive = "answer_positive",
  AnswerNegative = "answer_negative",
  AnswerNext = "answer_next",
  AnswerEmotion = "answer_emotion"
}

export interface GalleryComicItem {
  id: string | null;
  journal_entry_id: string;
  stage: JournalEntryStage;
  status: JournalEntryStatus;
  title: string | null;
  created_at: string | null;
  panels: ComicPanelInfo[];
  revision_2: any; // Journal 데이터 (stage별로 선택된 데이터)
  child_name: string;
  agent_name: string;
}

export interface GalleryResponse {
  dyad_id: string;
  comics: GalleryComicItem[];
}