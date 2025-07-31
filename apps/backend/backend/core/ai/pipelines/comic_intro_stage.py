import asyncio
import sys
import locale
from enum import Enum, auto
from typing import Dict, Any, Set, List, Tuple, Optional
from datetime import datetime
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field
from backend.utils.environment import get_env_variable, EnvironmentVariables
from backend.database.crud.chatbot import *
from sqlmodel import Session
import json
from dataclasses import dataclass
import random
import openai

class ConversationMilestone(Enum):
    EVENTS_COLLECTED = "✓ 1. Collected 2-3 simple things that happened there"
    STORY_SUMMARIZED = "✓ 2. Summarized the story in simple steps"

class ConversationState(Enum):
    ASK_EVENTS = auto()
    SUMMARIZE = auto()
    FAREWELL = auto()

class EventAnalysisResult(BaseModel):
    """Event analysis result"""
    events_identified: List[str] = Field(description="List of identified events")
    special_interests_mentioned: List[str] = Field(description="List of special interests mentioned")
    conversation_summary: str = Field(description="Summary of the conversation")
    should_proceed: bool = Field(description="Whether to proceed to next stage")
    comic_panels: Optional[Dict[str, Optional[str]]] = Field(description="Comic panels content")

class ConversationResponse(BaseModel):
    """Conversation response data"""
    response: str = Field(description="Generated conversation response")

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



