import { useState, useEffect } from 'react';
import { NetworkHelper } from '@autiverse-monorepo/ts-core';

interface DyadData {
  id: string;
  alias: string;
  child_name: string;
  visit_count: number;
  agent_id: string;
}

interface AgentData {
  id: string;
  name: string;
  description: string;
  agent_config?: any;
}

interface UseAgentIntroProps {
  dyadId: string;
  passcode: string;
}

export const useAgentIntro = ({ dyadId, passcode }: UseAgentIntroProps) => {
  const [dyadData, setDyadData] = useState<DyadData | null>(null);
  const [agentData, setAgentData] = useState<AgentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [dyadId, passcode]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Dyad 정보 가져오기
      const dyadResponse = await NetworkHelper.axiosClient.get(
        NetworkHelper.ENDPOINTS.APP.DYADS.getDyadEndpoint(dyadId),
        {
          headers: await NetworkHelper.getHeaders(passcode),
        }
      );

      if (dyadResponse.status !== 200) {
        throw new Error('Failed to fetch dyad data');
      }

      const dyadResult = dyadResponse.data;
      setDyadData(dyadResult);

      // Agent 정보 가져오기 (dyad에 연결된 agent)
      const agentResponse = await NetworkHelper.axiosClient.get(
        NetworkHelper.ENDPOINTS.APP.AGENTS.getAgentEndpoint(dyadResult.agent_id),
        {
          headers: await NetworkHelper.getHeaders(passcode),
        }
      );

      if (agentResponse.status !== 200) {
        throw new Error('Failed to fetch agent data');
      }

      const agentResult = agentResponse.data;
      setAgentData(agentResult);

    } catch (error) {
      console.error('Error fetching data:', error);
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    dyadData,
    agentData,
    isLoading,
    error,
    refetch: fetchData
  };
}; 