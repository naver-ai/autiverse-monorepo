export default {
    "Welcome to React": "Welcome to React and react-i18next",
    Home: {
        ViewPastDiaries: "View Past Diaries",
        WriteDiary: "Write Diary",
        ContinueModal: {
            Message: "Would you like to continue the unfinished comic diary?",
            Continue: "Yes, let's continue!",
            StartNew: "No, I want to write a new one!"
        }
    },
    Journaling: {
        PresetSelection: {
            // TTS messages
            LocationSelectionMessage: "Where did you have an experience today that you'd like to write about in your comic diary?",
            PeopleSelectionMessageTemplate: "Who were you with at {location} when you had an experience you'd like to write about? You can choose multiple people!",
            
            // Button texts
            DontKnowWhatToWrite: "I don't know what to write...",
            IWantToWriteSomething: "I have something I want to write about today!",
            NextStepTemplate: "Next step ({count} people selected)",
            BackToLocation: "← Back to location selection",
            Preparing: "Preparing...",
            
            // Error messages
            LocationDataError: "Unable to load location data",
            PeopleDataError: "Unable to load people data",
        },
        AgentIntro: {
            // Greeting texts
            FirstVisitGreetingTemplate: "Hello, {child_name}. I'm {agent_name}, and I'll be writing comic diaries with you for 2 weeks. Nice to meet you!",
            ReturnVisitGreetingTemplate: "Hello, {child_name}. It's so nice to see you again.",
            
            // Loading and error messages
            Loading: "Loading...",
            DataLoadError: "Unable to load data.",
        },
        // JournalingScreen related texts
        Errors: {
            ChatbotStartError: "Unable to start chatbot.",
            MessageSendError: "Unable to send message.",
        },
        SessionEnd: {
            Title: "End Session",
            Message: "Are you sure you want to end the session?",
            Cancel: "Cancel",
            End: "End",
        },
        Messages: {
            NextButton: "Next",
            NextButtonPrompt: "Please press the next button",
            Revision1Confirmation: "Great!:) Then I'll draw what you confirmed for me! Please wait a moment~",
            Revision2Confirmation: "Thank you for answering my questions well. Thanks to you, I think I can fill in the missing parts! Please wait a moment~",
        },
        UserResponses: {
            No: ["No", "No"],
            Yes: ["Yes", "Yes"],
        },
        VoiceRecording: {
            CleanupError: "Error during voice recording cleanup:",
        },
        DefaultTitle: "Comic Diary",
    }
}