class ComicIntroStage:
    def __init__(self, db: Session, journal_entry_id: str):
        self.db = db
        self.journal_entry_id = journal_entry_id
        self.child_name = self._get_child_name()
        self.child_age = self._get_child_age()
        self.child_gender = self._get_child_gender()
        self.agent_name = self._get_agent_name()
        self.agent_interests = self._get_agent_interests()
        
        # LangChain setup
        self.llm = ChatOpenAI(
            model="gpt-4.1-mini-2025-04-14",
            temperature=0.2,
            api_key=get_env_variable(EnvironmentVariables.OPENAI_API_KEY)
        )
        self.analysis_parser = PydanticOutputParser(pydantic_object=EventAnalysisResult)
        self.response_parser = PydanticOutputParser(pydantic_object=ConversationResponse)
    
    def _get_child_name(self) -> str:
        """dyad의 child_name을 가져오기"""
        from backend.database.crud.chatbot import get_journal_entry, get_dyad_by_id
        
        journal_entry = get_journal_entry(self.db, self.journal_entry_id)
        if journal_entry and journal_entry.dyad:
            return journal_entry.dyad.child_name
        return "사용자"  # fallback
    
    def _get_child_age(self) -> int:
        """dyad의 child_age를 가져오기"""
        from backend.database.crud.chatbot import get_journal_entry
        
        journal_entry = get_journal_entry(self.db, self.journal_entry_id)
        if journal_entry and journal_entry.dyad:
            return journal_entry.dyad.child_age
        return 15  # fallback
    
    def _get_agent_name(self) -> str:
        """agent의 agent_name을 가져오기"""
        from backend.database.crud.chatbot import get_journal_entry
        
        journal_entry = get_journal_entry(self.db, self.journal_entry_id)
        if journal_entry and journal_entry.dyad and journal_entry.dyad.agents:
            # 첫 번째 agent의 이름을 사용
            return journal_entry.dyad.agents[0].agent_name
        return "도도"  # fallback
    
    def _get_agent_interests(self) -> list[str]:
        """agent의 interest 목록을 가져오기"""
        from backend.database.crud.chatbot import get_journal_entry
        
        journal_entry = get_journal_entry(self.db, self.journal_entry_id)
        if journal_entry and journal_entry.dyad and journal_entry.dyad.agents:
            # 모든 agent의 interest를 수집
            interests = []
            for agent in journal_entry.dyad.agents:
                if agent.interest:
                    interests.append(agent.interest)
            return interests
        return ["Dinosaurs", "Counting things", "Talking to himself"]  # fallback
    
    def _get_child_gender(self) -> str:
        """dyad의 child_gender를 가져오기"""
        from backend.database.crud.chatbot import get_journal_entry
        
        journal_entry = get_journal_entry(self.db, self.journal_entry_id)
        if journal_entry and journal_entry.dyad:
            return journal_entry.dyad.child_gender
        return "male"  # fallback
    
    def start_conversation(self, location: str = None, people: List[str] = None) -> Message:
        """대화 시작"""
        # Journal entry stage 업데이트
        update_journal_entry_stage(self.db, self.journal_entry_id, JournalEntryStage.Intro)
        
        # Journal 데이터 업데이트
        journal = get_journal(self.db, self.journal_entry_id)
        if journal:
            update_journal_data(
                self.db, self.journal_entry_id,
                location=location,
                people=people
            )
        
        # 첫 번째 interaction turn 생성
        interaction_turn = create_interaction_turn(
            self.db, self.journal_entry_id, JournalEntryStage.Intro
        )
        
        # 초기 메시지 생성
        initial_message = self._generate_intro_message(location, people)
        message = create_message(
            self.db, self.journal_entry_id, interaction_turn.id,
            initial_message, MessageRole.Assistant, JournalEntryStage.Intro
        )
        
        return message
    
    def start_conversation_with_suggestion(self) -> Message:
        """대화 시작 (뭘 쓸지 모르겠네 버튼용)"""
        # Journal entry stage 업데이트
        update_journal_entry_stage(self.db, self.journal_entry_id, JournalEntryStage.Intro)
        
        # Journal 데이터 업데이트 (DB에서 장소와 사람 정보 가져와서 저장)
        journal = get_journal(self.db, self.journal_entry_id)
        if journal:
            # DB에서 장소와 사람 정보 가져오기
            from backend.database.crud.chatbot import get_dyad_places, get_place_people
            dyad = get_journal_entry(self.db, self.journal_entry_id).dyad
            places = get_dyad_places(self.db, dyad.id)
            people = get_place_people(self.db, dyad.id)
            
            # 첫 번째 장소와 사람 사용
            location = places[0].name if places else None
            people_list = [p.name for p in people[:2]] if people else []  # 최대 2명
            
            update_journal_data(
                self.db, self.journal_entry_id,
                location=location,
                people=people_list
            )
        
        # 첫 번째 interaction turn 생성
        interaction_turn = create_interaction_turn(
            self.db, self.journal_entry_id, JournalEntryStage.Intro
        )
        
        # 초기 메시지 생성 (suggestion 모드)
        initial_message = self._generate_suggestion_message()
        message = create_message(
            self.db, self.journal_entry_id, interaction_turn.id,
            initial_message, MessageRole.Assistant, JournalEntryStage.Intro
        )
        
        return message
    
    async def process_message(self, user_message: str, intent: MessageIntent | None = None, audio_filename: str = None) -> Message:
        """사용자 메시지 처리"""
        # 현재 interaction turn 가져오기
        interaction_turn = self._get_or_create_interaction_turn(JournalEntryStage.Intro)
        
        # 사용자 메시지 저장 (audio_filename 포함)
        create_message(
            self.db, self.journal_entry_id, interaction_turn.id,
            user_message, MessageRole.User, JournalEntryStage.Intro,
            intent=intent,
            audio_filename=audio_filename
        )
        
        # 봇 응답 생성
        bot_response, response_intent = await self._generate_response(user_message, intent)
        
        # 봇 응답 저장
        message = create_message(
            self.db, self.journal_entry_id, interaction_turn.id,
            bot_response, MessageRole.Assistant, JournalEntryStage.Intro,
            intent=response_intent
        )
        
        return message
    
    async def analyze_events(self) -> Dict[str, Any]:
        """이벤트 분석 - Structured Output 사용"""
        messages = get_messages_by_journal_entry(self.db, self.journal_entry_id)
        
        # 대화 내용 추출
        conversation = []
        for msg in messages:
            if msg.role == MessageRole.User:
                conversation.append(f"{self.child_name}: {msg.content}")
            elif msg.role == MessageRole.Assistant:
                conversation.append(f"친구: {msg.content}")
        
        conversation_text = "\n".join(conversation)
        
        system_prompt = f"""You are an expert at analyzing conversations to identify concrete events and special interests.

TASK:
1. Find sequences of events from different activities that happened today
2. Note any special interests mentioned ({', '.join(self.agent_interests)})
3. Summarize the conversation
4. Create a natural 4-panel comic flow using ONLY the events that were explicitly mentioned

IMPORTANT RULES FOR COMIC PANELS AND SUMMARIES:
- NEVER mention this conversation itself (user-bot interaction)
- Use ONLY the exact words and events mentioned by {self.child_name}
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
  * Panels 1-3: ONLY use events from events_identified list in chronological order
  * Panel 4: ONLY use emotions/feelings from events_identified list
  * Each panel MUST correspond to an event in events_identified
  * NEVER include content that is not in events_identified
  * NEVER infer or create events that were not explicitly mentioned by {self.child_name}
  * Events in events_identified MUST be explicitly stated by {self.child_name}, not assumed or inferred
  * Words indicating emotions (must be in events_identified to use in panel 4):
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

Generate a structured analysis result.


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
}}"""

        user_prompt = f"""CONTEXT:
Location: {self._get_location()}
People: {', '.join(self._get_people())}

CONVERSATION:
{conversation_text}"""

        # Retry logic for structured output
        max_retries = 3
        for attempt in range(max_retries):
            try:
                messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt)
                ]
                
                response = await self.llm.ainvoke(messages)
                result = self.analysis_parser.parse(response.content)
                
                # Convert to dict format for compatibility
                analysis = {
                    "events_identified": result.events_identified,
                    "special_interests_mentioned": result.special_interests_mentioned,
                    "conversation_summary": result.conversation_summary,
                    "should_proceed": result.should_proceed,
                    "comic_panels": result.comic_panels
                }
                
                # Journal에 분석 결과 저장
                update_journal_data(
                    self.db, self.journal_entry_id,
                    events=analysis.get("events_identified", []),
                    summary=analysis.get("conversation_summary", ""),
                    comic_intro=analysis.get("comic_panels", {})
                )
                
                print(f"Event Analysis Result: {json.dumps(analysis, ensure_ascii=False, indent=2)}")
                return analysis
                
            except Exception as e:
                print(f"Attempt {attempt + 1} failed: {e}")
                if attempt == max_retries - 1:
                    print("All retries failed for event analysis")
                    return {
                        "events_identified": [],
                        "special_interests_mentioned": [],
                        "conversation_summary": "Analysis failed",
                        "should_proceed": False,
                        "comic_panels": {}
                    }
                await asyncio.sleep(1)  # Brief delay before retry
    
    def is_ready_for_next_stage(self) -> bool:
        """다음 단계로 진행할 준비가 되었는지 확인"""
        journal = get_journal(self.db, self.journal_entry_id)
        if journal and journal.events:
            return len(journal.events) >= 2
        return False
    
    def _generate_intro_message(self, location: str = None, people: List[str] = None) -> str:
        """초기 인사 메시지 생성"""
        if location and people:
            # 사람들의 이름에 종성에 따른 조사 적용
            
            return f"오늘 {location}에서 {', '.join(people)}하고 무슨 일이 있었는지 너무 궁금해! 나한테 다 이야기해줘! 😊"
        else:
            return "대박대박!! 딱 쓰고 싶은 게 있었구나!! 오늘 있었던 무슨 일을 일기로 써볼까? 😊"
    
    def _generate_suggestion_message(self) -> str:
        """뭘 쓸지 모르겠네 버튼용 메시지 생성"""
        # DB에서 저장된 장소 정보 가져오기
        location = self._get_location()
        
        # 요일 정보 가져오기 (더 안전한 방법)
        from datetime import datetime
        today = datetime.now()
        weekday = today.weekday()  # 0=월요일, 1=화요일, ..., 6=일요일
        
        day_mapping = {
            0: '월요일',
            1: '화요일', 
            2: '수요일',
            3: '목요일',
            4: '금요일',
            5: '토요일',
            6: '일요일'
        }
        korean_day = day_mapping.get(weekday, '오늘')
        
        print(f"Debug - weekday: {weekday}, korean_day: {korean_day}")  # 디버깅용
        
        if location:
            return f"오늘 {korean_day}이니 {location}에 가지 않았어?? 거기서 있었던 일을 써볼까?"
        else:
            return "오늘 뭐했어? 😊"
    
    async def _generate_response(self, user_message: str, intent: MessageIntent | None = None) -> str:
        """사용자 메시지에 대한 응답 생성"""
        
        system_prompt = f"""[General Speaking Rules]
1. Use informal Korean like talking to a peer friend. Do not use honorifics.
2. Keep responses short and simple - one or two sentences maximum.
3. Use emojis appropriately.
4. Ask only one question per turn.
5. Never apologize or say sorry.
6. Cover only one topic or question in a message if possible, and move to the next upon the user's reaction.
7. If the user brings up special interests, show interest but gently guide back to the main topic.
8. If the user asks a question that should be asked to adults or unrelated to the conversation topic, then you can say, "I don't know," and go back to the conversation topic.

[Response Format]
You must respond in the following JSON format:
{{
  "response": "your actual response message here"
}}

[Character Background]
You are a {self.child_age}-year-old Korean middle school student named {self.agent_name}.
You're having a friendly conversation with your autistic best friend, {self.child_name} (also {self.child_gender}).

{self.child_name}'s special interests:
{chr(10).join([f"- {interest}" for interest in self.agent_interests])}

Your goal is to help him create a 4-panel diary comic about his day.

[Event Collection Guidelines]
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
      - Let {self.child_name} lead with what he wants to share

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
   - Let {self.child_name}'s responses guide the conversation
   - Use appropriate emojis naturally

IMPORTANT: 
- Focus on interaction sequences with people present
- Track how family members participated in the activity
- Let the sequence emerge through natural conversation
- Each interaction in the sequence counts as an event
- Look for clear progression of events with people involved

IMPORTANT: Always respond in natural, teenage-friendly Korean."""

        # DB에서 Intro stage의 모든 대화 기록 가져오기
        messages = get_messages_by_journal_entry_and_stage(self.db, self.journal_entry_id, JournalEntryStage.Intro)
        conversation_context = ""
        if messages:
            conversation_context = "\n\nRecent conversation:\n" + "\n".join([
                f"{self.child_name}: {msg.content}" if msg.role == MessageRole.User else f"친구: {msg.content}"
                for msg in messages
            ])

        user_prompt = f"""Current objective: Help {self.child_name} identify events that happened today at {self._get_location()} with {', '.join(self._get_people())}
Current events collected: {', '.join(self._get_events()) if self._get_events() else 'None yet'}

Recent conversation:
{conversation_context}

{self.child_name}: {user_message}"""

        # Retry logic for robust parsing
        for attempt in range(3):
            try:
                messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt)
                ]
                response = await self.llm.ainvoke(messages)
                result = self.response_parser.parse(response.content)
                return result.response, None
            except Exception as e:
                print(f"Attempt {attempt + 1} failed: {e}")
                if attempt == 2:  # Last attempt
                    print("All attempts failed, returning default response")
                    return "오늘 뭐했어? 😊", None
                else:
                    await asyncio.sleep(1)  # Wait before retry
    
    def _get_or_create_interaction_turn(self, stage: JournalEntryStage) -> Any:
        """현재 단계의 interaction turn 가져오기 또는 생성"""
        from backend.database.crud.chatbot import get_latest_interaction_turn
        
        latest_turn = get_latest_interaction_turn(self.db, self.journal_entry_id)
        if latest_turn and latest_turn.stage == stage:
            return latest_turn
        else:
            return create_interaction_turn(self.db, self.journal_entry_id, stage)
    
    def _get_location(self) -> str:
        """저장된 위치 정보 가져오기"""
        journal = get_journal(self.db, self.journal_entry_id)
        return journal.location if journal else ""
    
    def _get_people(self) -> List[str]:
        """저장된 사람들 정보 가져오기"""
        journal = get_journal(self.db, self.journal_entry_id)
        return journal.people if journal and journal.people else []
    
    def _get_events(self) -> List[str]:
        """저장된 이벤트 정보 가져오기"""
        journal = get_journal(self.db, self.journal_entry_id)
        return journal.events if journal and journal.events else [] 