import OpenAI from 'openai';

export type TileType = 'empty' | 'figure' | 'object' | 'location' | 'think' | 'tell' | 'emotion';

interface Tile {
  type: TileType;
  content: string;
  position: [number, number];
}

interface Panel {
  content: string;
  grid: Tile[][];
}

interface ComicData {
  [key: string]: Panel;
}

// 첫 번째 분석 단계의 결과를 위한 인터페이스
interface SceneElement {
  panel: string;
  act: string;
  figure: string;
  object: string;
  location: string;
  think?: string;
  tell?: string;
  emotion?: string;
}

type PanelAnalysis = SceneElement[];

interface CoreTopology {
  type: 'figure' | 'object';
  content: string;
  relation: {
    relativeTo?: string;
    position: 'above' | 'below' | 'beside' | 'apart';
    direction?: 'left' | 'right';
  };
}

class ScenePanel {
  content: string;
  grid: Tile[][];
  analysis?: SceneElement[];

  constructor(content: string) {
    this.content = content;
    this.grid = Array(5).fill(null).map((_, y) =>
      Array(5).fill(null).map((_, x) => ({
        type: 'empty',
        content: '',
        position: [x, y]
      }))
    );
  }

  placeElement(type: TileType, content: string, x: number, y: number): boolean {
    if (x >= 0 && x < 5 && y >= 0 && y < 5) {
      this.grid[y][x] = { type, content, position: [x, y] };
      return true;
    }
    return false;
  }

  toJSON(): Panel {
    return {
      content: this.content,
      grid: this.grid
    };
  }
}

export class FourSceneComic {
  private openai: OpenAI;
  private panels: Map<string, ScenePanel>;

  constructor(panelContents: Record<string, string>, apiKey: string) {
    this.openai = new OpenAI({ 
      apiKey,
      dangerouslyAllowBrowser: true
    });
    this.panels = new Map();
    
    for (let i = 1; i <= 4; i++) {
      const key = `panel${i}`;
      this.panels.set(key, new ScenePanel(panelContents[key]));
    }
  }

