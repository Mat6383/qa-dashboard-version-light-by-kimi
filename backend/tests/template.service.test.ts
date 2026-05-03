import templateService from '../services/template.service';

describe('TemplateService', () => {
  test('replaceVariables remplace toutes les variables', () => {
    const result = (templateService as any).replaceVariables(
      'Alerte {{severity}}: {{metric}} = {{value}}% (seuil {{threshold}})',
      {
        metric: 'passRate',
        value: '87.5',
        threshold: '90',
        severity: 'critical',
        projectName: 'Alpha',
        timestamp: '2026-04-29T12:00:00Z',
      }
    );
    expect(result).toBe('Alerte critical: passRate = 87.5% (seuil 90)');
  });

  test('render utilise le template personnalisé si fourni', () => {
    const result = templateService.render('email', 'Custom {{metric}}', {
      metric: 'passRate',
      value: '87.5',
      threshold: '90',
      severity: 'critical',
      projectName: 'Alpha',
      timestamp: '2026-04-29T12:00:00Z',
    }, 'Fallback');
    expect(result).toContain('<p>Custom passRate</p>');
  });

  test('render utilise le fallback si template null', () => {
    const result = templateService.render('email', null, {
      metric: 'passRate',
      value: '87.5',
      threshold: '90',
      severity: 'critical',
      projectName: 'Alpha',
      timestamp: '2026-04-29T12:00:00Z',
    }, 'Fallback {{metric}}');
    expect(result).toContain('<p>Fallback passRate</p>');
  });

  test('render utilise le fallback si template undefined', () => {
    const result = templateService.render('email', undefined, {
      metric: 'passRate',
      value: '87.5',
      threshold: '90',
      severity: 'critical',
      projectName: 'Alpha',
      timestamp: '2026-04-29T12:00:00Z',
    }, 'Fallback {{metric}}');
    expect(result).toContain('<p>Fallback passRate</p>');
  });

  test('render email convertit en HTML', () => {
    const result = templateService.render('email', '# {{metric}}\n\nValue: {{value}}', {
      metric: 'passRate',
      value: '87.5',
      threshold: '90',
      severity: 'critical',
      projectName: 'Alpha',
      timestamp: '2026-04-29T12:00:00Z',
    }, 'Fallback');
    expect(result).toContain('<h1');
    expect(result).toContain('passRate</h1>');
    expect(result).toContain('<p>Value: 87.5</p>');
  });

  test('render slack laisse le markdown brut', () => {
    const result = templateService.render('slack', '# {{metric}}', {
      metric: 'passRate',
      value: '87.5',
      threshold: '90',
      severity: 'critical',
      projectName: 'Alpha',
      timestamp: '2026-04-29T12:00:00Z',
    }, 'Fallback');
    expect(result).toBe('# passRate');
  });

  test('render teams laisse le markdown brut', () => {
    const result = templateService.render('teams', '**{{severity}}** — {{metric}}', {
      metric: 'passRate',
      value: '87.5',
      threshold: '90',
      severity: 'critical',
      projectName: 'Alpha',
      timestamp: '2026-04-29T12:00:00Z',
    }, 'Fallback');
    expect(result).toBe('**critical** — passRate');
  });
});
