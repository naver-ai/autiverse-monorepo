export enum UserButtonMode {
    YES_NO_BUTTON = "yes_no_button",
    EMOTION_BUTTON = "emotion_button",
    NEXT_BUTTON = "next_button"
}

export enum WebsocketEvent{
    ComicGenerationProgress = "comic_generation_progress",
    ComicGenerationCompleted = "comic_generation_completed",
    ComicGenerationStarted = "comic_generation_started",
    ComicGenerationError = "comic_generation_error",
}