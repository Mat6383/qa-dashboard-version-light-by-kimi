declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV?: 'development' | 'production' | 'test';
      PORT?: string;
      HOST?: string;
      ADMIN_API_TOKEN?: string;
      JWT_SECRET?: string;
      GITLAB_CLIENT_ID?: string;
      GITLAB_CLIENT_SECRET?: string;
      GITLAB_REDIRECT_URI?: string;
      TESTMO_BASE_URL?: string;
      TESTMO_API_TOKEN?: string;
      GITLAB_API_URL?: string;
      GITLAB_PRIVATE_TOKEN?: string;
      SMTP_HOST?: string;
      SMTP_PORT?: string;
      SMTP_USER?: string;
      SMTP_PASS?: string;
      SMTP_FROM?: string;
      SLACK_WEBHOOK_URL?: string;
      TEAMS_WEBHOOK_URL?: string;
      SENTRY_DSN?: string;
      AUDIT_RETENTION_DAYS?: string;
      AUDIT_PRUNE_CRON?: string;
      METRICS_SNAPSHOT_CRON?: string;
      AUTO_SYNC_CRON?: string;
      [key: string]: string | undefined;
    }
  }
}

declare module 'yamljs' {
  const YAML: { load(path: string): any; parse(str: string): any; stringify(obj: any): string };
  export default YAML;
}
export {};
