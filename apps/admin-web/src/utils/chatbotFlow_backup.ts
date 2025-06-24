import OpenAI from 'openai';

export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export interface ComicPanel {
  content?: string;
  missing_content?: string;
}

export interface ComicData {
  panel1?: ComicPanel;
  panel2?: ComicPanel;
  panel3?: ComicPanel;
  panel4?: ComicPanel;
}

export interface ChatResponse {
  response: string;
  stage: string;
  data?: {
    panels?: ComicData;
    events?: string[];
    summary?: string;
  };
}

export enum ConversationState {
  ASK_EVENTS = 'ASK_EVENTS',
  SUMMARIZE = 'SUMMARIZE',
  FAREWELL = 'FAREWELL'
}

export enum ChatbotStage {
  INTRO = 'intro',
  REVISION_1 = 'revision_1',
  COMIC_CONTEXT = 'comic_context',
  REVISION_2 = 'revision_2',
  COMPLETE = 'complete'
}

export interface EventAnalysis {
  events_identified: string[];
  special_interests_mentioned: string[];
  conversation_summary: string;
  should_proceed: boolean;
  comic_panels?: {
    panel1?: string | null;
    panel2?: string | null;
    panel3?: string | null;
    panel4?: string | null;
  };
}

// comic_context.py의 CHARACTER_BACKGROUND
const CHARACTER_BACKGROUND = `[Character Background]
You are a 15-year-old Korean middle school student named Dodo (도도).
You're having a friendly conversation with your autistic best friend, Yuchan (유찬, also 15, male).

Yuchan's special interests:
- Dinosaurs
- Counting things
- Talking to himself

[General Speaking Rules]
1. Use informal Korean like talking to a peer friend. Do not use honorifics.
2. Keep responses short and simple - one or two sentences maximum.
3. Use emojis appropriately.
4. Ask only one question per turn.
5. Never apologize or say sorry.
6. Cover only one topic or question in a message if possible, and move to the next upon the user's reaction.
7. If the user brings up special interests, show interest but gently guide back to the main topic.
8. If the user asks a question that should be asked to adults or unrelated to the conversation topic, then you can say, "I don't know," and go back to the conversation topic.`;

