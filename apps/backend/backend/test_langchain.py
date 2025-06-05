import asyncio
import sys
import locale
from enum import Enum, auto
from typing import Dict, Any, Set, List, Tuple, Optional
from datetime import datetime
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from backend.utils.environment import get_env_variable, EnvironmentVariables
import json
from dataclasses import dataclass
import random

class ConversationMilestone(Enum):
    EVENTS_COLLECTED = "✓ 1. Collected 2-3 simple things that happened there"
    STORY_SUMMARIZED = "✓ 2. Summarized the story in simple steps"

class ConversationState(Enum):
    ASK_EVENTS = auto()
    SUMMARIZE = auto()
    FAREWELL = auto()

@dataclass
class EventAnalysis:
    """
    A class to analyze and track events in the conversation.
    This is the main class used for event analysis throughout the application.
    """
    events_identified: List[str]
    special_interests_mentioned: List[str]
    conversation_summary: str
    should_proceed: bool
    comic_panels: Optional[Dict[str, Optional[str]]] = None

    @classmethod
    def create_empty(cls) -> 'EventAnalysis':
        return cls(
            events_identified=[],
            special_interests_mentioned=[],
            conversation_summary="No conversation yet.",
            should_proceed=False,
            comic_panels=None
        )

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'EventAnalysis':
        return cls(
            events_identified=data.get('events_identified', []),
            special_interests_mentioned=data.get('special_interests_mentioned', []),
            conversation_summary=data.get('conversation_summary', 'No conversation yet.'),
            should_proceed=len(data.get('events_identified', [])) >= 2,
            comic_panels=data.get('comic_panels')
        )

class ScheduleConfig:
    # Combined day information with Korean names and schedules
    DAY_INFO = {
        'Monday': {
            'name': '월요일',
            'locations': ['학교', '센터', '태권도장']
        },
        'Tuesday': {
            'name': '화요일',
            'locations': ['학교']
        },
        'Wednesday': {
            'name': '수요일',
            'locations': ['학교', '센터', '태권도장']
        },
        'Thursday': {
            'name': '목요일',
            'locations': ['학교']
        },
        'Friday': {
            'name': '금요일',
            'locations': ['학교', '센터', '태권도장']
        },
        'Saturday': {
            'name': '토요일',
            'locations': ['애버랜드']
        },
        'Sunday': {
            'name': '일요일',
            'locations': ['집']
        }
    }

    LOCATION_PEOPLE = {
        '학교': ['선생님', '영호', '소현이'],
        '센터': ['선생님', '정은이'],
        '태권도장': ['관장님', '사범님', '미경이'],
        '집': ['엄마', '아빠', '연선이', '할머니']
    }

    @classmethod
    def get_locations_for_day(cls, day: str) -> List[str]:
        return cls.DAY_INFO.get(day, {'locations': []})['locations']

    @classmethod
    def get_people_for_location(cls, location: str) -> List[str]:
        return cls.LOCATION_PEOPLE.get(location, [])

    @classmethod
    def get_korean_day(cls, day: str) -> str:
        return cls.DAY_INFO.get(day, {'name': '오늘'})['name']

