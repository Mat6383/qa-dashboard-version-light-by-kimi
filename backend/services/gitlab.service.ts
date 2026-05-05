import logger from './logger.service';
import integrationService from './integration.service';

import {
  findIteration,
  findIterationForProject,
  searchIterations,
} from './gitlab/iterations';
import {
  getIssuesByLabelAndIteration,
  getIssuesByLabelAndIterationForProject,
  getIssuesByLabel,
  getIssuesForIteration,
  getIssueNotes,
  updateIssueLabel,
  addIssueComment,
} from './gitlab/issues';
import {
  getIssuesByVersionAndIteration,
  getIssuesByVersionOnly,
  getIssuesByFilters,
} from './gitlab/filters';

import { CircuitBreaker } from '../utils/circuitBreaker';
import { withResilience } from '../utils/withResilience';
import { GitlabRestClient, GitlabRestClientConfig } from './gitlab/restClient';
import { GitlabGraphQLClient } from './gitlab/graphqlClient';
import { GitlabParser } from './gitlab/parser';

class GitLabService {
  restClient: GitlabRestClient;
  graphqlClient: GitlabGraphQLClient;

  constructor() {
    let connectorConfig: GitlabRestClientConfig | null = null;

    try {
      integrationService.init();
      const connectors = integrationService.list().filter(
        (i) => i.type === 'gitlab' && i.enabled
      );
      if (connectors.length > 0) {
        const c = connectors[0].config;
        connectorConfig = {
          baseURL: (c.baseUrl || c.url || process.env.GITLAB_URL) as string,
          token: (c.token || process.env.GITLAB_TOKEN) as string,
          writeToken:
            (c.writeToken || c.token || process.env.GITLAB_WRITE_TOKEN || process.env.GITLAB_TOKEN) as string,
          projectId: (c.projectId || process.env.GITLAB_PROJECT_ID) as string | undefined,
          verifySsl: c.verifySsl !== false,
          timeout: parseInt(process.env.API_TIMEOUT || '') || 10000,
        };
        logger.info(
          `[GitLabService] Connector actif utilisé : ${connectors[0].name} (projet ${connectorConfig.projectId})`
        );
      }
    } catch (err: unknown) {
      // Pas de connector configuré ou DB indisponible → fallback .env
    }

    if (connectorConfig) {
      this.restClient = new GitlabRestClient(connectorConfig);
      this.graphqlClient = new GitlabGraphQLClient(this.restClient);
      return;
    }

    this.restClient = new GitlabRestClient({
      baseURL: process.env.GITLAB_URL!,
      token: process.env.GITLAB_TOKEN!,
      writeToken: process.env.GITLAB_WRITE_TOKEN || process.env.GITLAB_TOKEN,
      projectId: process.env.GITLAB_PROJECT_ID,
      verifySsl: process.env.GITLAB_VERIFY_SSL !== 'false',
      timeout: parseInt(process.env.API_TIMEOUT || '') || 10000,
      apiDelay: 300,
    });
    this.graphqlClient = new GitlabGraphQLClient(this.restClient);
  }

  static fromConfig(config: {
    baseURL: string;
    token: string;
    writeToken?: string;
    projectId?: string;
    verifySsl?: boolean;
    timeout?: number;
  }): GitLabService {
    const svc = new (GitLabService as unknown as { new (): GitLabService })();
    svc.restClient = GitlabRestClient.fromConfig({
      ...config,
      apiDelay: 300,
    });
    svc.graphqlClient = new GitlabGraphQLClient(svc.restClient);
    return svc;
  }

  // ── Proxy propriétés pour compatibilité avec les fonctions extraites dans gitlab/*.ts ──
  get baseURL() { return this.restClient.baseURL; }
  get token() { return this.restClient.token; }
  get writeToken() { return this.restClient.writeToken; }
  get projectId() { return this.restClient.projectId; }
  get verifySsl() { return this.restClient.verifySsl; }
  get timeout() { return this.restClient.timeout; }
  get apiDelay() { return this.restClient.apiDelay; }
  get client() { return this.restClient.client; }
  get writeClient() { return this.restClient.writeClient; }

  _delay() { return this.restClient._delay(); }
  _withRetry<T>(fn: () => Promise<T>, label?: string, maxRetries?: number, baseDelay?: number) {
    return this.restClient._withRetry(fn, label, maxRetries, baseDelay);
  }
  _getPaginated(url: string, params?: Record<string, unknown>) {
    return this.restClient._getPaginated(url, params);
  }
  healthCheck(options?: { timeout?: number }) {
    return this.restClient.healthCheck(options);
  }

  // ─── Iterations ───────────────────────────────────────────────────────────
  async findIteration(iterationName: any) { return findIteration.call(this, iterationName); }
  async findIterationForProject(projectId: any, iterationName: any) { return findIterationForProject.call(this, projectId, iterationName); }
  async searchIterations(projectId: any, search = '') { return searchIterations.call(this, projectId, search); }