  private async analyzeStory(): Promise<PanelAnalysis> {
    const panelContents = Array.from(this.panels.entries()).reduce((acc, [key, panel]) => {
      acc[key] = panel.content;
      return acc;
    }, {} as Record<string, string>);

    console.log('Panel Contents:', JSON.stringify(panelContents, null, 2));

    const system_prompt = `You are an expert in information-extraction and comic scene designer. Return only a JSON array that follows these rules.

1. Allowed keys (exact spelling, lower-case):
panel, act, figure, object, location, think, tell, emotion

2. Act selection
• If the sentence expresses thought or desire → act:"생각" and fill think with the thought content
  - Use "~거야" form for thoughts (예: "놀이공원에 가고 싶다" → "놀이공원에 가고 싶어")
  - Do not use "~거라" form
• If the sentence contains speech or dialogue:
  - Extract the spoken content and set act:"대화" with tell
  - If there's another action in the same sentence, create a separate entry with that action
  Example: "경비아저씨가 우리에게 비가 많이 오니 피하라고 큰소리 치셨다"
    → [
      {"panel":"2","act":"대화","figure":"경비아저씨","object":"","location":"공원", "tell":"비가 많이 오니 피해!"},
      {"panel":"2","act":"큰소리치셨다","figure":"경비아저씨","object":"","location":"공원"}
    ]
• Otherwise, set act to the exact Korean verb phrase appearing in the sentence (예: 찼다, 날아갔다, 나갔다, 산책했다, 숨었다)
  - Also extract any objects that are part of the action
  - Example: "컴퓨터 게임 중이었다" → act:"게임 중이었다", object:"컴퓨터"
  - Example: "책을 읽고 있었다" → act:"읽고 있었다", object:"책"
  - Example: "축구공을 찼다" → act:"찼다", object:"축구공"

3. Figure and Location extraction
• Always extract the subject of the action as figure
• Extract location ONLY when the action actually happens at that place (using ~에서, ~에, etc.)
  - Correct: "공원에서 놀았다" → location:"공원"
  - Correct: "버스정류장 밑으로 뛰어갔다" → location:"버스정류장 밑"
  - Incorrect: "꿈에 놀이공원이 나왔어" → location:"" (just mentioned, not the current action location)
• When analyzing location with spatial relations (밑, 위, 옆, 앞, 뒤), treat the reference object as both object and location
• When an action involves multiple figures (주체와 대상), include all of them in the figure field
  Example: "내가 영호를 밀었다"
    → figure:"나, 영호", act:"밀었다"
  Example: "선생님이 나를 잡았다"
    → figure:"선생님, 나", act:"잡았다"

4. Object selection
• Only physical objects that can be seen or touched should be listed as objects
• Do not treat actions or verbs as objects
• Examples of objects: 축구공, 의자, 책, 가방, 공책
• Examples of what are NOT objects: 점프, 달리기, 걷기, 뛰기

5. One panel may contain multiple actions; output one object per action, all with the same panel value.

6. Preserve every Korean word exactly as written in the panels.

7. For any empty value, write an empty string "".

8. Respond with valid JSON only—no explanations, comments, or extra keys.

Below is a worked example; follow the same schema

Example 1:
panel1: "나는 엄마랑 집 근처에서 산책했다"
panel2: "산책하다보니 놀이공원에 가고 싶어졌다."
panel3: "그래서 엄마에게 놀이공원 가고 싶다고 이야기를 했고 엄마도 가자고 했다"
panel4: "나는 기뻤다"

Expected JSON
[
{"panel":"1","act":"산책했다","figure":"나, 엄마","object":"","location":"집 근처"},
{"panel":"2","act":"생각","figure":"나","object":"","location":"집 근처","think":"놀이공원에 가고 싶어"},
{"panel":"3","act":"대화","figure":"나","object":"","location":"집 근처","tell":"놀이공원 가고 싶어요!"},
{"panel":"3","act":"대화","figure":"엄마","object":"","location":"집 근처","tell":"그래, 가자!"},
{"panel":"4","act":"감정","figure":"나","object":"","location":"","emotion":"기쁨"}
]

Example 2:
panel1: "나는 민수와 학교 운동장에서 축구공을 찼다"
panel2: "민수가 어하는 순간 공이 담장을 넘었다"
panel3: "우리는 공을 찾으러 담장 밖으로 나가서 공을 찾았다"
panel4: "나는 기뻤다"

Expected JSON
[
{"panel":"1","act":"찼다","figure":"나, 민수","object":"축구공","location":"학교 운동장"},
{"panel":"2","act":"대화","figure":"민수","object":"","location":""},
{"panel":"2","act":"날아갔다","figure":"축구공","object":"","location":"담장 너머"},
{"panel":"3","act":"나갔다","figure":"나, 민수","object":"","location":"담장 밖"},
{"panel":"3","act":"찾았다","figure":"나, 민수","object":"축구공","location":"담장 밖"},
{"panel":"4","act":"감정","figure":"나","object":"","location":"","emotion":"기쁨"}
]

Example 3:
panel1: "나는 공원에서 친구에게 선물을 주고 있었다."
panel2: "그런데 갑자기 경비아저씨가 우리에게 비가 많이 오니 피하라고 큰소리 치셨다"
panel3: "우리는 급히 뛰어가서 버스정류장 밑에서 비를 피했다"
panel4: "나는 비에 젖어서 화가 났다"

Expected JSON
[
{"panel":"1","act":"선물을 주고 있었다","figure":"나, 친구","object":"","location":"공원"},
{"panel":"2","act":"대화","figure":"경비아저씨","object":"","location":"공원", "tell":"비가 많이 오니 피해!"},
{"panel":"2","act":"큰소리치셨다","figure":"경비아저씨","object":"","location":"공원"},
{"panel":"3","act":"뛰어갔다","figure":"나, 친구","object":"","location":""},
{"panel":"3","act":"피했다","figure":"나, 친구","object":"비","location":"버스정류장 밑"},
{"panel":"4","act":"감정","figure":"나","object":"","location":"","emotion":"화남"}
]`;

    const user_prompt = `Convert the new panels that follow.
Panel 1: "${panelContents.panel1}"
Panel 2: "${panelContents.panel2}"
Panel 3: "${panelContents.panel3}"
Panel 4: "${panelContents.panel4}"`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4.1-mini-2025-04-14',
      messages: [
        { role: 'system', content: system_prompt },
        { role: 'user', content: user_prompt }
      ],
      temperature: 0.2
    });

    try {
      const result = JSON.parse(response.choices[0].message.content || '[]') as PanelAnalysis;
      console.log('Story Analysis Result:', JSON.stringify(result, null, 2));
      return result;
    } catch {
      return [] as PanelAnalysis;
    }
  }

  private async determineTopology(panelId: string, analysis: SceneElement[]): Promise<Array<{ type: TileType; content: string; position: [number, number] }>> {
    const panelElements = analysis.filter(element => element.panel === panelId.replace('panel', ''));
    
    const systemPrompt = `You are a comic panel topology designer that determines core relationships between figures and objects.

Input  : One panel's semantic JSON objects  
Output : A JSON array of items where every relevant pair of elements is represented by an object describing their spatial relationship (topology).
Respond with the array only—no extra text.

OUTPUT FORMAT
- A JSON array of objects.
- Keys: "target 1", "target 2", "topology".
- topology is one or more keywords separated by ", ".
- Do not wrap the array in code fences or prose.

RELATION KEYWORDS (fixed)
beside  → laterally adjacent or same row
below   → target 2 is below target 1 (target 2 is in front of target 1, target 2 will be placed in a row with a larger number than target 1)
above   → target 2 is above target 1 (target 2 is behind target 1, target 2 will be placed in a row with a smaller number than target 1)
(Use only these unless told otherwise.)

JUDGMENT RULES
1. act (행동) hints at positions
   - "찼다/차다/발로" → figure ↔ object: beside, below
   - "던졌다/날아갔다" → figure → object: below; object → obstacle: above
   - "피했다/숨었다" → figure → shelter: above; shelter → threat: below
2. location can add background elements (담장, 운동장 …)
   - "A 너머 B" means A is below B, B is above A
   - "A 밑 B" means A is above B, B is below A
3. 대화 / tell / 생각 / think
   - Create "말풍선" for tell, "생각" for think
   - Speaker ↔ balloon/cloud: beside, below, above (all apply)
4. Multiple figures default to beside unless text says otherwise
5. If multiple objects exist, output every unordered pair exactly once

Below is a worked example; follow the same schema.

EXAMPLE 1  
INPUT  
{"panel":"1","act":"찼다","figure":"나, 민수","object":"축구공","location":"학교 운동장"}  
OUTPUT  
[
{"target 1":"나","target 2":"민수","topology":"beside"},
{"target 1":"나","target 2":"축구공","topology":"beside, below"},
{"target 1":"민수","target 2":"축구공","topology":"beside, below"}
]

EXAMPLE 2  
INPUT  
{"panel":"2","act":"대화","figure":"민수","object":"","location":"","tell":"어!?"},
{"panel":"2","act":"날아갔다","figure":"축구공","object":"","location":"담장 너머"}  
OUTPUT  
[
{"target 1":"민수","target 2":"어!?","topology":"beside, below, above"},
{"target 1":"담장","target 2":"축구공","topology":"above"},
{"target 1":"민수","target 2":"담장","topology":"apart"}
]

EXAMPLE 3
INPUT  
{"panel":"3","act":"피했다","figure":"나, 친구","object":"비","location":"버스정류장 밑"}
OUTPUT  
[
{"target 1":"나, 친구","target 2":"버스정류장","topology":"above"},
{"target 1":"버스정류장","target 2":"비","topology":"above"}
]`;

    const userPrompt = `Convert below elements to the topology:
Input elements for panel ${panelId}:
${panelElements.map(elem => JSON.stringify(elem, null, 2)).join('\n')}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4.1-mini-2025-04-14',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2
    });

    try {
      const topology = JSON.parse(response.choices[0].message.content || '[]');
      console.log(`Topology for panel ${panelId}:`, JSON.stringify(topology, null, 2));

      // GPT에게 실제 그리드 좌표를 결정하도록 요청
      const layout = await this.determineGridPositions(topology, panelElements);
      console.log(`Grid layout for panel ${panelId}:`, JSON.stringify(layout, null, 2));
      
      return layout;
    } catch {
      return [];
    }
  }

  private async determineGridPositions(
    topology: any[],
    elements: SceneElement[]
  ): Promise<Array<{ type: TileType; content: string; position: [number, number] }>> {
    // 모든 요소들을 수집 (중복 방지)
    const elementSet = new Set<string>();
    const allElements: Array<{ type: TileType; content: string }> = [];
    
    const addElement = (type: TileType, content: string) => {
      const key = `${type}:${content}`;
      if (!elementSet.has(key)) {
        elementSet.add(key);
        allElements.push({ type, content });
      }
    };
    
    elements.forEach(element => {
      // 인물 추가
      if (element.figure) {
        element.figure.split(', ').forEach(figure => {
          addElement('figure', figure);
        });
      }
      // 물체 추가
      if (element.object) {
        addElement('object', element.object);
      }
      // 말풍선 추가
      if (element.tell) {
        addElement('tell', element.tell);
      }
      // 생각 추가
      if (element.think) {
        addElement('think', element.think);
      }
      // 감정 추가
      if (element.emotion) {
        addElement('emotion', element.emotion);
      }
      // Location은 그리드에 표시하지 않음
    });

    console.log('Elements to place:', JSON.stringify(allElements, null, 2));
    console.log('Topology relationships:', JSON.stringify(topology, null, 2));

    const systemPrompt = `You are a comic panel layout designer. You MUST follow these rules strictly:

1. Grid is 5x5 (0-4 for both x and y)
   - Row 0 is at the top, Row 4 is at the bottom
   - Column 0 is at the left, Column 4 is at the right
2. Figures should be placed in rows 1-3
3. Objects should be placed relative to their related figures
4. Tell/think/emotion should be placed in any empty space next to the related figure
5. Location information is only used for reference in topology relationships, do not place it in the grid
6. ALL elements from "Elements to place" MUST be included in the output
7. ALL elements mentioned in "Topology relationships" MUST be included in the output
   - If an element appears in topology but not in "Elements to place", you MUST add it to the output
   - Example: If topology has "A" but it's not in elements, still include it in output
   - This is CRITICAL - no elements from topology should be missing

Topology to Grid Position Rules:
1. Position relationships:
   - beside: If A is beside B, place them in different columns but SAME row
   - below: If A is below B, place A in a row with a larger number than B (A is in front of B)
   - above: If A is above B, place A in a row with a smaller number than B (A is behind B)
   - If multiple elements have a 'beside' relationship (e.g., A, B, C all beside each other), ALL of them MUST be placed in the SAME row (row number must be identical), and only columns should differ.
2. Multiple relationships:
   - If there is ONLY ONE relationship, you MUST follow it EXACTLY
     Example: If A is "beside" B, they MUST be in the same row
     Example: If A is "below" B, A MUST be in a row with larger number
     Example: If A is "above" B, A MUST be in a row with smaller number
   - If there are TWO relationships, you MUST satisfy AT LEAST ONE of them
     Example: If A is "beside, below" B:
       * Either place them in the same row (satisfying "beside")
       * OR place A in a row with larger number (satisfying "below")
     Example: If A is "beside, above" B:
       * Either place them in the same row (satisfying "beside")
       * OR place A in a row with smaller number (satisfying "above")
3. For think/tell/emotion:
   - Place in any empty space adjacent to the related figure
   - If there's a below/above relationship, maintain it

IMPORTANT RULES:
1. ALL elements from "Elements to place" MUST be included in the output
2. ALL elements mentioned in "Topology relationships" MUST be included in the output
3. For single relationships, you MUST follow them EXACTLY
4. For double relationships, you MUST satisfy at least one of them
5. If multiple elements are mutually beside, ALL must be in the same row
6. No elements should be missing

VALIDATION CHECK:
Before returning the output, verify that:
1. All single relationships are EXACTLY satisfied
2. All double relationships satisfy at least one condition
3. All elements from the input are included
4. All elements mentioned in topology relationships are present in the output
5. If multiple elements are mutually beside, ALL must be in the same row

Example 1:
Input elements:
[
  {"type": "figure", "content": "나"},
  {"type": "tell", "content": "얼른 가자!"},
  {"type": "figure", "content": "민수"}
]

Input topology:
[
  {"target 1": "나", "target 2": "민수", "topology": "beside"},
  {"target 1": "나", "target 2": "말풍선", "topology": "beside, below"},
  {"target 1": "나", "target 2": "버스정류장", "topology": "above"},
  {"target 1": "민수", "target 2": "버스정류장", "topology": "above"}
]

Expected output:
[
  {"type": "figure", "content": "나", "position": [2, 2]},
  {"type": "tell", "content": "얼른 가자!", "position": [1, 2]},
  {"type": "figure", "content": "민수", "position": [3, 2]},
  {"type": "object", "content": "버스정류장", "position": [2, 1]},
  {"type": "object", "content": "버스정류장", "position": [3, 1]}
]

Example 2:
Input elements:
[
  {"type": "figure", "content": "나"},
  {"type": "figure", "content": "엄마"},
  {"type": "object", "content": "수건"}
]

Input topology:
[
  {"target 1": "나", "target 2": "엄마", "topology": "beside"},
  {"target 1": "나", "target 2": "수건", "topology": "beside, above"},
  {"target 1": "엄마", "target 2": "수건", "topology": "beside, above"}
]

Expected output:
[
  {"type": "figure", "content": "나", "position": [1, 2]},
  {"type": "figure", "content": "엄마", "position": [3, 2]},
  {"type": "object", "content": "수건", "position": [2, 2]}
]

Example 3:
Input elements:
[
  {"type": "figure", "content": "나"},
  {"type": "figure", "content": "선생님"},
  {"type": "object", "content": "숨바꼭질"}
]
Input topology:
[
  {"target 1": "나", "target 2": "선생님", "topology": "beside"},
  {"target 1": "나", "target 2": "숨바꼭질", "topology": "beside"},
  {"target 1": "선생님", "target 2": "숨바꼭질", "topology": "beside"}
]
Expected output:
[
  {"type": "figure", "content": "나", "position": [1, 2]},
  {"type": "figure", "content": "선생님", "position": [2, 2]},
  {"type": "object", "content": "숨바꼭질", "position": [3, 2]}
]

Return only a JSON array of grid positions. Use ONLY the elements provided in the input.`;

    const userPrompt = `Elements to place:
${JSON.stringify(allElements, null, 2)}

Topology relationships:
${JSON.stringify(topology, null, 2)}

Output format:
[
  {"type": "figure|object|tell|think|emotion", "content": "text", "position": [x, y]}
]

IMPORTANT: The output MUST include ALL elements from both "Elements to place" and "Topology relationships". No elements should be missing.`;

    const gridResponse = await this.openai.chat.completions.create({
      model: 'gpt-4.1-mini-2025-04-14',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1
    });

    console.log('GPT Response:', gridResponse.choices[0].message.content);

    try {
      const responseContent = gridResponse.choices[0].message.content || '[]';
      // 코드 블록 마커 제거
      const cleanContent = responseContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      console.log('Cleaned GPT Response:', cleanContent);
      
      const layout = JSON.parse(cleanContent);
      console.log('Parsed layout:', JSON.stringify(layout, null, 2));
      return layout;
    } catch (error) {
      console.error('Error parsing GPT response:', error);
      return [];
    }
  }

  async generate(): Promise<ComicData> {
    // 1단계: 전체 스토리 분석
    const storyAnalysis = await this.analyzeStory();
    
    // 2단계: 각 패널의 위치 관계 결정
    for (const [panelId, panel] of this.panels.entries()) {
      panel.analysis = storyAnalysis.filter(element => 
        element.panel === panelId.replace('panel', '')
      );
      
      const layout = await this.determineTopology(panelId, storyAnalysis);
      for (const element of layout) {
        panel.placeElement(element.type, element.content, element.position[0], element.position[1]);
      }
    }

    const result: ComicData = {};
    for (const [panelId, panel] of this.panels.entries()) {
      result[panelId] = panel.toJSON();
    }
    return result;
  }
} 