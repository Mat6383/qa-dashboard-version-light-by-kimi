import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, CheckCircle, RefreshCw, MessageSquare } from 'lucide-react';
import ConfigurationScreen from './ConfigurationScreen';
import CrossTestDashboard from './CrossTestDashboard';
import AutoSyncDashboard from './AutoSyncDashboard';
import FeedbackSyncDashboard from './FeedbackSyncDashboard';
import '../styles/Tabs.css';

interface ToolsPageProps {
  isDark: boolean;
  projectId: number;
  initialPreprodMilestones: number[];
  initialProdMilestones: number[];
  onSaveSelection: (preprod: number[], prod: number[]) => void;
}

const tabs = [
  { id: 'config', labelKey: 'tools.configuration', icon: Settings },
  { id: 'crosstest', labelKey: 'tools.crosstest', icon: CheckCircle },
  { id: 'autosync', labelKey: 'tools.autoSync', icon: RefreshCw },
  { id: 'feedback-sync', labelKey: 'tools.feedbackSync', icon: MessageSquare },
];

export default function ToolsPage({
  isDark,
  projectId,
  initialPreprodMilestones,
  initialProdMilestones,
  onSaveSelection,
}: ToolsPageProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('config');

  return (
    <div className="tabs-container" style={{ padding: 'var(--spacing-xl)' }}>
      <div className="tabs-list" role="tablist" aria-label={t('tools.title')}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              className={`tab-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              <Icon size={16} />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      <div className="tab-panel" role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
        {activeTab === 'config' && (
          <ConfigurationScreen
            projectId={projectId}
            isDark={isDark}
            initialPreprodMilestones={initialPreprodMilestones}
            initialProdMilestones={initialProdMilestones}
            onSaveSelection={onSaveSelection}
          />
        )}
        {activeTab === 'crosstest' && <CrossTestDashboard isDark={isDark} />}
        {activeTab === 'autosync' && <AutoSyncDashboard isDark={isDark} />}
        {activeTab === 'feedback-sync' && <FeedbackSyncDashboard isDark={isDark} />}
      </div>
    </div>
  );
}