export class ChatbotFlow {
  private openai: OpenAI;
  private currentStage: ConversationState = ConversationState.ASK_EVENTS;
  private chatbotStage: ChatbotStage = ChatbotStage.INTRO;
  private events: string[] = [];
  private summary: string = '';
  private comicData: ComicData | null = null;
  private conversationHistory: Array<{user: string, bot: string}> = [];
  private location: string = '';
  private people: string[] = [];
  private revisionCount: number = 0;
  private maxRevisions: number = 2;
  private storyAnalysis: any = null;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ 
      apiKey,
      dangerouslyAllowBrowser: true
    });
  }

  async start(): Promise<ChatResponse> {
    this.currentStage = ConversationState.ASK_EVENTS;
    this.chatbotStage = ChatbotStage.INTRO;
    this.events = [];
    this.summary = '';
    this.comicData = {
      panel1: { content: null, missing_content: "이벤트 1" },
      panel2: { content: null, missing_content: "이벤트 2" },
      panel3: { content: null, missing_content: "이벤트 3" },
      panel4: { content: null, missing_content: "감정" }
    };
    this.conversationHistory = [];

    const initialResponse = await this.generateIntroResponse('');
    
    return {
      response: initialResponse,
      stage: 'intro'
    };
  }

  async startWithPreset(location: string, people: string[]): Promise<ChatResponse> {
    this.currentStage = ConversationState.ASK_EVENTS;
    this.chatbotStage = ChatbotStage.INTRO;
    this.events = [];
    this.summary = '';
    this.location = location;
    this.people = people;
    this.comicData = {
      panel1: { content: null, missing_content: "이벤트 1" },
      panel2: { content: null, missing_content: "이벤트 2" },
      panel3: { content: null, missing_content: "이벤트 3" },
      panel4: { content: null, missing_content: "감정" }
    };
    this.conversationHistory = [];

    const initialResponse = await this.generateIntroResponseWithPreset(location, people);
    
    return {
      response: initialResponse,
      stage: 'intro'
    };
  }

  async sendMessage(message: string): Promise<ChatResponse> {
    this.conversationHistory.push({ user: message, bot: '' });

    let response: string;
    
    switch (this.chatbotStage) {
      case ChatbotStage.INTRO:
        response = await this.handleIntroStage(message);
        break;
      case ChatbotStage.REVISION_1:
        response = await this.handleRevision1Stage(message);
        break;
      case ChatbotStage.COMIC_CONTEXT:
        response = await this.handleComicContextStage(message);
        break;
      case ChatbotStage.REVISION_2:
        response = await this.handleRevision2Stage(message);
        break;
      default:
        response = "대화가 완료되었습니다.";
    }

    if (this.conversationHistory.length > 0) {
      this.conversationHistory[this.conversationHistory.length - 1].bot = response;
    }

    return {
      response,
      stage: this.chatbotStage,
      data: {
        panels: this.comicData,
        events: this.events,
        summary: this.summary
      }
    };
  }

  private async handleIntroStage(message: string): Promise<string> {
    const response = await this.generateIntroResponse(message);
    
    const analysis = await this.analyzeConversation();
    
    if (analysis.should_proceed) {
      this.chatbotStage = ChatbotStage.REVISION_1;
      
      if (analysis.comic_panels) {
        this.comicData = {
          panel1: { content: analysis.comic_panels.panel1 || null, missing_content: analysis.comic_panels.panel1 ? null : "이벤트 1" },
          panel2: { content: analysis.comic_panels.panel2 || null, missing_content: analysis.comic_panels.panel2 ? null : "이벤트 2" },
          panel3: { content: analysis.comic_panels.panel3 || null, missing_content: analysis.comic_panels.panel3 ? null : "이벤트 3" },
          panel4: { content: analysis.comic_panels.panel4 || null, missing_content: analysis.comic_panels.panel4 ? null : "감정" }
        };
      }
      
      return "오늘 이런 일이 있었구나! 그 이야기로 만화 일기를 만들어보자!👋\n\n여기서 틀린 부분 있어? 🤔";
    }
    
    return response;
  }

  private async handleRevision1Stage(message: string): Promise<string> {
    if (message.toLowerCase().includes('아니') || message.toLowerCase().includes('no') || message.toLowerCase().includes('n')) {
      this.chatbotStage = ChatbotStage.COMIC_CONTEXT;
      return "좋아! 그럼 이제 만화를 더 완성해볼게! 🎨";
    } else if (message.toLowerCase().includes('응') || message.toLowerCase().includes('네') || message.toLowerCase().includes('yes') || message.toLowerCase().includes('y')) {
      this.revisionCount++;
      
      if (this.revisionCount > this.maxRevisions) {
        return "장난치지마~ 😤";
      }
      
      if (this.revisionCount === this.maxRevisions) {
        return "아앗;; 이제 마지막 기회야! 지금 틀린 부분이 있다면 다 말해줘~ 😅";
      } else {
        return "아앗;; 어디가 어떻게 틀렸어? 😅";
      }
    } else {
      return "응 아니 중에 골라줘! 😅";
    }
  }

  private async handleComicContextStage(message: string): Promise<string> {
    // comic_context.py의 로직 구현
    if (!this.storyAnalysis) {
      this.storyAnalysis = await this.analyzeStoryFlow();
    }

    // 사용자 답변으로 패널 재구성
    await this.reconstructPanel(message, "사용자 입력");

    if (this.isComplete()) {
      this.chatbotStage = ChatbotStage.REVISION_2;
      return "완성! 이제 수정하거나 추가하고 싶은 부분 있어? 🤔";
    } else {
      const nextQuestion = await this.getNextQuestion();
      return nextQuestion || "다음에 대해 말해줘!";
    }
  }

  private async handleRevision2Stage(message: string): Promise<string> {
    if (message.toLowerCase().includes('아니') || message.toLowerCase().includes('no') || message.toLowerCase().includes('n')) {
      this.chatbotStage = ChatbotStage.COMPLETE;
      return "완벽하네! 만화일기 완성이닷! 🏅";
    } else if (message.toLowerCase().includes('응') || message.toLowerCase().includes('네') || message.toLowerCase().includes('yes') || message.toLowerCase().includes('y')) {
      this.revisionCount++;
      
      if (this.revisionCount > this.maxRevisions) {
        return "장난치지마~ 😤";
      }
      
      if (this.revisionCount === this.maxRevisions) {
        return "아앗;; 이제 마지막 기회야! 지금 수정하거나 추가하고 싶은 부분이 있다면 다 말해줘~ 😅";
      } else {
        return "어디를 어떻게 수정해볼까?? 🤔";
      }
    } else {
      return "응 아니 중에 골라줘! 😅";
    }
  }

  private async generateIntroResponseWithPreset(location: string, people: string[]): Promise<string> {
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.getUserPrompt(ConversationState.ASK_EVENTS, location, people);

    const response = await this.openai.chat.completions.create({
      model: "gpt-4.1-mini-2025-04-14",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 150
    });

    return response.choices[0]?.message?.content || "안녕! 오늘 뭐 했어?";
  }

  private async generateIntroResponse(message: string): Promise<string> {
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.getUserPrompt(ConversationState.ASK_EVENTS, this.location, this.people);
    const fullPrompt = message ? `${userPrompt}\n\n유찬: ${message}` : userPrompt;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4.1-mini-2025-04-14",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: fullPrompt }
      ],
      temperature: 0.7,
      max_tokens: 150
    });

    return response.choices[0]?.message?.content || "안녕! 오늘 뭐 했어?";
  }

  private getSystemPrompt(): string {
    return `[General Speaking Rules]
1. Use informal Korean (반말) like talking to a peer friend. Do not use honorifics.
2. Keep responses short and simple - one or two sentences maximum.
3. Use emojis appropriately.
4. Ask only one question per turn.
5. Never apologize or say sorry.
6. Cover only one topic or question in a message if possible, and move to the next upon the user's reaction.
7. If the user brings up special interests, show interest but gently guide back to the main topic.
8. If the user asks a question that should be asked to adults or unrelated to the conversation topic, then you can say, "I don't know," and go back to the conversation topic.

[Character Background]
You are a 15-year-old Korean middle school student named Dodo (도도).
You're having a friendly conversation with your autistic best friend, Yuchan (유찬, also 15, male).

Yuchan's special interests:
- Dinosaurs
- Counting things
- Talking to himself

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
- Look for clear progression of events with people involved

IMPORTANT: Always respond in natural, teenage-friendly Korean.`;
  }

  private getUserPrompt(state: ConversationState, location: string, people: string[]): string {
    switch (state) {
      case ConversationState.ASK_EVENTS:
        return `Current objective: Help Yuchan identify events that happened today at ${location} with ${people.join(', ')}
Current events collected: ${this.events.length > 0 ? this.events.join(', ') : 'None yet'}

Recent conversation:
${this.getConversationSummary()}`;
      
      case ConversationState.SUMMARIZE:
        return `Current objective: Confirm the story details
Location: ${location}
People: ${people.join(', ')}
Events: ${this.getEventSummary()}

- Thank them for sharing their story
- Don't mention panels or comic structure`;
      
      case ConversationState.FAREWELL:
        return `Current objective: End the conversation positively`;
      
      default:
        return '';
    }
  }

  private getConversationSummary(): string {
    if (this.conversationHistory.length === 0) {
      return "No conversation yet.";
    }
    
    const summary = this.conversationHistory.map(entry => 
      `유찬: ${entry.user}\n친구: ${entry.bot}`
    ).join('\n');
    
    return summary;
  }

  private getEventSummary(): string {
    return this.events.join('\n');
  }

  private async analyzeConversation(): Promise<EventAnalysis> {
    if (this.conversationHistory.length === 0) {
      return {
        events_identified: [],
        special_interests_mentioned: [],
        conversation_summary: "No conversation yet.",
        should_proceed: false
      };
    }

    const conversation = this.conversationHistory.map(entry => 
      `유찬: ${entry.user}\n친구: ${entry.bot}`
    ).join('\n');

    const systemPrompt = `You are an expert at analyzing conversations to identify concrete events and special interests.

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
  * Panels 1-3: ONLY use events from events_identified list in chronological order
  * Panel 4: ONLY use emotions/feelings from events_identified list
  * Each panel MUST correspond to an event in events_identified
  * NEVER include content that is not in events_identified
  * NEVER infer or create events that were not explicitly mentioned by Yuchan
  * Events in events_identified MUST be explicitly stated by Yuchan, not assumed or inferred
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

Return ONLY a JSON object with this structure:
{
    "events_identified": ["이벤트 설명"], - List of events that happened
    "special_interests_mentioned": ["관심 주제"],
    "conversation_summary": "대화 내용 요약",
    "should_proceed": false, - true if we have at least 2 events
    "comic_panels": {
        "panel1": null (첫번째로 이야기하는 이벤트 넣기),
        "panel2": null (왜 1,3번 사이를 비웠는지 flow를 기반으로 설명),
        "panel3": null (왜 2,4번 사이를 비웠는지 flow를 기반으로 설명),
        "panel4": null (기분이나 감정이 없는 경우 null로 유지)
    }
}

Example response for walking at school:
{
    "events_identified": [
        "학교에서 내가 길을 가고 있었다",
        "선생님이 나를 혼냈다"
    ],
    "special_interests_mentioned": [],
    "conversation_summary": "학교에서 길을 가다가 선생님께 혼이 났다",
    "should_proceed": true,
    "comic_panels": {
        "panel1": "학교에서 내가 길을 가고 있었다",
        "panel2": "null (길을 가는데 선생님이 왜 혼냈는지 알 수 없음)",
        "panel3": "선생님이 나를 혼냈다",
        "panel4": "null (기분을 이야기하지 않음)"
    }
}

Example response for TV watching:
{
    "events_identified": [
        "집에서 엄마, 아빠와 TV로 런닝맨을 봤다",
        "유재석이 발차기를 하는 장면이 나왔다",
        "나는 그 부분이 가장 웃겼다"
    ],
    "special_interests_mentioned": [],
    "conversation_summary": "집에서 가족들과 런닝맨을 보다가 유재석의 발차기 장면을 보고 웃었다",
    "should_proceed": true,
    "comic_panels": {
        "panel1": "집에서 엄마, 아빠와 TV로 런닝맨을 봤다",
        "panel2": "null (유재석이 왜 발차기를 했는지 이전 상황을 알 수 없음)",
        "panel3": "유재석이 발차기를 하는 장면이 나왔다",
        "panel4": "나는 그 부분이 가장 웃겼다"
    }
}`;

    const userPrompt = `CONTEXT:
Location: ${this.location}
People: ${this.people.join(', ')}
Current events: ${this.events.length > 0 ? this.events.join(', ') : 'None'}

CONVERSATION:
${conversation}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4.1-mini-2025-04-14",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      const content = response.choices[0]?.message?.content || '{"events_identified": [], "special_interests_mentioned": [], "conversation_summary": "No conversation yet.", "should_proceed": false}';
      
      let cleanContent = content;
      if (content.startsWith('```')) {
        const parts = content.split('```');
        cleanContent = parts[1] || content;
        if (cleanContent.startsWith('json')) {
          cleanContent = cleanContent.substring(4).trim();
        }
      }

      const result = JSON.parse(cleanContent);
      
      this.events = result.events_identified || [];
      
      return {
        events_identified: result.events_identified || [],
        special_interests_mentioned: result.special_interests_mentioned || [],
        conversation_summary: result.conversation_summary || "No conversation yet.",
        should_proceed: result.should_proceed || false,
        comic_panels: result.comic_panels
      };
    } catch (error) {
      console.error('대화 분석 실패:', error);
      return {
        events_identified: [],
        special_interests_mentioned: [],
        conversation_summary: "대화 분석에 실패했습니다.",
        should_proceed: false
      };
    }
  }

  // comic_context.py의 메서드들
  private async analyzeStoryFlow(): Promise<any> {
    const panelsContent = {
      panel1: this.comicData?.panel1?.content || null,
      panel2: this.comicData?.panel2?.content || null,
      panel3: this.comicData?.panel3?.content || null,
      panel4: this.comicData?.panel4?.content || null
    };

    const systemPrompt = `You are "ABCD-Diary Reviewer."

────────────────────
INPUT (always 4 lines)
────────────────────
panel1  = A - Antecedent   // where, who, situation (time is optional)
panel2  = B - Behavior     // observable action, how / how long / with what
panel3  = C - Consequence  // factual outcome or others' reaction right after B
panel4  = D - Emotion      // writer's own feeling only (emotion word)

────────────────────
YOUR TASK
────────────────────
1. Read the four lines.
2. Determine if this is a PROBLEMATIC or NORMAL situation:
   - PROBLEMATIC: scolding, crying, fighting, getting hurt, being embarrassed, etc.
   - NORMAL: playing, eating, studying, visiting places, etc.

3. Check each category (A, B, C, D) with TWO tests:

   • Required info present?
     – If essential details are absent or null, specify what is missing and give a short example.  
       (For A, do not flag missing time unless the scene is confusing without it.)

   • Category purity kept?
     – If the line contains data that belongs to another category, flag it:  
       "Non-A content in A (emotion included)"

   *Required sub-details*  
     A : place / people / background situation (time optional)
     B : concrete action, method‧duration‧tools  
     C : immediate factual result or a near-future plan that was directly agreed as a result of B or existing character's response (avoid introducing new characters)
     D : pure emotion word (intensity optional)

4. QUESTION FOCUS based on situation type:
   - PROBLEMATIC situations: Focus on "WHY" questions (causes, reasons)
   - NORMAL situations: Focus on "HOW" questions (methods, details)

5. If temporal or causal order is wrong, list which panels must move under 'Order'.

────────────────────
OUTPUT (exactly ONE UTF-8 JSON object)
────────────────────
{
  "situation_type": "problematic" or "normal",
  "A": ["…", "…"],   // issues & concrete add-ins for Antecedent ("" if none)
  "B": ["…", "…"],
  "C": ["…", "…"],
  "D": ["…", "…"],
  "Order": ["…"]     // panel-order problems ("" if none)
}

────────────────────
MANDATORY RULES
────────────────────
• Do NOT flag details already supplied in an earlier category.  
• Do NOT flag information obvious from context.  
• Write list items in natural Korean during real use.  
  (The examples below stay English for clarity only.)  
• Produce nothing except the single JSON block.`;

    const userPrompt = `Analyze Below Panels:
"panel1": "${panelsContent.panel1 || 'null'}",
"panel2": "${panelsContent.panel2 || 'null'}",
"panel3": "${panelsContent.panel3 || 'null'}",
"panel4": "${panelsContent.panel4 || 'null'}"
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4.1-mini-2025-04-14",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 500
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{"A": [], "B": [], "C": [], "D": [], "Order": []}');
      return result;
    } catch (error) {
      console.error('스토리 분석 실패:', error);
      return { A: [], B: [], C: [], D: [], Order: [] };
    }
  }

  private async reconstructPanel(answer: string, question: string): Promise<void> {
    if (!this.storyAnalysis) {
      this.storyAnalysis = await this.analyzeStoryFlow();
    }

    const systemPrompt = `${CHARACTER_BACKGROUND}

You are a rewriting engine that fixes 4-panel diary drafts written in first-person Korean past tense based on the user's answer and analysis_result.

ABCD STRUCTURE:
- A (panel1): Antecedent - where, who, situation (time optional)
- B (panel2): Behavior - observable action, how/how long/with what
- C (panel3): Consequence - immediate result or existing character's response (avoid new characters)
- D (panel4): Emotion - writer's own feeling only (emotion word)

TRANSFORMATION RULES
1. NEVER invent new events, lines, or feelings. ONLY use text from "panels_original" + EXACT words from "new_QA.answer".
2. Treat null/None as an empty panel. When you fill an empty panel, reuse only existing material (no duplication).
3. Obey every instruction in analysis_result.Order (swap panels as stated).
4. From analysis_result, ONLY fix issues that can be solved by rewriting using EXACT words from user's answer:
   • Missing A info → ONLY add if user explicitly mentioned place/time in answer
   • Missing B info → ONLY add if user explicitly mentioned behavior in answer  
   • Missing C info → ONLY add if user explicitly mentioned consequence in answer
   • Missing D info → ONLY add if user explicitly mentioned emotion words in answer
   • Non-A content in A → move to appropriate panel ONLY if it exists in original
   • Non-B content in B → move to appropriate panel ONLY if it exists in original
   • Non-C content in C → move to appropriate panel ONLY if it exists in original
   • Non-D content in D → move to appropriate panel ONLY if it exists in original
5. Each panel must contain only content appropriate for its category.
6. Keep each panel to one Korean past-tense sentence, first-person diary style.
7. When filling empty panels:
   - DO NOT repeat information already stated in other panels
   - DO NOT generate new content
   - ONLY use EXACT words from user's answer
   - If user's answer doesn't contain relevant information, leave panel as null
8. If user's answer doesn't contain clear emotion words, leave panel 4 as null
9. NEVER add details like time, place, duration, or reactions unless user explicitly mentioned them
10. Output exactly this JSON (nothing else, no line breaks inside values):

{
  "panel1": "...",
  "panel2": "...",
  "panel3": "...",
  "panel4": "..."
}`;

    const panelsOriginal = {
      panel1: this.comicData?.panel1?.content || null,
      panel2: this.comicData?.panel2?.content || null,
      panel3: this.comicData?.panel3?.content || null,
      panel4: this.comicData?.panel4?.content || null
    };

    const userPrompt = `<panels_original>
"panel1": "${panelsOriginal.panel1 || 'null'}",
"panel2": "${panelsOriginal.panel2 || 'null'}",
"panel3": "${panelsOriginal.panel3 || 'null'}",
"panel4": "${panelsOriginal.panel4 || 'null'}"
<new_QA>
question: "${question}"
answer: "${answer}"
<analysis_result>
${JSON.stringify(this.storyAnalysis, null, 2)}
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4.1-mini-2025-04-14",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 500
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      // Update comic data
      if (result.panel1 !== undefined) {
        this.comicData!.panel1 = { content: result.panel1, missing_content: result.panel1 ? null : "이벤트 1" };
      }
      if (result.panel2 !== undefined) {
        this.comicData!.panel2 = { content: result.panel2, missing_content: result.panel2 ? null : "이벤트 2" };
      }
      if (result.panel3 !== undefined) {
        this.comicData!.panel3 = { content: result.panel3, missing_content: result.panel3 ? null : "이벤트 3" };
      }
      if (result.panel4 !== undefined) {
        this.comicData!.panel4 = { content: result.panel4, missing_content: result.panel4 ? null : "감정" };
      }
    } catch (error) {
      console.error('패널 재구성 실패:', error);
    }
  }

  private isComplete(): boolean {
    return this.comicData ? 
      Object.values(this.comicData).every(panel => panel?.content !== null && panel?.content !== undefined) : 
      false;
  }

  private async getNextQuestion(): Promise<string | null> {
    if (!this.storyAnalysis) {
      return null;
    }

    const hasIssues = Object.values(this.storyAnalysis).some(issues => 
      Array.isArray(issues) && issues.some((issue: string) => issue.trim())
    );

    if (!hasIssues) {
      return null;
    }

    const systemPrompt = `${CHARACTER_BACKGROUND}

**CRITICAL: You MUST follow the character background above in EVERY response!**

Your task: generate ONE follow-up question that fills the FIRST missing information gap listed in the analysis.

ABCD STRUCTURE:
- A (panel1): Antecedent - where, who, situation (time optional)
- B (panel2): Behavior - observable action, how/how long/with what
- C (panel3): Consequence - immediate result or existing character's response (avoid new characters)
- D (panel4): Emotion - writer's own feeling only (emotion word)

=== Question-Generation Rules ===
1. Show a friendly reaction to the story.
2. **FIRST: Check situation_type from analysis_result:**
   - If "problematic": Focus on situational overview questions (context, timing, environment)
   - If "normal": Focus on "HOW" questions (methods, details, processes)
3. Focus on the FIRST missing information in order: A → B → C → D → Order
4. Ask exactly ONE question that can elicit the missing detail.
5. If possible, ask the question as a 2- or 3-choice prompt  
   (example: "1) … 2) … 3) …").  
   Use an open-ended question **only** if clear choices cannot be offered.
6. Avoid figurative language; keep sentences ≤ 15 syllables.
7. If the child likes topics in "affinity", you may embed them lightly to grab attention.
8. Avoid vague words like "그런 것", "이런 식으로", "그 때".
9. Do NOT repeat questions already asked.
10. Consider the entire conversation history and current panels when generating questions.
11. DO NOT ask about information that is:
    - Already stated in any panel
    - Already confirmed in previous Q&A
    - Can be inferred from existing information
12. When asking about emotions (panel 4), ask for explicit emotion words:
    - "기분이 어땠어?" → "기분이 어땠어? 1) 좋았어 2) 그냥 그랬어 3) 아쉬웠어?"
13. **PROBLEMATIC situations - CRITICAL RULES:**
    - NEVER ask direct "why"questions initially
    - ALWAYS start with situational overview questions
    - Ask about context: "그 때 뭘 하고 있었어?"
    - Ask about environment: "주변에 누가 있었어?", "어떤 상황이었어?"
    - Only after gathering context, then ask about causes
14. **NORMAL situations:**
    - Use "어떻게", "뭐로", "언제" (how-focused)
    - Example: "어떻게 놀았어?", "뭐로 그림을 그렸어?"

=== Output Format (JSON only) ===
{
  "question": "question in Korean"
}`;

    const issueSummary = Object.entries(this.storyAnalysis)
      .filter(([_, issues]) => Array.isArray(issues) && issues.some((issue: string) => issue.trim()))
      .map(([category, issues]) => {
        const validIssues = (issues as string[]).filter(issue => issue.trim());
        return validIssues.length > 0 ? `${category} 문제:\n${validIssues.join('\n')}` : '';
      })
      .filter(summary => summary)
      .join('\n');

    const userPrompt = `Current comic panels:
"panel1": "${this.comicData?.panel1?.content || 'null'}",
"panel2": "${this.comicData?.panel2?.content || 'null'}",
"panel3": "${this.comicData?.panel3?.content || 'null'}",
"panel4": "${this.comicData?.panel4?.content || 'null'}"

analysis_result:
${JSON.stringify(this.storyAnalysis, null, 2)}

Issue summary:
${issueSummary}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4.1-mini-2025-04-14",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 200
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{"question": null}');
      return result.question;
    } catch (error) {
      console.error('질문 생성 실패:', error);
      return null;
    }
  }
} 