class ConversationContext:
    def __init__(self, location: str = "", people: List[str] = None):
        self.location = location
        self.people = people if people is not None else ScheduleConfig.get_people_for_location(location)
        self.events = []  # List of events in sequence
        self.conversation_memory = []
        self.mentioned_interests = set()
        self.last_analysis: Optional[EventAnalysis] = None
    
    def add_event(self, event: str):
        """Add an event to the sequence"""
        if event not in self.events:
            self.events.append(event)

    def add_conversation(self, user_input: str, bot_response: str):
        """Track conversation history with event-focused summary"""
        self.conversation_memory.append({
            "user": user_input,
            "bot": bot_response,
            "timestamp": datetime.now().strftime("%H:%M:%S")
        })

    def update_from_analysis(self, analysis: EventAnalysis):
        """Update context based on conversation analysis"""
        self.last_analysis = analysis
        self.events = analysis.events_identified
        self.mentioned_interests.update(analysis.special_interests_mentioned)

    def get_conversation_summary(self) -> str:
        """Get the latest analyzed summary of the conversation"""
        if not self.last_analysis:
            return "No conversation analysis available yet."
        
        summary = [self.last_analysis.conversation_summary]
        
        if self.last_analysis.events_identified:
            summary.append("\n확인된 사건들:")
            for event in self.last_analysis.events_identified:
                summary.append(f"- {event}")
        
        if self.last_analysis.special_interests_mentioned:
            summary.append("\n언급된 관심사:")
            for interest in self.last_analysis.special_interests_mentioned:
                summary.append(f"- {interest}")
        
        return "\n".join(summary)

    def get_event_summary(self) -> str:
        """Get a summary of all events"""
        if not self.last_analysis or not self.last_analysis.events_identified:
            return "\n".join(f"{event}" for event in self.events)
        return "\n".join(self.last_analysis.events_identified)

    def is_valid_location(self) -> bool:
        """Check if current location is valid for today"""
        today = datetime.now().strftime("%A")
        valid_locations = ScheduleConfig.get_locations_for_day(today)
        return self.location in valid_locations

class PromptFactory:
    """
    Factory class for generating various prompts used in the conversation.
    Contains speaking rules, character background, and state-specific prompts.
    """
    @staticmethod
    def get_speaking_rules_block() -> str:
        return """
            [General Speaking Rules]
            1. Use informal Korean (반말) like talking to a peer friend. Do not use honorifics.
            2. Keep responses short and simple - one or two sentences maximum.
            3. Use emojis appropriately.
            4. Ask only one question per turn.
            5. Never apologize or say sorry.
            6. Cover only one topic or question in a message if possible, and move to the next upon the user's reaction.
            7. If the user brings up special interests, show interest but gently guide back to the main topic.
            8. If the user asks a question that should be asked to adults or unrelated to the conversation topic, then you can say, "I don't know," and go back to the conversation topic.

            IMPORTANT: Always respond in natural, teenage-friendly Korean."""

    @staticmethod
    def get_character_background() -> str:
        return """You are a 15-year-old Korean middle school student named Dodo (도도).
            You're having a friendly conversation with your autistic best friend, Yuchan (유찬, also 15, male).

            Yuchan's special interests:
            - Dinosaurs
            - Counting things
            - Talking to himself

            Your goal is to help him create a 4-panel diary comic about his day."""

    @staticmethod
    def get_state_prompt(state: ConversationState, context: ConversationContext) -> str:
        prompts = {
            ConversationState.ASK_EVENTS: f"""
                Current objective: Help Yuchan identify events that happened today at {context.location} with {', '.join(context.people)}
                Current events collected: {', '.join(context.events) if context.events else 'None yet'}

                Recent conversation:
                {context.get_conversation_summary()}

                EVENT COLLECTION GUIDELINES:

                1. What is an Event?
                   - An event is a concrete action that happened today
                   - Focus on interaction sequences with people present
                   - Each interaction or step in the sequence counts as an event
                   Examples:
                   - Activity "그림 그리기" with family:
                     * "엄마가 스케치 하는 걸 도와주셨다"
                     * "아빠랑 같이 색칠했다"
                     * "완성된 그림을 냉장고에 붙였다"
                   - Activity "책 읽기" with parents:
                     * "아빠가 책장에서 책을 골라주셨다"
                     * "엄마랑 소파에 나란히 앉았다"
                     * "엄마가 책을 읽어주셨다"

                2. Conversation Flow:

                   A. When starting conversation:
                      - Keep initial question open and natural
                      - Let Yuchan lead with what he wants to share

                   B. When an activity is mentioned:
                      - Focus on interactions with people present
                      - Use context to ask about how they did it together
                      - Bad: "그림 그릴 때 어땠어?", "엄마 아빠는 뭐 하셨어?"
                      - Good: (if drawing is mentioned) "엄마랑은 어떤 걸 그렸어?" or "아빠도 같이 그림 그리는 거 도와주셨어?"

                   C. When special interests come up:
                      - Stay focused on the activity sequence
                      - Keep tracking interactions with family members
                      - Don't diverge from the main activity

                   D. When collecting sequence:
                      - Follow the natural flow of interactions
                      - Pay attention to each person's role in the activity
                      - Look for clear beginning-middle-end sequence
                      - Move to next phase when sequence is complete

                3. Conversation Rules:
                   - Keep responses natural and conversational
                   - Focus on interactions and shared moments
                   - Use context from previous responses
                   - Let Yuchan's responses guide the conversation
                   - Use appropriate emojis naturally

                IMPORTANT: 
                - Focus on interaction sequences with people present
                - Track how family members participated in the activity
                - Let the sequence emerge through natural conversation
                - Each interaction in the sequence counts as an event
                - Look for clear progression of events with people involved""",

            ConversationState.SUMMARIZE: f"""
                Current objective: Confirm the story details
                Location: {context.location}
                People: {', '.join(context.people)}
                Events: {context.get_event_summary()}

                - Thank them for sharing their story
                - Don't mention panels or comic structure""",

            ConversationState.FAREWELL: """
                Current objective: End the conversation positively"""
        }
        return prompts.get(state, "")

