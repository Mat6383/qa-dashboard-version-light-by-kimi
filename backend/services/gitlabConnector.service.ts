import axios from 'axios';
import https from 'https';
import logger from './logger.service';
import { instrumentAxios } from './apiTimer.service';
import { withResilience } from '../utils/withResilience';
import { CircuitBreaker } from '../utils/circuitBreaker';

export interface GitLabConnectorConfig {
  baseUrl: string;
  token: string;
  projectId?: string;
  verifySsl?: boolean;
}

const connectorBreaker = new CircuitBreaker({
  name: 'gitlab-connector',
  failureThreshold: 5,
  resetTimeoutMs: 30000,
});

function createAxiosClient(config: GitLabConnectorConfig) {
  const verifySsl = config.verifySsl !== false;
  const httpsAgent = verifySsl ? undefined : new https.Agent({ rejectUnauthorized: false });

  const client = axios.create({
    baseURL: `${config.baseUrl}/api/v4`,
    timeout: 10000,
    headers: {
      'PRIVATE-TOKEN': config.token,
      'Content-Type': 'application/json',
    },
    ...(httpsAgent && { httpsAgent }),
  });

  instrumentAxios(client, 'gitlab-connector');

  client.interceptors.response.use(
    (response) => {
      logger.info(`GitLabConnector API Success: ${response.config.method?.toUpperCase()} ${response.config.url}`);
      return response;
    },
    (error) => {
      logger.error(`GitLabConnector API Error: ${error.response?.status} ${error.config?.url}`, {
        status: error.response?.status,
        data: error.response?.data,
      });
      return Promise.reject(error);
    }
  );

  return client;
}

class GitLabConnectorService {
  async testConnection(config: GitLabConnectorConfig): Promise<{ success: boolean; message: string }> {
    try {
      if (!config.baseUrl || !config.token) {
        return { success: false, message: 'URL de base et token requis' };
      }
      const client = createAxiosClient(config);
      const url = config.projectId ? `/projects/${config.projectId}` : '/projects';
      const params = config.projectId ? {} : { per_page: 1 };
      await withResilience(
        () => client.get(url, { params, timeout: 8000 }),
        connectorBreaker,
        { label: 'gitlab-connector.test', maxRetries: 2, baseDelayMs: 500 }
      );
      return { success: true, message: 'Connexion GitLab réussie' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async listProjects(config: GitLabConnectorConfig): Promise<{ id: number; name: string; path_with_namespace: string }[]> {
    const client = createAxiosClient(config);
    const resp = await withResilience(
      () => client.get('/projects', { params: { membership: true, per_page: 100 } }),
      connectorBreaker,
      { label: 'gitlab-connector.projects', maxRetries: 2, baseDelayMs: 500 }
    );
    return (resp.data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      path_with_namespace: p.path_with_namespace,
    }));
  }

  async listIssues(config: GitLabConnectorConfig, projectId: string, iterationId?: number): Promise<any[]> {
    const client = createAxiosClient(config);
    const params: any = { state: 'all', scope: 'all', per_page: 100 };
    if (iterationId) params.iteration_id = iterationId;
    const resp = await withResilience(
      () => client.get(`/projects/${projectId}/issues`, { params }),
      connectorBreaker,
      { label: 'gitlab-connector.issues', maxRetries: 2, baseDelayMs: 500 }
    );
    return resp.data || [];
  }
}

export default new GitLabConnectorService();
