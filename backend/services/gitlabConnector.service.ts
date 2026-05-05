import https from 'https';
import { ResilientHttpClient } from '../utils/resilientHttpClient';

export interface GitLabConnectorConfig {
  baseUrl: string;
  token: string;
  projectId?: string;
  verifySsl?: boolean;
}

function createClient(config: GitLabConnectorConfig) {
  const verifySsl = config.verifySsl !== false;
  const httpsAgent = verifySsl ? undefined : new https.Agent({ rejectUnauthorized: false });

  return new ResilientHttpClient({
    baseURL: `${config.baseUrl}/api/v4`,
    timeout: 10000,
    headers: {
      'PRIVATE-TOKEN': config.token,
      'Content-Type': 'application/json',
    },
    httpsAgent,
    name: 'gitlab-connector',
    instrumentName: 'gitlab-connector',
    maxRetries: 2,
    baseDelayMs: 500,
  });
}

class GitLabConnectorService {
  async testConnection(config: GitLabConnectorConfig): Promise<{ success: boolean; message: string }> {
    try {
      if (!config.baseUrl || !config.token) {
        return { success: false, message: 'URL de base et token requis' };
      }
      const client = createClient(config);
      const url = config.projectId ? `/projects/${config.projectId}` : '/projects';
      const params = config.projectId ? {} : { per_page: 1 };
      await client.get(url, { params, timeout: 8000 });
      return { success: true, message: 'Connexion GitLab réussie' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async listProjects(config: GitLabConnectorConfig): Promise<{ id: number; name: string; path_with_namespace: string }[]> {
    const client = createClient(config);
    const resp = await client.get('/projects', { params: { membership: true, per_page: 100 } });
    return ((resp.data as any[]) || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      path_with_namespace: p.path_with_namespace,
    }));
  }

  async listIssues(config: GitLabConnectorConfig, projectId: string, iterationId?: number): Promise<any[]> {
    const client = createClient(config);
    const params: any = { state: 'all', scope: 'all', per_page: 100 };
    if (iterationId) params.iteration_id = iterationId;
    const resp = await client.get(`/projects/${projectId}/issues`, { params });
    return (resp.data as any[]) || [];
  }
}

export default new GitLabConnectorService();
