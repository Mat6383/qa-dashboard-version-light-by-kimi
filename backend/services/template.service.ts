import { marked } from 'marked';

export interface TemplateVariables {
  metric: string;
  value: string;
  threshold: string;
  severity: 'warning' | 'critical';
  projectName: string;
  timestamp: string;
}

class TemplateService {
  render(
    channel: 'email' | 'slack' | 'teams',
    template: string | null | undefined,
    vars: TemplateVariables,
    fallback: string
  ): string {
    const source = template || fallback;
    const replaced = this.replaceVariables(source, vars);
    if (channel === 'email') {
      return this.markdownToHtml(replaced);
    }
    return replaced;
  }

  replaceVariables(template: string, vars: TemplateVariables): string {
    return template
      .replace(/\{\{metric\}\}/g, vars.metric)
      .replace(/\{\{value\}\}/g, vars.value)
      .replace(/\{\{threshold\}\}/g, vars.threshold)
      .replace(/\{\{severity\}\}/g, vars.severity)
      .replace(/\{\{projectName\}\}/g, vars.projectName)
      .replace(/\{\{timestamp\}\}/g, vars.timestamp);
  }

  markdownToHtml(markdown: string): string {
    return marked.parse(markdown, { async: false }) as string;
  }
}

export default new TemplateService();
