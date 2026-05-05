import axios from 'axios';
import logger from '../logger.service';
import { GitlabRestClient } from './restClient';

export class GitlabGraphQLClient {
  private restClient: GitlabRestClient;

  constructor(restClient: GitlabRestClient) {
    this.restClient = restClient;
  }

  async executeGraphQL(query: string, variables: Record<string, unknown> = {}, useWriteToken = false): Promise<unknown> {
    const token = useWriteToken ? this.restClient.writeToken : this.restClient.token;
    const httpsAgent =
      this.restClient.verifySsl === false
        ? new (await import('https')).Agent({ rejectUnauthorized: false })
        : undefined;

    const resp = await this.restClient._withRetry(
      () =>
        axios.post(
          `${this.restClient.baseURL}/api/graphql`,
          { query, variables },
          {
            timeout: this.restClient.timeout,
            headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
            ...(httpsAgent && { httpsAgent }),
          }
        ),
      'executeGraphQL'
    );

    if (resp.data.errors?.length) {
      throw new Error(`GraphQL: ${resp.data.errors[0].message}`);
    }
    return resp.data.data;
  }


}