  // ─── Issues / Labels / Notes ──────────────────────────────────────────────
  async getIssuesByLabelAndIteration(label: any, iterationId: any) { return getIssuesByLabelAndIteration.call(this, label, iterationId); }
  async getIssuesByLabelAndIterationForProject(projectId: any, label: any, iterationId: any) { return getIssuesByLabelAndIterationForProject.call(this, projectId, label, iterationId); }
  async getIssuesByLabel(label: any) { return getIssuesByLabel.call(this, label); }
  async getIssuesForIteration(projectId: any, iterationId: any) { return getIssuesForIteration.call(this, projectId, iterationId); }
  async getIssueNotes(projectId: any, issueIid: any) { return getIssueNotes.call(this, projectId, issueIid); }
  async updateIssueLabel(projectId: any, issueIid: any, addLabel: any, removeLabels: any = []) { return updateIssueLabel.call(this, projectId, issueIid, addLabel, removeLabels); }
  async addIssueComment(projectId: any, issueIid: any, body: any) { return addIssueComment.call(this, projectId, issueIid, body); }

  // ─── GraphQL ──────────────────────────────────────────────────────────────
  async executeGraphQL(query: any, variables: any = {}, useWriteToken = false) {
    return this.graphqlClient.executeGraphQL(query, variables, useWriteToken);
  }
  async updateWorkItemStatus(workItemGlobalId: any, statusGlobalId: any) {
    const mutation = `
      mutation UpdateWorkItemStatus($id: WorkItemID!, $statusId: WorkItemsStatusesStatusID!) {
        workItemUpdate(input: { id: $id statusWidget: { status: $statusId } }) {
          workItem {
            id
            widgets { type ... on WorkItemWidgetStatus { status { id name } } }
          }
          errors
        }
      }`;

    const data = await this.executeGraphQL(mutation, { id: workItemGlobalId, statusId: statusGlobalId }, true);
    const result = data as {
      workItemUpdate: {
        workItem: { widgets: Array<{ type: string; status?: { name: string } }> };
        errors: string[];
      };
    };
    const { workItem, errors } = result.workItemUpdate;
    if (errors?.length) throw new Error(errors[0]);
    const statusName = workItem.widgets.find((w) => w.type === 'STATUS')?.status?.name;
    logger.info(`GitLab: Work item ${workItemGlobalId} → status "${statusName}"`);
    return workItem;
  }

  // ─── Filtres avancés ──────────────────────────────────────────────────────
  async getIssuesByVersionAndIteration(projectId: any, version: any, iterationId: any) { return getIssuesByVersionAndIteration.call(this, projectId, version, iterationId); }
  async getIssuesByVersionOnly(projectId: any, version: any) { return getIssuesByVersionOnly.call(this, projectId, version); }
  async getIssuesByFilters(projectId: any, iterationId: any, options: any = {}) { return getIssuesByFilters.call(this, projectId, iterationId, options); }

  static formatEstimate(seconds: number | string) {
    return GitlabParser.formatEstimate(seconds);
  }
}

const instance = new GitLabService();

const gitlabBreaker = new CircuitBreaker({ name: 'gitlab', failureThreshold: 5, resetTimeoutMs: 30000 });

function wrapMethod(
  service: GitLabService,
  methodName: keyof GitLabService,
  breaker: CircuitBreaker,
  options: { label: string; maxRetries?: number; baseDelayMs?: number }
) {
  const original = (service[methodName] as unknown as (...args: unknown[]) => unknown).bind(service);
  (service as unknown as Record<string, unknown>)[methodName as string] = (...args: unknown[]) =>
    withResilience(() => original(...args), breaker, options);
}

wrapMethod(instance, '_getPaginated', gitlabBreaker, { label: 'gitlab._getPaginated', maxRetries: 3, baseDelayMs: 600 });
wrapMethod(instance, 'findIteration', gitlabBreaker, { label: 'gitlab.findIteration', maxRetries: 2, baseDelayMs: 600 });
wrapMethod(instance, 'getIssuesByLabelAndIteration', gitlabBreaker, { label: 'gitlab.getIssuesByLabelAndIteration', maxRetries: 2, baseDelayMs: 600 });
wrapMethod(instance, 'getIssuesByFilters', gitlabBreaker, { label: 'gitlab.getIssuesByFilters', maxRetries: 2, baseDelayMs: 600 });
wrapMethod(instance, 'executeGraphQL', gitlabBreaker, { label: 'gitlab.executeGraphQL', maxRetries: 2, baseDelayMs: 800 });
wrapMethod(instance, 'healthCheck', gitlabBreaker, { label: 'gitlab.healthCheck', maxRetries: 2, baseDelayMs: 500 });

export { GitLabService, gitlabBreaker };
export default instance;
