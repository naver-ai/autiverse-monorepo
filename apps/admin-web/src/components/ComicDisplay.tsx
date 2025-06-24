import React from 'react';

interface ComicPanel {
  content?: string;
  missing_content?: string;
}

interface ComicDisplayProps {
  panels: {
    panel1?: ComicPanel;
    panel2?: ComicPanel;
    panel3?: ComicPanel;
    panel4?: ComicPanel;
  };
}

export const ComicDisplay: React.FC<ComicDisplayProps> = ({ panels }) => {
  const getPanelContent = (panel: ComicPanel | undefined) => {
    if (!panel) return '내용 없음';
    if (panel.content) return panel.content;
    if (panel.missing_content) return `[${panel.missing_content}]`;
    return '내용 없음';
  };

  const getPanelStyle = (panel: ComicPanel | undefined) => {
    if (!panel || !panel.content) {
      return 'bg-gray-100 text-gray-500 border-dashed';
    }
    return 'bg-white text-gray-900 border-solid';
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {['panel1', 'panel2', 'panel3', 'panel4'].map((panelKey) => {
        const panel = panels[panelKey as keyof typeof panels];
        const panelNumber = panelKey.replace('panel', '');
        
        return (
          <div
            key={panelKey}
            className={`p-3 border-2 rounded-lg min-h-[80px] flex items-center justify-center text-center text-sm ${getPanelStyle(panel)}`}
          >
            <div>
              <div className="text-xs font-medium mb-1 text-gray-500">
                패널 {panelNumber}
              </div>
              <div className="text-xs leading-relaxed">
                {getPanelContent(panel)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}; 