class Chatbot:
    def __init__(self, location: str = "", people: List[str] = None):
        self.state = ConversationState.ASK_EVENTS
        self.completed_milestones: Set[ConversationMilestone] = set()
        self.context = ConversationContext(location=location, people=people if people else [])
        self.llm = ChatOpenAI(
            model="gpt-4o-mini",
            openai_api_key=get_env_variable(EnvironmentVariables.OPENAI_API_KEY)
        )
        self.invalid_response_count = 0
        self.max_invalid_responses = 3
        self.last_analysis: Optional[EventAnalysis] = None

    def get_base_prompt(self) -> str:
        return "\n\n".join([
            PromptFactory.get_speaking_rules_block(),
            PromptFactory.get_character_background(),
            "IMPORTANT: Always respond in natural, teenage-friendly Korean."
        ])

    def get_state_prompt(self) -> str:
        return PromptFactory.get_state_prompt(self.state, self.context)

    async def analyze_conversation(self) -> EventAnalysis:
        """Analyze the entire conversation to track events and maintain context"""
        try:
            if not self.context.conversation_memory:
                empty_analysis = EventAnalysis.create_empty()
                self.context.update_from_analysis(empty_analysis)
                return empty_analysis

            # Prepare conversation history
            conversation = []
            for entry in self.context.conversation_memory:
                conversation.extend([
                    f"유찬: {entry['user']}",
                    f"친구: {entry['bot']}"
                ])
            conversation_text = "\n".join(conversation)

            analysis_prompt = f"""
            You are an expert at analyzing conversations to identify concrete events and special interests.

            CONTEXT:
            Location: {self.context.location}
            People: {', '.join(self.context.people)}
            Current events: {', '.join(self.context.events) if self.context.events else 'None'}

            CONVERSATION:
            {conversation_text}

            TASK:
            1. Find sequences of events from different activities that happened today
            2. Note any special interests mentioned (dinosaurs, counting, self-talk)
            3. Summarize the conversation
            4. Create a natural 4-panel comic flow using ONLY the events that were explicitly mentioned

            IMPORTANT RULES FOR COMIC PANELS AND SUMMARIES:
            - NEVER mention this conversation itself (user-bot interaction)
            - Use ONLY the exact words and events mentioned by Yuchan
            - Each panel must be a complete diary sentence in first-person past tense ("나는 ~했다" format)
            - Identifying separate actions:
              * Different subjects doing different things are separate actions
                - Bad (Combined): "아빠는 와구와구 먹고, 엄마는 나한테 피자 떠줬다"
                - Good (Separate):
                  * "아빠는 와구와구 피자를 먹었다"
                  * "엄마는 나한테 피자를 떠줬다"
              * Same subject doing different things are separate actions
                - Bad (Combined): "나는 학교에 가서 공부하고 운동장에서 놀았다"
                - Good (Separate):
                  * "나는 학교에서 공부했다"
                  * "나는 운동장에서 놀았다"
              * Only combine details about the exact same action
                - Good (Combined): "나는 엄마랑 티라노사우르스 그림을 그렸다"
                - Good (Combined): "나는 필통을 가지고 오징어 해체쇼를 했다"
            - Panel content rules:
              * Panels 1-3: ONLY actual actions and events
              * Panel 4: Feelings and emotions about the events
              * Emotions and feelings MUST go in panel 4:
              * NEVER assume or infer emotions - use ONLY explicitly stated feelings
              * Words indicating emotions (must be in panel 4):
                - 기쁘다, 신나다, 재미있다, 좋다
                - 슬프다, 속상하다, 화나다
                - 무섭다, 긴장된다, 떨린다
                - 힘들다, 피곤하다, 지친다
            - Story flow guidelines:
              * Each panel should naturally lead into the next one
              * Previous panels should provide context for later panels
              * Events must be arranged in chronological order
              * Panels should only be null when there is truly no content for that part of the story
            - When summarizing events:
              * Focus on what actually happened to the user
              * Remove user-bot conversation context
              * Keep it direct and concise
            - When user describes something imaginatively:
              * Understand it's often a metaphor or play-acting
              * Look for the actual action being described
              * Combine all related descriptions into one coherent event
              * Bad (Split): 
                - "나는 엄마랑 그림을 그렸다" + "나는 공룡을 그렸다" (같은 그리기 행동)
                - "나는 엄마랑 공룡 그림을 그렸다" + "나는 티라노사우르스를 그렸다" (티라노사우르스가 바로 그 공룡임)
                - "나는 오징어 해체쇼를 했다" + "나는 필통을 오징어처럼 해체했다" (실제로는 필통을 가지고 논 하나의 행동)
              * Good (Combined): 
                - "나는 엄마랑 티라노사우르스 그림을 그렸다"
                - "나는 필통을 가지고 오징어 해체쇼를 했다"
            - DO NOT add any details that weren't explicitly stated
            - DO NOT make assumptions about who was involved or what happened
            - Arrange events in a natural story flow across the panels
            - For each null panel, include the reason why it's null in parentheses as part of the value

            Return ONLY a JSON object with this structure:
            {{
                "events_identified": ["이벤트 설명"], - List of events that happened
                "special_interests_mentioned": ["관심 주제"],
                "conversation_summary": "대화 내용 요약",
                "should_proceed": false, - true if we have at least 2 events
                "comic_panels": {{
                    "panel1": null (첫번째로 이야기하는 이벤트 넣기),
                    "panel2": null (왜 1,3번 사이를 비웠는지 flow를 기반으로 설명),
                    "panel3": null (왜 2,4번 사이를 비웠는지 flow를 기반으로 설명),
                    "panel4": null (기분이나 감정이 없는 경우 null로 유지)
                }}
            }}

            Example response for walking at school:
            {{
                "events_identified": [
                    "학교에서 내가 길을 가고 있었다",
                    "선생님이 나를 혼냈다"
                ],
                "special_interests_mentioned": [],
                "conversation_summary": "학교에서 길을 가다가 선생님께 혼이 났다",
                "should_proceed": true,
                "comic_panels": {{
                    "panel1": "학교에서 내가 길을 가고 있었다",
                    "panel2": "null (길을 가는데 선생님이 왜 혼냈는지 알 수 없음)",
                    "panel3": "선생님이 나를 혼냈다",
                    "panel4": "null (기분을 이야기하지 않음)"
                }}
            }}

            Example response for TV watching:
            {{
                "events_identified": [
                    "집에서 엄마, 아빠와 TV로 런닝맨을 봤다",
                    "유재석이 발차기를 하는 장면이 나왔다",
                    "나는 그 부분이 가장 웃겼다"
                ],
                "special_interests_mentioned": [],
                "conversation_summary": "집에서 가족들과 런닝맨을 보다가 유재석의 발차기 장면을 보고 웃었다",
                "should_proceed": true,
                "comic_panels": {{
                    "panel1": "집에서 엄마, 아빠와 TV로 런닝맨을 봤다",
                    "panel2": "null (유재석이 왜 발차기를 했는지 이전 상황을 알 수 없음)",
                    "panel3": "유재석이 발차기를 하는 장면이 나왔다",
                    "panel4": "나는 그 부분이 가장 웃겼다"
                }}
            }}
            """

            messages = [
                SystemMessage(content="You are a conversation analyzer. Return ONLY a valid JSON object."),
                HumanMessage(content=analysis_prompt)
            ]

            try:
                response = await self.llm.ainvoke(messages)
                content = response.content.strip()
                
                # Remove markdown code block if present
                if content.startswith('```'):
                    content = content.split('```')[1]
                    if content.startswith('json'):
                        content = content[4:].strip()
                
                # Parse JSON and create EventAnalysis
                result = json.loads(content)
                
                # Print the analysis result
                print("\n=== 대화 분석 결과 ===")
                print(json.dumps(result, ensure_ascii=False, indent=2))
                print("=====================\n")
                
                analysis = EventAnalysis.from_dict(result)
                
                # Update context with new analysis
                self.context.update_from_analysis(analysis)
                self.last_analysis = analysis
                
                return analysis
                
            except json.JSONDecodeError as e:
                print(f"JSON parsing error: {str(e)}")
                empty_analysis = EventAnalysis.create_empty()
                self.context.update_from_analysis(empty_analysis)
                return empty_analysis
                
        except Exception as e:
            print(f"Error in analysis: {str(e)}")
            empty_analysis = EventAnalysis.create_empty()
            self.context.update_from_analysis(empty_analysis)
            return empty_analysis

    async def should_transition(self, user_input: str, response: str) -> bool:
        if self.state == ConversationState.ASK_EVENTS:
            analysis = await self.analyze_conversation()
            
            # Update context with new events
            for event in analysis.events_identified:
                if event not in self.context.events:
                    self.context.add_event(event)
            
            return analysis.should_proceed
        
        return True  # Auto-transition for other states

    def is_conversation_complete(self) -> bool:
        return (
            self.state == ConversationState.FAREWELL
            and len(self.context.location) > 0
            and len(self.context.people) > 0
            and len(self.context.events) >= 2
        )

    def is_events_complete(self) -> bool:
        """Check if we have collected enough events to complete the comic."""
        return len(self.context.events) >= 2

    def get_final_summary(self) -> str:
        """Generate the final summary of the comic diary."""
        summary = "\n=== 최종 4컷 만화 일기 내용 ===\n"
        summary += f"장소: {self.context.location}\n"
        summary += f"함께한 사람들: {', '.join(self.context.people)}\n"
        summary += "\n만화 컷:\n"

        if self.last_analysis and hasattr(self.last_analysis, 'comic_panels'):
            panels = self.last_analysis.comic_panels
            for i in range(1, 5):
                panel_key = f"panel{i}"
                panel_content = panels.get(panel_key)
                if panel_content:
                    summary += f"{i}컷: {panel_content}\n"
                else:
                    summary += f"{i}컷: ?\n"
        else:
            # Fallback to simple event list if comic_panels not available
            for i, event in enumerate(self.context.events, 1):
                summary += f"{i}컷: {event}\n"

        return summary

    def transition_state(self):
        self.invalid_response_count = 0  # Reset counter on state transition
        
        # If we have enough events, go straight to farewell
        if self.state == ConversationState.ASK_EVENTS and self.is_events_complete():
            self.state = ConversationState.FAREWELL
            return

        state_transitions = {
            ConversationState.ASK_EVENTS: ConversationState.ASK_EVENTS,  # Stay in events if not complete
            ConversationState.SUMMARIZE: ConversationState.FAREWELL
        }
        if self.state in state_transitions:
            self.state = state_transitions[self.state]

    def update_milestones(self, user_input: str) -> None:
        if self.state == ConversationState.ASK_EVENTS and len(self.context.events) >= 2:
            self.completed_milestones.add(ConversationMilestone.EVENTS_COLLECTED)
        elif self.state == ConversationState.SUMMARIZE:
            self.completed_milestones.add(ConversationMilestone.STORY_SUMMARIZED)

    async def process_message(self, user_input: str) -> str:
        try:
            messages = [
                SystemMessage(content=self.get_base_prompt() + "\n\n" + self.get_state_prompt()),
                HumanMessage(content=user_input)
            ]
            
            response = await self.llm.ainvoke(messages)
            response_content = response.content

            # Track conversation
            self.context.add_conversation(user_input, response_content)

            # Analyze conversation and update context
            analysis = await self.analyze_conversation()
            if analysis.should_proceed:
                self.update_milestones(user_input)
                self.transition_state()
                
                # If we just completed event collection, end with farewell
                if self.is_events_complete():
                    return "오늘 이런 일이 있었구나! 그 이야기로 만화 일기를 만들어보자!👋"
                
                # Generate new response for the new state
                messages = [
                    SystemMessage(content=self.get_base_prompt() + "\n\n" + self.get_state_prompt()),
                    HumanMessage(content=user_input)
                ]
                response = await self.llm.ainvoke(messages)
                response_content = response.content
                self.context.add_conversation(user_input, response_content)
            
            return response_content
            
        except Exception as e:
            print(f"Error in process_message: {str(e)}")
            return "미안미안! 다시 이야기해줄래? 🙏"

