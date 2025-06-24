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
• If the sentence expresses thought or desire → act:"생각" and fill think.
• If the sentence is spoken dialogue or a quoted utterance → act:"대화" and fill tell.
• Otherwise, set act to the exact Korean verb phrase appearing in the sentence (예: 찼다, 날아갔다, 나갔다, 산책했다).

3. One panel may contain multiple actions; output one object per action, all with the same panel value.

4. Preserve every Korean word exactly as written in the panels.

5. For any empty value, write an empty string "".

6. Respond with valid JSON only—no explanations, comments, or extra keys.`;

    const user_prompt = `Below is a worked example; follow the same schema, then convert the new panels that follow.

Example 1:
panel1: "나는 엄마랑 집 근처에서 산책했다"
panel2: "산책하다보니 놀이공원에 가고 싶어졌다."
panel3: "그래서 엄마에게 놀이공원 가고 싶다고 이야기를 했고 가기로 했다"
panel4: "나는 기뻤다"

Expected JSON
[
{"panel":"1","act":"산책했다","figure":"나, 엄마","object":"","location":"집 근처"},
{"panel":"2","act":"생각","figure":"나","object":"","location":"집 근처","think":"놀이공원 가고싶다"},
{"panel":"3","act":"대화","figure":"나","object":"","location":"집 근처","tell":"놀이공원 가고 싶어요!"},
{"panel":"3","act":"대화","figure":"엄마","object":"","location":"집 근처","tell":"그래, 가자!"},
{"panel":"4","act":"감정","figure":"나","object":"","location":"","emotion":"기쁨"}
]

Example 2 :
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

Convert these panels:
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

  private async determineLayout(panelId: string, analysis: SceneElement[]): Promise<Array<{ type: TileType; content: string; position: [number, number] }>> {
    const panelElements = analysis.filter(element => element.panel === panelId.replace('panel', ''));
    
    const systemPrompt = `You are a 5x5-layout designer that places story elements in a grid while maintaining visual balance and storytelling clarity.

Input  : One panel's semantic JSON objects  
Output : A JSON array of items, each with
  type     : figure | object | tell | think | emotion | location
  content  : Exactly the Korean text from the input
  position : [col, row] with 0 <= col,row <= 4   (0,0 is top-left)

Rules
1. One item per cell.  If two items want the same cell, keep the one with higher priority:
      figure > emotion|tell|think > object > location

2. figure
   - Place in rows 1,2,3 (centre area), fill from left to right.

3. object (decide by the act verb)
   - Lower-body verbs  (찼다, 밟았다, 달렸다, 뛰었다 …)  -> same column, row+1
   - Upper-body verbs  (잡았다, 들었다, 던졌다, 밀었다 …) -> same row as the figure
       * If the figure is left of col 4, use col+1
       * Otherwise use col-1
   - Head/eye verbs    (바라봤다, 찾았다, 쳐다봤다 …)     -> same column, row-1
   - Anything else                                     -> nearest free cell scanning
       top-to-bottom, then left-to-right

4. tell, think, emotion
   - Same column as the related figure, row-1

5. location
   a. If the string contains a space (example: "담장 너머"), take only the first word
      ("담장").
   b. If the panel also has an object, place the location directly below that object
      (same column, row+1) if that cell is free.
   c. Otherwise place the location on row 0 or row 4, choosing the leftmost free cell.

6. Keep every other Korean token exactly as written.

7. Output valid JSON only.  Do not output explanations, comments, or extra keys.`;


    const userPrompt = `Below is a worked example; follow the same schema, then convert the new layouts that follow.

# EXAMPLE 1
INPUT
{"panel":"1","act":"찼다","figure":"나, 민수","object":"축구공","location":"학교 운동장"}

OUTPUT
[
{"type": "figure", "content": "나", "position": [1, 2]},
{"type": "figure", "content": "민수", "position": [3, 2]},
{"type": "object", "content": "축구공", "position": [2, 3]},
{"type": "location", "content": "학교 운동장", "position": [4, 1]}
]

# EXAMPLE 2
INPUT
{"panel":"2","act":"대화","figure":"민수","object":"","location":"","tell":"?!"},
{"panel":"2","act":"날아갔다","figure":"축구공","object":"","location":"담장 너머"}

OUTPUT
[
{"type": "figure", "content": "민수", "position": [3, 2]},
{"type": "tell", "content": "?!", "position": [3, 1]},
{"type": "object", "content": "축구공", "position": [1,1]},
{"type": "location", "content": "담장", "position": [1,2]}
]

# EXAMPLE 3
INPUT
{"panel":"4","act":"감정","figure":"나","object":"","location":"","emotion":"기쁨"}

OUTPUT
{"type": "figure", "content": "나", "position": [2, 2]},
{"type": "emotion", "content": "기쁨", "position": [2, 1]}
]

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
      const layout = JSON.parse(response.choices[0].message.content || '[]') as Array<{ type: TileType; content: string; position: [number, number] }>;
      return layout;
    } catch {
      return [];
    }
  }

  async generate(): Promise<ComicData> {
    // 1단계: 전체 스토리 분석
    const storyAnalysis = await this.analyzeStory();
    
    // 2단계: 각 패널의 레이아웃 결정
    for (const [panelId, panel] of this.panels.entries()) {
      panel.analysis = storyAnalysis.filter(element => 
        element.panel === panelId.replace('panel', '')
      );
      
      const layout = await this.determineLayout(panelId, storyAnalysis);
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