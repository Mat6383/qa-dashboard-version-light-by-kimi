import gitlabConnectorService from '../services/gitlabConnector.service';

describe('GitLabConnectorService', () => {
  test('testConnection échoue sans credentials', async () => {
    const result = await gitlabConnectorService.testConnection({ baseUrl: '', token: '' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('URL de base et token requis');
  });

  test('testConnection échoue avec URL invalide (réseau)', async () => {
    const result = await gitlabConnectorService.testConnection({
      baseUrl: 'http://localhost:99999',
      token: 'fake-token',
    });
    expect(result.success).toBe(false);
    expect(result.message).toBeTruthy();
  });
});
