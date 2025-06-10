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
    locale: UserLocale;
    caregiver_type: CaregiverType;
    child_gender: ChildGender;
    child_name: string;
    child_age: number;

    interests: Interest[];
    people: Person[];
    places: Place[];
}

export type DyadInfo = Omit<Dyad, keyof DBModel>;

export interface ContextEntity extends DBModel {
    name: string;
    dyad_id: string;
}

export interface Interest extends ContextEntity {}

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
