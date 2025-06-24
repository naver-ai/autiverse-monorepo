import React from 'react';

interface StageIndicatorProps {
  stage: string;
}

export const StageIndicator: React.FC<StageIndicatorProps> = ({ stage }) => {
  const getStageInfo = (stage: string) => {
    switch (stage) {
      case 'intro':
        return {
          label: '대화 시작',
          color: 'bg-blue-100 text-blue-800',
          icon: '💬'
        };
      case 'revision_1':
        return {
          label: '첫 번째 수정',
          color: 'bg-yellow-100 text-yellow-800',
          icon: '✏️'
        };
      case 'revision_1_correction':
        return {
          label: '수정 중',
          color: 'bg-orange-100 text-orange-800',
          icon: '🔧'
        };
      case 'comic_context':
        return {
          label: '만화 완성',
          color: 'bg-green-100 text-green-800',
          icon: '🎨'
        };
      case 'revision_2':
        return {
          label: '두 번째 수정',
          color: 'bg-purple-100 text-purple-800',
          icon: '✨'
        };
      case 'revision_2_correction':
        return {
          label: '최종 수정',
          color: 'bg-red-100 text-red-800',
          icon: '🎯'
        };
      case 'complete':
        return {
          label: '완성!',
          color: 'bg-emerald-100 text-emerald-800',
          icon: '🏅'
        };
      default:
        return {
          label: '알 수 없음',
          color: 'bg-gray-100 text-gray-800',
          icon: '❓'
        };
    }
  };

  const stageInfo = getStageInfo(stage);

  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${stageInfo.color}`}>
      <span className="mr-2">{stageInfo.icon}</span>
      {stageInfo.label}
    </div>
  );
}; 