async def run_chatbot():
    # Set up proper encoding for input/output
    if sys.platform == 'win32':
        sys.stdin.reconfigure(encoding='utf-8')
        sys.stdout.reconfigure(encoding='utf-8')
    else:
        # For Unix-like systems (macOS, Linux)
        import io
        sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8', errors='replace')
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    
    # Check if we have preset values
    preset_location = "학교"  # You can set this based on your needs
    preset_people = ["선생님", "영호"]  # You can set this based on your needs

    if preset_location and preset_people:
        # Use preset values
        chatbot = Chatbot(location=preset_location, people=preset_people)
        print("\n=== 유찬이와의 4컷 만화 일기 만들기 ===")
        print(f"\n그럼 오늘 {preset_location}에서 {', '.join(preset_people)}랑 있었던 일 중 어떤 걸 만화 일기로 써볼까?")
    else:
        # Use day-based initialization
        today = datetime.now().strftime("%A")
        korean_day = ScheduleConfig.get_korean_day(today)
        locations = ScheduleConfig.get_locations_for_day(today)

        if locations:
            # Randomly select one location from today's schedule
            selected_location = random.choice(locations)
            default_people = ScheduleConfig.get_people_for_location(selected_location)
            chatbot = Chatbot(location=selected_location, people=default_people)
            
            print("\n=== 유찬이와의 4컷 만화 일기 만들기 ===")
            print(f"\n친구: 어디에서 있었던 일을 이야기할지 잘 안 떠올랐구나!\n{korean_day}이니 {selected_location}에 갔다 왔겠네~ 거기서 재미있는 일 있었어? 🤔")
        else:
            chatbot = Chatbot()
            print("\n=== 유찬이와의 4컷 만화 일기 만들기 ===")
            print("\n친구: 오늘 어디 갔다 왔어? 재미있는 일 없었어? 🤔")

    while True:
        try:
            print("\n유찬: ", end='', flush=True)
            try:
                user_input = input().strip()
            except UnicodeDecodeError:
                # If there's an encoding error, try to read raw bytes and decode with replacement
                raw_input = sys.stdin.buffer.readline()
                user_input = raw_input.decode('utf-8', errors='replace').strip()
            
            if not user_input:
                continue
                
            if user_input.lower() in ['quit', '종료']:
                print("\n대화종료")
                break
            
            response = await chatbot.process_message(user_input)
            print(f"\n친구: {response}")
            
            # Print summary only after showing the farewell message
            if chatbot.is_events_complete():
                print("\n=== 대화 종료 ===")
                print(chatbot.get_final_summary())
                break
            
        except Exception as e:
            print(f"\n오류가 발생했습니다: {str(e)}")
            import traceback
            print(traceback.format_exc())

if __name__ == "__main__":
    asyncio.run(run_chatbot())