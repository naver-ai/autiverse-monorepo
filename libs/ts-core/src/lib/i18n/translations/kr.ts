export default {
    Auth: {
        SignIn: {
            EnterPasscode: "사용자 번호를 입력해주세요.",
            SignIn: "로그인",
            Authenticating: "로그인 중입니다...",
            Errors: {
                ServerNotResponding: "서버가 응답하지 않습니다. 잠시 후에 다시 시도해 주세요.",
                WrongCredential: "사용자 번호가 올바른지 확인해 주세요.", 
                UnknownError: "로그인이 실패하였습니다. 담당자에게 문의해 주세요."
            },
            ConfirmSignOut: "로그아웃 하시겠습니까?",
            SignOut: "로그아웃",
            Cancel: "취소"
        },
    },
    Home: {
        ViewPastDiaries: "지난 일기 보기",
        WriteDiary: "일기 쓰기",
        ContinueModal: {
            Message: "이전에 완성하지 않은 그림일기를 이어서 써볼까?",
            Continue: "응, 그럴게!",
            StartNew: "아니, 새로운 거 쓸 거야!"
        }
    },
    Label: {
        CaregiverType: {
            FATHER: "아빠",
            MOTHER: "엄마",
            TEACHER: "선생님",
        },
        ChildAndCaregiverTemplate: "{child_name}와 {caregiver_type}",
    },
    Journaling: {
        PresetSelection: {
            // TTS 메시지들
            LocationSelectionMessage: "오늘은 어디서 있었던 일을 그림 일기로 써볼까?",
            PeopleSelectionMessageTemplate: "{location}에서 누구랑 있었던 일을 그림 일기로 써볼까? 여러 사람을 골라도 괜찮아!",
            
            // 버튼 텍스트들
            DontKnowWhatToWrite: "뭘 쓸지 모르겠네..",
            IWantToWriteSomething: "오늘은 내가 쓰고 싶은 게 있어!",
            NextStepTemplate: "다음 단계로 ({count}명 선택됨)",
            BackToLocation: "← 장소 다시 선택",
            Preparing: "준비 중...",
            
            // 에러 메시지들
            LocationDataError: "장소 정보를 불러올 수 없습니다",
            PeopleDataError: "사람 정보를 불러올 수 없습니다",
        },
        AgentIntro: {
            // 인사말 텍스트들
            FirstVisitGreetingTemplate: "안녕, {child_name}{child_josa}. 나는 2주간 너와 함께 그림 일기를 쓸 {agent_name}{agent_josa}. 만나서 반가워!",
            ReturnVisitGreetingTemplate: "안녕, {child_name}{child_josa}. 또 만나니 너무 좋다.",
            
            // 로딩 및 에러 메시지들
            Loading: "로딩 중...",
            DataLoadError: "데이터를 불러올 수 없습니다.",
        },
        // JournalingScreen 관련 텍스트들
        Errors: {
            ChatbotStartError: "챗봇을 시작할 수 없습니다.",
            MessageSendError: "메시지를 보낼 수 없습니다.",
        },
        SessionEnd: {
            Title: "세션 종료",
            Message: "정말로 세션을 종료하시겠습니까?",
            Cancel: "취소",
            End: "종료",
        },
        Messages: {
            NextButton: "다음",
            NextButtonPrompt: "다음 버튼을 눌러줘",
            Revision1Confirmation: "다행이다:) 그럼 네가 확인해준 내용을 내가 그림으로 그려볼게! 잠깐만 기다려줘~",
            Revision2Confirmation: "내가 물어보는 질문에 잘 답해줘서 고마워. 네 덕분에 비어있던 부분을 채울 수 있을 것 같아! 조금만 기다려줘~",
        },
        UserResponses: {
            No: ["아니", "아니요"],
            Yes: ["응", "네"],
        },
        VoiceRecording: {
            CleanupError: "음성 녹음 정리 중 오류:",
        },
        DefaultTitle: "그림 일기",
    }
}