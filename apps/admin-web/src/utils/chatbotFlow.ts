import OpenAI from 'openai';
import { FourSceneComic } from './comic';

export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export interface ComicPanel {
  content?: string | null;
  missing_content?: string | null;
  grid?: any[][]; // comic.ts에서 생성되는 grid 데이터
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
    focusedPanel?: string; // 현재 포커스되는 패널 (panel1, panel2, panel3, panel4)
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
8. If the user asks a question that should be asked to adults or unrelated to the conversation topic, then you can say, "I don't know," and go back to the conversation topic.
`;

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
  private lastBotMessage: string | null = null;
  private lastAnalysis: EventAnalysis | null = null;
  private focusedPanel: string | undefined = undefined; // 현재 포커스되는 패널
  private comicContextHistory: Array<{user: string, bot: string}> = []; // comic_context 단계에서만 사용할 대화 기록

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
    console.log(`[DEBUG] Current stage: ${this.chatbotStage}, Message: ${message}`);

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
      case ChatbotStage.COMPLETE:
        // Python과 동일하게: COMPLETE 단계에서는 대화 종료
        // Python의 comic_intro.py에서는 farewell 메시지 후 대화 종료
        return {
          response: "대화가 완료되었습니다.",
          stage: this.chatbotStage,
          data: {
            panels: this.comicData || undefined,
            events: this.events,
            summary: this.summary
          }
        };
      default:
        response = "대화가 완료되었습니다.";
    }

    console.log(`[DEBUG] New stage: ${this.chatbotStage}, Response: ${response}`);

    // Python과 동일하게: LLM 응답 후에 대화 기록 추가
    this.conversationHistory.push({ user: message, bot: response });

    // Python과 동일하게: 대화 기록 추가 후 분석 (현재 턴 포함)
    if (this.chatbotStage === ChatbotStage.INTRO) {
      const analysis = await this.analyzeConversation();
      console.log(`[DEBUG] Analysis after conversation added:`, analysis);
      
      if (analysis.should_proceed && this.isEventsComplete()) {
        // Python과 동일하게: farewell 메시지 후 자동으로 REVISION_1 단계로 전환
        this.chatbotStage = ChatbotStage.REVISION_1;
        response = "오늘 이런 일이 있었구나! 그 이야기로 만화 일기를 만들어보자!👋";
        
        // Python revision_1.py와 동일하게: lastAnalysis의 comic_panels를 comicData로 변환
        if (analysis.comic_panels) {
          this.comicData = {
            panel1: {
              content: analysis.comic_panels.panel1,
              missing_content: analysis.comic_panels.panel1 === null ? "이벤트 1" : null
            },
            panel2: {
              content: analysis.comic_panels.panel2,
              missing_content: analysis.comic_panels.panel2 === null ? "이벤트 2" : null
            },
            panel3: {
              content: analysis.comic_panels.panel3,
              missing_content: analysis.comic_panels.panel3 === null ? "이벤트 3" : null
            },
            panel4: {
              content: analysis.comic_panels.panel4,
              missing_content: analysis.comic_panels.panel4 === null ? "감정" : null
            }
          };
          console.log(`[DEBUG] Converted comic_panels to comicData:`, this.comicData);
        }
        
        // Update the last bot message in history
        this.conversationHistory[this.conversationHistory.length - 1] = {
          user: message,
          bot: response
        };
        
        // Python revision_1.py와 동일하게: 자동으로 패널 보여주고 질문
        // 이는 별도의 응답으로 처리되어야 하므로, 여기서는 farewell 메시지만 반환
        // 실제 패널 표시와 질문은 클라이언트에서 처리해야 함
      }
    }

    // Python revision_1.py와 동일하게: REVISION_1 단계에서 첫 번째 메시지 처리
    if (this.chatbotStage === ChatbotStage.REVISION_1 && this.revisionCount === 0 && !this.lastBotMessage?.includes('여기서 틀린 부분 있어')) {
      console.log(`[DEBUG] First time in REVISION_1, showing revision question`);
      response = "여기서 틀린 부분 있어? 🤔";
    }

    // comic_context 단계로 전환할 때 comicContextHistory 초기화
    if (this.chatbotStage === ChatbotStage.COMIC_CONTEXT && this.lastBotMessage?.includes('좋아! 그럼 이제 만화를 더 완성해볼게!')) {
      console.log(`[DEBUG] Transitioning to COMIC_CONTEXT, initializing comicContextHistory`);
      this.comicContextHistory = [];
    }

    // comic_context 단계로 전환할 때 comicData를 response에 포함
    if (this.chatbotStage === ChatbotStage.COMIC_CONTEXT && this.comicData) {
      console.log(`[DEBUG] COMIC_CONTEXT stage, including comicData in response`);
    }

    this.lastBotMessage = response;

    return {
      response,
      stage: this.chatbotStage,
      data: {
        panels: this.comicData || undefined,
        events: this.events,
        summary: this.summary,
        focusedPanel: this.focusedPanel || undefined
      }
    };
  }

  private async handleIntroStage(message: string): Promise<string> {
    try {
      // Python과 동일한 로직: 먼저 LLM 응답 생성
      const response = await this.generateIntroResponse(message);
      
      // Python과 동일하게: 대화 분석은 sendMessage에서 처리 (현재 턴 포함)
      
      return response;
      
    } catch (error) {
      console.error('Error in handleIntroStage:', error);
      return "미안미안! 다시 이야기해줄래? 🙏";
    }
  }

  // Python과 동일한 로직 (내부용)
  private getFinalSummaryInternal(): string {
    let summary = "\n=== 최종 4컷 만화 일기 내용 ===\n";
    summary += `장소: ${this.location}\n`;
    summary += `함께한 사람들: ${this.people.join(', ')}\n`;
    summary += "\n만화 컷:\n";

    // Python과 동일한 패널 처리 로직: lastAnalysis 사용
    if (this.lastAnalysis && this.lastAnalysis.comic_panels) {
      const panels = this.lastAnalysis.comic_panels;
      for (let i = 1; i <= 4; i++) {
        const panelKey = `panel${i}` as keyof typeof panels;
        const panelContent = panels[panelKey];
        
        summary += `${panelKey}: { `;
        
        if (typeof panelContent === 'string') {
          // Python과 동일하게: null이 포함된 내용인지 확인
          if (panelContent.includes("null (") || panelContent.includes("(null")) {
            // 괄호 안의 설명 추출
            const parts = panelContent.split("(", 1);
            if (parts.length > 1) {
              const explanation = parts[1].replace(")", "").trim();
              summary += `"content": null, "missing_content": "${explanation}" }\n`;
            } else {
              summary += `"content": null, "missing_content": "내용 없음" }\n`;
            }
          } else {
            summary += `"content": "${panelContent}", "missing_content": null }\n`;
          }
        } else if (panelContent === null) {
          summary += `"content": null, "missing_content": "내용 없음" }\n`;
        } else {
          summary += `"content": null, "missing_content": "패널 정보 없음" }\n`;
        }
      }
    } else {
      // Python과 동일한 fallback: comic_panels가 없을 때
      for (let i = 1; i <= 4; i++) {
        const panelKey = `panel${i}`;
        summary += `${panelKey}: { "content": null, "missing_content": "패널 정보를 생성할 수 없음" }\n`;
      }
    }

    return summary;
  }

  // Python의 is_conversation_complete와 동일한 로직
  private isConversationComplete(): boolean {
    return (
      this.chatbotStage === ChatbotStage.COMPLETE &&
      this.location.length > 0 &&
      this.people.length > 0 &&
      this.events.length >= 2
    );
  }

  private async analyzeConversation(): Promise<EventAnalysis> {
    if (this.conversationHistory.length === 0) {
      const emptyAnalysis = {
        events_identified: [],
        special_interests_mentioned: [],
        conversation_summary: "No conversation yet.",
        should_proceed: false
      };
      this.updateFromAnalysis(emptyAnalysis);
      return emptyAnalysis;
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
}
`;

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
      
      // Python과 동일하게: 분석 결과를 context에 업데이트
      const analysis = {
        events_identified: result.events_identified || [],
        special_interests_mentioned: result.special_interests_mentioned || [],
        conversation_summary: result.conversation_summary || "No conversation yet.",
        should_proceed: result.should_proceed || false,
        comic_panels: result.comic_panels
      };
      
      this.updateFromAnalysis(analysis);
      
      return analysis;
    } catch (error) {
      console.error('대화 분석 실패:', error);
      const emptyAnalysis = {
        events_identified: [],
        special_interests_mentioned: [],
        conversation_summary: "대화 분석에 실패했습니다.",
        should_proceed: false
      };
      this.updateFromAnalysis(emptyAnalysis);
      return emptyAnalysis;
    }
  }

  // Python의 update_from_analysis와 동일한 로직
  private updateFromAnalysis(analysis: EventAnalysis): void {
    this.events = analysis.events_identified;
    this.summary = analysis.conversation_summary;
    
    // Python과 동일하게: comic_panels를 comicData로 변환
    if (analysis.comic_panels) {
      this.comicData = {
        panel1: { 
          content: analysis.comic_panels.panel1 || null, 
          missing_content: analysis.comic_panels.panel1 ? null : "이벤트 1" 
        },
        panel2: { 
          content: analysis.comic_panels.panel2 || null, 
          missing_content: analysis.comic_panels.panel2 ? null : "이벤트 2" 
        },
        panel3: { 
          content: analysis.comic_panels.panel3 || null, 
          missing_content: analysis.comic_panels.panel3 ? null : "이벤트 3" 
        },
        panel4: { 
          content: analysis.comic_panels.panel4 || null, 
          missing_content: analysis.comic_panels.panel4 ? null : "감정" 
        }
      };
    }
    
    // Python과 동일하게: last_analysis 업데이트
    this.lastAnalysis = analysis;
  }

  // Python의 is_events_complete와 동일한 로직
  private isEventsComplete(): boolean {
    return this.events.length >= 2;
  }

  private async handleRevision1Stage(message: string): Promise<string> {
    console.log(`[DEBUG] handleRevision1Stage - message: "${message}", revisionCount: ${this.revisionCount}`);
    
    // "네가 말해준 내용대로 바꿔봤어. 이제 다 맞을까?" 질문에 대한 답변 처리
    if (this.lastBotMessage?.includes('네가 말해준 내용대로 바꿔봤어')) {
      console.log(`[DEBUG] Processing response to "is it correct now" question`);
      
      if (message.toLowerCase().includes('아니') || message.toLowerCase().includes('no') || message.toLowerCase().includes('n')) {
        // 아직도 틀린 부분이 있다면 다시 수정 요청
        console.log(`[DEBUG] User said no to "is it correct now", asking for more corrections`);
        return "아앗;; 어디가 어떻게 틀렸어? 😅";
      } else if (message.toLowerCase().includes('응') || message.toLowerCase().includes('네') || message.toLowerCase().includes('yes') || message.toLowerCase().includes('y')) {
        // 이제 맞다고 하면 comic.ts를 호출해서 4컷 패널 생성 후 comic_context로 넘어감
        console.log(`[DEBUG] User said yes to "is it correct now", generating comic panels and transitioning to COMIC_CONTEXT`);
        
        // comic.ts를 호출해서 4컷 패널 생성
        await this.generateComicPanels();
        
        this.chatbotStage = ChatbotStage.COMIC_CONTEXT;
        this.revisionCount = 0; // revision_2를 위해 초기화
        this.focusedPanel = undefined; // comic_context 시작 시 포커스 초기화
        return "좋아! 그럼 이제 만화를 더 완성해볼게! 🎨";
      } else {
        return "응 아니 중에 골라줘! 😅";
      }
    }
    
    // "여기서 틀린 부분 있어?" 질문에 대한 답변 처리 (첫 번째 메시지)
    if (this.revisionCount === 0) {
      console.log(`[DEBUG] First message in REVISION_1, processing yes/no response`);
      
      if (message.toLowerCase().includes('아니') || message.toLowerCase().includes('no') || message.toLowerCase().includes('n')) {
        // "아니"라고 답한 경우, comic.ts를 호출해서 4컷 패널 생성 후 comic_context로 넘어감
        console.log(`[DEBUG] User said no to mistakes, generating comic panels and transitioning to COMIC_CONTEXT`);
        
        // comic.ts를 호출해서 4컷 패널 생성
        await this.generateComicPanels();
        
        this.chatbotStage = ChatbotStage.COMIC_CONTEXT;
        this.revisionCount = 0; // revision_2를 위해 초기화
        this.focusedPanel = undefined; // comic_context 시작 시 포커스 초기화
        return "좋아! 그럼 이제 만화를 더 완성해볼게! 🎨";
      } else if (message.toLowerCase().includes('응') || message.toLowerCase().includes('네') || message.toLowerCase().includes('yes') || message.toLowerCase().includes('y')) {
        console.log(`[DEBUG] User said yes, incrementing revisionCount`);
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
    
    // 구체적인 수정 내용이 들어온 경우 (Python revision_1.py와 동일한 로직)
    console.log(`[DEBUG] User provided specific revision: "${message}"`);
    
    // 수정 내용을 적용
    await this.applyRevision(message);
    
    // 수정 후 다시 확인 (Python과 동일한 메시지)
    return "네가 말해준 내용대로 바꿔봤어. 이제 다 맞을까? 🤔";
  }

  private async applyRevision(userCorrection: string): Promise<void> {
    const systemPrompt = `${CHARACTER_BACKGROUND}

You are a revision assistant that helps fix 4-panel comic stories based on user feedback.

ABCD STRUCTURE:
- A (panel1): Antecedent - where, who, situation (time optional)
- B (panel2): Behavior - observable action, how/how long/with what
- C (panel3): Consequence - immediate result or existing character's response (avoid new characters)
- D (panel4): Emotion - writer's own feeling only (emotion word)

REVISION RULES:
1. **ONLY modify the specific panel(s) that the user wants to change**
2. **KEEP all other panels exactly as they are**
3. When user corrects only the ACTION/BEHAVIOR, preserve the LOCATION/CONTEXT
4. When user corrects LOCATION/PLACE, replace the entire location context
5. When user says something is "not correct" or "wrong", identify what part is wrong:
   - If it's the ACTION: keep location, change action
   - If it's the LOCATION: change location completely
   - If it's the WHOLE SENTENCE: replace completely

6. Understand the user's correction request and apply it appropriately
7. Maintain the ABCD structure while making the requested changes
8. Keep each panel to one Korean past-tense sentence, first-person diary style
9. **CRITICAL**: Only change what the user specifically requested
10. Preserve the overall story flow and coherence
11. Output exactly this JSON format with ONLY the panels that need to change:

{
  "panel1": "new content only if panel1 needs to change",
  "panel2": "new content only if panel2 needs to change", 
  "panel3": "new content only if panel3 needs to change",
  "panel4": "new content only if panel4 needs to change"
}

12. **DO NOT include panels that should remain unchanged**
13. **DO NOT include panels that should be null**
14. Write in natural Korean
15. **IMPORTANT**: Make sure the story remains coherent and logical after revision`;

    // Get current panel contents
    const currentPanels = {
      panel1: this.comicData?.panel1?.content || "null",
      panel2: this.comicData?.panel2?.content || "null",
      panel3: this.comicData?.panel3?.content || "null",
      panel4: this.comicData?.panel4?.content || "null"
    };

    const userPrompt = `Current comic panels:
"panel1": "${currentPanels.panel1}",
"panel2": "${currentPanels.panel2}",
"panel3": "${currentPanels.panel3}",
"panel4": "${currentPanels.panel4}"

User's correction request: ${userCorrection}
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

      const revisedPanels = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      // Update only the panels that were returned in the response, preserving grid information
      if (revisedPanels.panel1 !== undefined) {
        this.comicData!.panel1 = { 
          content: revisedPanels.panel1 === "null" ? null : revisedPanels.panel1, 
          missing_content: revisedPanels.panel1 === "null" ? "이벤트 1" : null,
          grid: this.comicData!.panel1?.grid // 기존 grid 정보 보존
        };
      }
      if (revisedPanels.panel2 !== undefined) {
        this.comicData!.panel2 = { 
          content: revisedPanels.panel2 === "null" ? null : revisedPanels.panel2, 
          missing_content: revisedPanels.panel2 === "null" ? "이벤트 2" : null,
          grid: this.comicData!.panel2?.grid // 기존 grid 정보 보존
        };
      }
      if (revisedPanels.panel3 !== undefined) {
        this.comicData!.panel3 = { 
          content: revisedPanels.panel3 === "null" ? null : revisedPanels.panel3, 
          missing_content: revisedPanels.panel3 === "null" ? "이벤트 3" : null,
          grid: this.comicData!.panel3?.grid // 기존 grid 정보 보존
        };
      }
      if (revisedPanels.panel4 !== undefined) {
        this.comicData!.panel4 = { 
          content: revisedPanels.panel4 === "null" ? null : revisedPanels.panel4, 
          missing_content: revisedPanels.panel4 === "null" ? "감정" : null,
          grid: this.comicData!.panel4?.grid // 기존 grid 정보 보존
        };
      }
      
      console.log(`[DEBUG] Revision applied successfully`);
      console.log("도도: 알겠어! 수정했어! ✏️");
      
    } catch (error) {
      console.error('수정 적용 실패:', error);
      console.log("도도: 어? 수정하는데 문제가 생겼어. 다시 말해줘! 😅");
    }
  }

  private async handleComicContextStage(message: string): Promise<string> {
    console.log(`[DEBUG] handleComicContextStage - message: "${message}"`);
    console.log(`[DEBUG] Current comicData:`, this.comicData);
    
    // Python comic_context.py와 동일하게: 첫 번째 메시지에서는 분석만 수행
    if (!this.storyAnalysis) {
      console.log(`[DEBUG] First message in comic_context, creating storyAnalysis...`);
      this.storyAnalysis = await this.analyzeStoryFlow();
      console.log(`[DEBUG] Created storyAnalysis:`, this.storyAnalysis);
      
      // Python과 동일하게: 첫 번째 메시지로 패널 재구성 (사용자 답변 기반)
      console.log(`[DEBUG] Reconstructing panel with first message: "${message}"`);
      await this.reconstructPanel(message, "", true); // 첫 번째 메시지는 conversation history에 추가하지 않음
      console.log(`[DEBUG] After first reconstruction, comicData:`, this.comicData);
    } else {
      console.log(`[DEBUG] Using existing storyAnalysis:`, this.storyAnalysis);
      console.log(`[DEBUG] Reconstructing panel with message: "${message}"`);
      await this.reconstructPanel(message, "사용자 입력", false);
      console.log(`[DEBUG] After reconstruction, comicData:`, this.comicData);
      
      // Python과 동일하게: 재구성 후에만 분석 업데이트
      this.storyAnalysis = await this.analyzeStoryFlow();
      console.log(`[DEBUG] Updated storyAnalysis after reconstruction:`, this.storyAnalysis);
    }

    console.log(`[DEBUG] Checking if there are more issues...`);
    
    // storyAnalysis에서 문제점이 있는지 확인
    const hasIssues = [
      this.storyAnalysis.A && this.storyAnalysis.A.some((issue: string) => issue.trim()),
      this.storyAnalysis.B && this.storyAnalysis.B.some((issue: string) => issue.trim()),
      this.storyAnalysis.C && this.storyAnalysis.C.some((issue: string) => issue.trim()),
      this.storyAnalysis.D && this.storyAnalysis.D.some((issue: string) => issue.trim()),
      this.storyAnalysis.Order && this.storyAnalysis.Order.some((issue: string) => issue.trim())
    ].some(Boolean);

    console.log(`[DEBUG] hasIssues: ${hasIssues}`);

    if (!hasIssues) {
      console.log(`[DEBUG] No more issues, transitioning to REVISION_2`);
      
      // comic_context의 최종 결과물로 새로운 grid 생성
      await this.generateComicPanels();
      
      this.chatbotStage = ChatbotStage.REVISION_2;
      this.focusedPanel = undefined; // revision_2에서는 포커스 하이라이트 제거
      return "완성! 이제 수정하거나 추가하고 싶은 부분 있어? 🤔";
    } else {
      console.log(`[DEBUG] Still has issues, getting next question...`);
      const nextQuestion = await this.getNextQuestion();
      console.log(`[DEBUG] Next question: "${nextQuestion}"`);
      
      // current category to focus on을 직접 결정
      const categories = ['A', 'B', 'C', 'D', 'Order'];
      let currentCategory: string | null = null;
      for (const category of categories) {
        const issues = this.storyAnalysis[category] || [];
        if (issues && Array.isArray(issues) && issues.some((issue: string) => issue.trim())) {
          currentCategory = category;
          break;
        }
      }
      
      // focusedPanel 설정
      if (currentCategory && ['A', 'B', 'C', 'D'].includes(currentCategory)) {
        this.focusedPanel =
          currentCategory === 'A' ? 'panel1' :
          currentCategory === 'B' ? 'panel2' :
          currentCategory === 'C' ? 'panel3' :
          currentCategory === 'D' ? 'panel4' : undefined;
      } else {
        this.focusedPanel = undefined;
      }
      
      console.log(`[DEBUG] Current category to focus on: ${currentCategory}, focusedPanel: ${this.focusedPanel}`);
      
      return nextQuestion || "다음에 대해 말해줘!";
    }
  }

  private async handleRevision2Stage(message: string): Promise<string> {
    console.log(`[DEBUG] handleRevision2Stage - message: "${message}", revisionCount: ${this.revisionCount}`);
    
    // "네가 말해준 내용대로 바꿔봤어. 이제 다 맞을까?" 질문에 대한 답변 처리
    if (this.lastBotMessage?.includes('네가 말해준 내용대로 바꿔봤어')) {
      console.log(`[DEBUG] Processing response to "is it correct now" question`);
      
      if (message.toLowerCase().includes('아니') || message.toLowerCase().includes('no') || message.toLowerCase().includes('n')) {
        // 아직도 틀린 부분이 있다면 다시 수정 요청
        console.log(`[DEBUG] User said no to "is it correct now", asking for more corrections`);
        return "어디를 어떻게 수정해볼까?? 🤔";
      } else if (message.toLowerCase().includes('응') || message.toLowerCase().includes('네') || message.toLowerCase().includes('yes') || message.toLowerCase().includes('y')) {
        // 이제 맞다고 하면 완료
        console.log(`[DEBUG] User said yes to "is it correct now", completing`);
        this.chatbotStage = ChatbotStage.COMPLETE;
        return "이제 만화일기 완성이닷 🏅";
      } else {
        return "응 아니 중에 골라줘! 😅";
      }
    }
    
    // "여기서 수정하거나 추가하고 싶은 부분 있어?" 질문에 대한 답변 처리
    if (this.revisionCount === 0) {
      console.log(`[DEBUG] First message in REVISION_2, processing yes/no response`);
      
      if (message.toLowerCase().includes('아니') || message.toLowerCase().includes('no') || message.toLowerCase().includes('n')) {
        // "아니"라고 답한 경우, 완료
        console.log(`[DEBUG] User said no to revisions, completing`);
        this.chatbotStage = ChatbotStage.COMPLETE;
        return "이제 만화일기 완성이닷 🏅";
      } else if (message.toLowerCase().includes('응') || message.toLowerCase().includes('네') || message.toLowerCase().includes('yes') || message.toLowerCase().includes('y')) {
        console.log(`[DEBUG] User said yes, incrementing revisionCount`);
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
    
    // 구체적인 수정 내용이 들어온 경우 (Python revision_2.py와 동일한 로직)
    console.log(`[DEBUG] User provided specific revision: "${message}"`);
    
    // 수정 내용을 적용
    await this.applyRevision(message);
    
    // 수정 후 다시 확인 (Python과 동일한 메시지)
    return "네가 말해준 내용대로 바꿔봤어. 이제 다 맞을까? 🤔";
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

  private async analyzeStoryFlow(): Promise<any> {
    const panelsContent = {
      panel1: this.comicData?.panel1?.content || null,
      panel2: this.comicData?.panel2?.content || null,
      panel3: this.comicData?.panel3?.content || null,
      panel4: this.comicData?.panel4?.content || null
    };

    console.log(`[DEBUG] analyzeStoryFlow - panelsContent:`, panelsContent);

    const systemPrompt = `You are "ABCD-Diary Reviewer."

────────────────────
INPUT (always 4 lines)
────────────────────
panel1  = A - Antecedent   // where, who, situation (time optional)
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
• Produce nothing except the single JSON block.

────────────────────
EXAMPLES
────────────────────

# Example 1
Input  
"panel1": "Minsoo and I performed a mackerel dissection show at school.",  
"panel2": null,  
"panel3": "I cut off the head, opened the belly and put the organs in a bag.",  
"panel4": null

Output  
{
  "situation_type": "normal",
  "A": ["background situation missing — e.g. 'during break time'"],
  "B": ["B missing — behavior is actually written in panel 3"],
  "C": [
    "Non-C content in C (behavior described)",
    "consequence missing — e.g. 'Minsoo laughed and said 'That's amazing'"
  ],
  "D": ["Emotion missing — e.g. 'I was happy'"],
  "Order": ["panel 2 and panel 3 should be swapped (Behavior - Consequence)"]
}

# Example 2 
Input  
"panel1": "I told Mom I wanted to visit an amusement park.",  
"panel2": "Mom said, 'Sure, let's go.'",  
"panel3": "We will go next Saturday and ride the roller-coaster.",  
"panel4": "I felt thrilled."

Output  
{
  "situation_type": "normal",
  "A": [
    "place missing — e.g. 'home'",
    "Non-A content in A (telling Mom is a behavior, which is B)"
  ],
  "B": [
    "Non-B content in B (Mom's reaction belongs to C)",
    "B missing — actual behavior is in panel 1"
  ],
  "C": [""],                    
  "D": [""],
  "Order": ["Behavior in panel 1 should move to panel 2",
    "Reaction in panel 2 should move to panel 3"]
}

# Example 3 
Input  
"panel1": "I walked down the hallway at school.",  
"panel2": "Sohyun suddenly blocked my way and started crying.",  
"panel3": null,  
"panel4": "I felt nervous and sweaty."

{
  "situation_type": "problematic",
  "A": [""],
  "B": [
    "reason for crying missing — e.g. 'because I accidentally bumped her'"
  ],
  "C": [
    "C missing — e.g. 'Sohyun kept crying and wouldn't move'"
  ],
  "D": [""],
  "Order": [""]
}`;

    const userPrompt = `Analyze Below Panels:
"panel1": "${panelsContent.panel1 || 'null'}",
"panel2": "${panelsContent.panel2 || 'null'}",
"panel3": "${panelsContent.panel3 || 'null'}",
"panel4": "${panelsContent.panel4 || 'null'}"
`;

    console.log(`[DEBUG] analyzeStoryFlow - sending request to OpenAI`);

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4.1-mini-2025-04-14",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.05,
        max_tokens: 500
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{"A": [], "B": [], "C": [], "D": [], "Order": []}');
      console.log(`[DEBUG] analyzeStoryFlow - result:`, result);
      return result;
    } catch (error) {
      console.error('스토리 분석 실패:', error);
      return { A: [], B: [], C: [], D: [], Order: [] };
    }
  }

  private async reconstructPanel(answer: string, question: string, addToHistory: boolean = true): Promise<void> {
    if (!this.storyAnalysis) {
      this.storyAnalysis = await this.analyzeStoryFlow();
    }

    const systemPrompt = `${CHARACTER_BACKGROUND}

You are a rewriting engine that fixes 4-panel diary drafts written in first-person Korean past tense based on the user's answer and analysis_result.

ABCD STRUCTURE:
- A (panel1): Antecedent - where, who, situation 
- B (panel2): Behavior - observable action, how/with what
- C (panel3): Consequence - immediate result or existing character's response (avoid new characters)
- D (panel4): Emotion - writer's own feeling only (emotion word)

CRITICAL RULES - YOU MUST FOLLOW THESE EXACTLY when you fill the panels:
1. **ONLY use content from "panels_original" + "new_QA.answer"**
2. **NEVER use ANY content from "analysis_result"**
3. **NEVER invent new events, lines, or feelings**
4. **KEEP ALL content from "panels_original" - NEVER delete or remove existing content**

TRANSFORMATION RULES:
1. **When adding missing information:**
   • ONLY use information from user's answer (new_QA.answer)
   • If user mentioned place/time → add to panel1 (A)
   • If user mentioned behavior → add to panel2 (B)
   • If user mentioned consequence → add to panel3 (C)
   • If user mentioned emotion words → add to panel4 (D)
   • If user didn't provide specific information → leave panel as null

2. **analysis_result is ONLY for:**
   - Order changes (swapping panels as stated in Order)
   - Moving content to correct categories (A/B/C/D) if it's in wrong panel
   • Non-A content in A → move to appropriate panel ONLY if it exists in original
   • Non-B content in B → move to appropriate panel ONLY if it exists in original
   • Non-C content in C → move to appropriate panel ONLY if it exists in original
   • Non-D content in D → move to appropriate panel ONLY if it exists in original

3. **Each panel must contain only content appropriate for its category**
4. **Keep each panel to one Korean past-tense sentence, first-person diary style**

ABSOLUTELY FORBIDDEN - NEVER DO THESE:
- Using any text from analysis_result issues
- Creating content based on analysis_result suggestions
- Filling panels with analysis_result examples
- Using analysis_result to generate new content
- Copying any part of analysis_result into panels

Output exactly this JSON (nothing else, no line breaks inside values):

{
  "panel1": "...",
  "panel2": "...",
  "panel3": "...",
  "panel4": "..."
}

Write items in natural Korean during real use. (The examples below stay English for clarity only.)  

Here are the examples:
### Example 1
<panels_original>
"panel1": "Minsoo and I performed a mackerel dissection show at school.",  
"panel2": null,  
"panel3": "I cut off the head, opened the belly and put the organs in a bag.",  
"panel4": null
<new_QA>
question: "와! 고등어 해부 쇼라니 대박이다! 🐟 학교에서 언제 했어? 1) 쉬는 시간? 2) 점심시간?"
answer: "1"
<analysis_result>
{
  "A": ["background situation missing — e.g. 'during break time'"],
  "B": ["B missing — behavior is actually written in panel 3"],
  "C": ["Non-C content in C (behavior described)", "consequence missing — e.g. 'Minsoo laughed and said 'That's amazing'"],
  "D": ["Emotion missing — e.g. 'I was happy'"],
  "Order": ["panel 2 and panel 3 should be swapped (Behavior - Consequence)"]
}
<expected_output>
{
  "panel1": "Minsoo and I performed a mackerel dissection show at school in break time.",  
  "panel2": "I cut off the head, opened the belly and put the organs in a bag.",  
  "panel3": null,  
  "panel4": null
}

### Example 2 
<panels_original>
"panel1": "I told Mom I wanted to visit an amusement park.",  
"panel2": "Mom said, 'Sure, let's go.'",  
"panel3": "We will go next Saturday and ride the roller-coaster.",  
"panel4": "I felt thrilled."
<new_QA>
question: "롤러코스터라니 나도 떨린다! 😅 그럼 어머니랑 그 이야기는 어디서 했어? 1) 집에서? 2) 산책하다가?"
answer: "1"
<analysis_result>
{
  "A": [
    "place missing — e.g. 'home'",
    "Non-A content in A (telling Mom is a behavior, which is B)"
  ],
  "B": [
    "Non-B content in B (Mom's reaction belongs to C)",
    "B missing — actual behavior is in panel 1"
  ],
  "C": [""],                    
  "D": [""],
  "Order": ["Behavior in panel 1 should move to panel 2",
    "Reaction in panel 2 should move to panel 3"]
}
<expected_output>
{
  "panel1": "I was at home with my mother.",  
  "panel2": "I told Mom I wanted to visit an amusement park.",  
  "panel3": "Mom said, 'Sure, let's go.' so we will go next Saturday and ride the roller-coaster.",  
  "panel4": "I felt thrilled."
}

### Example 3
<panels_original>
"panel1": "I walked down the hallway at school.",  
"panel2": "Sohyun suddenly blocked my way and started crying.",  
"panel3": null,  
"panel4": "I felt nervous and sweaty."
<new_QA>
question: "아이구.. 갑자기 나타나 울어서 당황스러웠겠다 😮 울기 전에 무슨 일이 있었어?"
answer: "내가 그냥 지나갔어."
<analysis_result>
{
"A": [""],
"B": [
    "reason for crying missing — e.g. 'because I accidentally bumped her'"
  ],
  "C": [
    "C missing — e.g. 'Sohyun kept crying and wouldn't move'"
  ],
  "D": [""],
  "Order": [""]
}
<expected_output>
{
  "panel1": "I walked down the hallway at school.",  
  "panel2": "Sohyun suddenly blocked my way and started crying because I just passed her.",  
  "panel3": null,  
  "panel4": "I felt nervous and sweaty."
}

<analysis_result>
${JSON.stringify(this.storyAnalysis, null, 2)}`;

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

`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4.1-mini-2025-04-14",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0,
        max_tokens: 500
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      // Update comic data
      if (result.panel1 !== undefined) {
        this.comicData!.panel1 = { content: result.panel1 === "null" ? null : result.panel1, missing_content: result.panel1 ? null : "이벤트 1" };
      }
      if (result.panel2 !== undefined) {
        this.comicData!.panel2 = { content: result.panel2 === "null" ? null : result.panel2, missing_content: result.panel2 ? null : "이벤트 2" };
      }
      if (result.panel3 !== undefined) {
        this.comicData!.panel3 = { content: result.panel3 === "null" ? null : result.panel3, missing_content: result.panel3 ? null : "이벤트 3" };
      }
      if (result.panel4 !== undefined) {
        this.comicData!.panel4 = { content: result.panel4 === "null" ? null : result.panel4, missing_content: result.panel4 ? null : "감정" };
      }

      // Update conversation history (Python 코드와 동일)
      if (addToHistory) {
        this.comicContextHistory.push({
          user: answer,
          bot: question
        });
      }
      
    } catch (error) {
      console.error('패널 재구성 실패:', error);
    }
  }

  private isComplete(): boolean {
    if (!this.comicData) return false;
    
    // 모든 패널에 content가 있고, 빈 문자열이 아닌지 확인
    const panels = [this.comicData.panel1, this.comicData.panel2, this.comicData.panel3, this.comicData.panel4];
    return panels.every(panel => 
      panel?.content && 
      panel.content !== null && 
      panel.content !== undefined && 
      panel.content.trim() !== ''
    );
  }

  private async getNextQuestion(): Promise<string | null> {
    console.log(`[DEBUG] getNextQuestion - storyAnalysis:`, this.storyAnalysis);
    
    if (!this.storyAnalysis) {
      console.log(`[DEBUG] No storyAnalysis, returning null`);
      return null;
    }

    // Check if there are any issues in A, B, C, D categories
    const hasIssues = [
      this.storyAnalysis.A && this.storyAnalysis.A.some((issue: string) => issue.trim()),
      this.storyAnalysis.B && this.storyAnalysis.B.some((issue: string) => issue.trim()),
      this.storyAnalysis.C && this.storyAnalysis.C.some((issue: string) => issue.trim()),
      this.storyAnalysis.D && this.storyAnalysis.D.some((issue: string) => issue.trim()),
      this.storyAnalysis.Order && this.storyAnalysis.Order.some((issue: string) => issue.trim())
    ].some(Boolean);

    console.log(`[DEBUG] hasIssues: ${hasIssues}`);

    if (!hasIssues) {
      console.log(`[DEBUG] No issues found, returning null`);
      return null;
    }

    // Create conversation summary (Python과 동일하게)
    let conversationSummary = "";
    if (this.comicContextHistory.length > 0) {
      // Python과 동일하게: 최근 4개의 대화만 사용
      const recentConversations = this.comicContextHistory.slice(-4);
      conversationSummary = "\nPrevious Q&A:\n" + recentConversations
        .map(entry => `Q: ${entry.bot}\nA: ${entry.user}`)
        .join('\n');
    }

    console.log(`[DEBUG] Conversation summary:`, conversationSummary);

    // Check for consecutive "don't know" answers
    const dontKnowKeywords = ["모르겠어", "기억 안 나", "잘 모르겠어", "모르겠다", "기억이 안 나", "잘 모르겠다", "몰라", "모르겠다고"];
    const recentAnswers = this.comicContextHistory.slice(-3).map(entry => entry.user);
    const consecutiveDontKnowCount = recentAnswers.filter(answer => 
      dontKnowKeywords.some(keyword => answer.toLowerCase().includes(keyword))
    ).length;

    console.log(`[DEBUG] Consecutive "don't know" count: ${consecutiveDontKnowCount}`);

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
   - If "normal": Focus on "HOW" questions (methods, details)
3. **CRITICAL: Focus on the FIRST missing information in order: A → B → C → D → Order**
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

=== CRITICAL: Imagination Rule ===
15. **ONLY if EXACTLY 3+ consecutive "don't know" answers for the current category:**
    - **MUST** change approach to encourage imagination
    - Start with "그럼 상상해볼까?" or "아마도..." with emojis
    - Make it fun and creative rather than factual
    - Use phrases like "아마도", "상상해보면", "그랬을 것 같아"
    - Focus on what would be most likely or interesting
    - **ALWAYS** provide 2-3 imaginative choices
    - Example: "그럼 상상해보자! 😊 아마도 어떻게 됐을까? 1) ... 2) ... 3) ..."

16. **If LESS than 3 consecutive "don't know" answers:**
    - Continue with normal situational overview questions
    - Do NOT use imagination prompts
    - Focus on gathering more context and details

=== Output Format (JSON only) ===
{
  "question": "question in Korean"
}

- Write items in natural Korean during real use. (The examples below stay English for clarity only.)  
Here are the examples:
### Example 1
Input:
"panel1": "Minsoo and I performed a mackerel dissection show at school.",  
"panel2": null,  
"panel3": "I cut off the head, opened the belly and put the organs in a bag.",  
"panel4": null

analysis_result:
{
  "situation_type": "normal",
  "A": ["background situation missing — e.g. 'during break time'"],
  "B": ["B missing — behavior is actually written in panel 3"],
  "C": ["Non-C content in C (behavior described)", "consequence missing — e.g. 'Minsoo laughed and said 'That's amazing'"],
  "D": ["Emotion missing — e.g. 'I was happy'"],
  "Order": ["panel 2 and panel 3 should be swapped (Behavior - Consequence)"]
}

conversation_summary:

Output:
{
"question": "대박대박! 너무 신기하다! 학교에서 어떤 상황에 했던 거야? 1) 쉬는 시간? 아니면 2) 점심시간?"
}

### Example 2
Input:
"panel1": "I told Mom I wanted to visit an amusement park.",  
"panel2": "Mom said, 'Sure, let's go.'",  
"panel3": "We will go next Saturday and ride the roller-coaster.",  
"panel4": "I felt thrilled."

analysis_result:
{
  "situation_type": "normal",
  "A": [
    "place missing — e.g. 'home'",
    "Non-A content in A (telling Mom is a behavior, which is B)"
  ],
  "B": [
    "Non-B content in B (Mom's reaction belongs to C)",
    "B missing — actual behavior is in panel 1"
  ],
  "C": [""],                    
  "D": [""],
  "Order": ["Behavior in panel 1 should move to panel 2",
    "Reaction in panel 2 should move to panel 3"]
}

conversation_summary:
Q: "놀이공원 너무 재미있겠다~! 가자고 하니 어머니께서는 뭐라고 말씀하셨어?"
A: "가자고 해서 우리 다음주 토요일에 가가지고 롤러코스터 탈거야."
Q: "우와~ 진짜 너무 좋겠다!! 기분이 어때?"
A: "완전 떨려"

Output:
{
"question": "롤러코스터라니 나도 떨린다! 😅 그럼 어머니랑 그 이야기는 어디서 했어? 1) 집에서? 2) 산책하다가?"
}

### Example 3
Input:
"panel1": "I walked down the hallway at school.",  
"panel2": "Sohyun suddenly blocked my way and started crying.",  
"panel3": null,  
"panel4": "I felt nervous and sweaty."

analysis_result:
{
"situation_type": "problematic",
"A": [""],
"B": [
    "reason for crying missing — e.g. 'because I accidentally bumped her'"
  ],
  "C": [
    "C missing — e.g. 'Sohyun kept crying and wouldn't move'"
  ],
  "D": [""],
  "Order": [""]
}

conversation_summary:
Q: "갑자기 나타났다니 당황스러웠겠다 😮 소현이는 갑자기 왜 운거야? 그 때 상황 기억나면 말해줘."
A: "모르겠어"
Q: "소현이가 울면서 뭔가 말했어? 🤨"
A: "몰라"
Q: "소현이 주위에 다른 사람이 있었어? 👫"
A: "모른다고"

Output:
{
"question": "아이구.. 진짜 기억이 안 나는구나 😅 그럼 상상해보자! 소현이는 왜 운걸까? 1) 갑자기 다른 친구가 괴롭혔을까? 2) 선생님께 혼났을까? 3) 슬픈 일이 생각났을까?"
}`;

    // Create issue summary for the prompt
    let issueSummary = "";
    for (const category of ["A", "B", "C", "D", "Order"]) {
      const issues = this.storyAnalysis[category] || [];
      if (issues && Array.isArray(issues) && issues.some((issue: string) => issue.trim())) {
        issueSummary += `\n${category} 문제:\n`;
        issues.forEach(issue => {
          if (issue.trim()) {
            issueSummary += `- ${issue}\n`;
          }
        });
      }
    }

    const userPrompt = `Current comic panels:
"panel1": "${this.comicData?.panel1?.content || 'null'}",
"panel2": "${this.comicData?.panel2?.content || 'null'}",
"panel3": "${this.comicData?.panel3?.content || 'null'}",
"panel4": "${this.comicData?.panel4?.content || 'null'}"

analysis_result:
${JSON.stringify(this.storyAnalysis, null, 2)}

conversation_summary:${conversationSummary}

issue_summary:${issueSummary}

consecutive_dont_know_count: ${consecutiveDontKnowCount}

Please generate a question that addresses the FIRST missing information gap.`;

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

      const result = JSON.parse(response.choices[0]?.message?.content || '{"question": "다음에 대해 말해줘!"}');
      console.log(`[DEBUG] Generated question:`, result);
      
      // current category to focus on 정보는 내부적으로만 사용하고, 질문만 반환
      return result.question;
    } catch (error) {
      console.error('질문 생성 실패:', error);
      return "다음에 대해 말해줘!";
    }
  }

  // Python과 동일하게: farewell 메시지와 최종 요약을 분리
  public getFinalSummary(): string {
    return this.getFinalSummaryInternal();
  }

  private async generateComicPanels(): Promise<void> {
    try {
      console.log(`[DEBUG] Generating comic panels from Revision_1 data`);
      
      // 현재 comicData에서 패널 내용 추출
      const panelContents = {
        panel1: this.comicData?.panel1?.content || "null",
        panel2: this.comicData?.panel2?.content || "null",
        panel3: this.comicData?.panel3?.content || "null",
        panel4: this.comicData?.panel4?.content || "null"
      };
      
      console.log(`[DEBUG] Panel contents for comic generation:`, panelContents);
      
      // API 키 가져오기 (constructor에서 받은 것을 사용)
      const apiKey = (this.openai as any).apiKey;
      
      // FourSceneComic 인스턴스 생성 및 실행
      const fourSceneComic = new FourSceneComic(panelContents, apiKey);
      const generatedComicData = await fourSceneComic.generate();
      
      console.log(`[DEBUG] Generated comic data:`, generatedComicData);
      
      // 생성된 comic data를 현재 comicData에 저장
      // 기존 content는 유지하고 grid 정보만 추가
      if (generatedComicData.panel1) {
        this.comicData!.panel1 = {
          ...this.comicData!.panel1,
          grid: generatedComicData.panel1.grid
        };
      }
      if (generatedComicData.panel2) {
        this.comicData!.panel2 = {
          ...this.comicData!.panel2,
          grid: generatedComicData.panel2.grid
        };
      }
      if (generatedComicData.panel3) {
        this.comicData!.panel3 = {
          ...this.comicData!.panel3,
          grid: generatedComicData.panel3.grid
        };
      }
      if (generatedComicData.panel4) {
        this.comicData!.panel4 = {
          ...this.comicData!.panel4,
          grid: generatedComicData.panel4.grid
        };
      }
      
      console.log(`[DEBUG] Updated comicData with generated grids:`, this.comicData);
      
    } catch (error) {
      console.error('Comic panel generation failed:', error);
    }
  }
} 