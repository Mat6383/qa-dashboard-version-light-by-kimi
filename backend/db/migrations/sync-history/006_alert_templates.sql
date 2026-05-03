-- P24: Alerting avancé — Templates d'alerte configurables + filtres webhooks par métrique

-- Templates configurables par canal
ALTER TABLE notification_settings
ADD COLUMN email_template TEXT;

ALTER TABLE notification_settings
ADD COLUMN slack_template TEXT;

ALTER TABLE notification_settings
ADD COLUMN teams_template TEXT;

-- Filtres optionnels pour les webhook subscriptions (JSON)
ALTER TABLE webhook_subscriptions
ADD COLUMN filters TEXT;

-- Index pour filtrer les subscriptions actives
CREATE INDEX idx_webhook_subscriptions_enabled ON webhook_subscriptions(enabled);
