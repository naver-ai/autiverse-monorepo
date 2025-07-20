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
        }
    }
}