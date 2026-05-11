/**
 * ================================================
 * API Service — combined domain modules
 * ================================================
 *
 * @deprecated Import from `services/api/*` instead.
 */

import type { AxiosError } from 'axios';
import { apiClient, handleError } from './core';
export { apiClient };
export type { ReportGenerateParams, ExportMilestones } from './core';

import * as dashboard from './dashboard';
import * as sync from './sync';
import * as crosstest from './crosstest';
import * as notifications from './notifications';
import * as exportModule from './export';
import * as admin from './admin';
import * as reports from './reports';

const apiService = {
  // Dashboard / project / run
  healthCheck: dashboard.healthCheck,
  getProjects: dashboard.getProjects,
  getMultiProjectSummary: dashboard.getMultiProjectSummary,
  getDashboardMetrics: dashboard.getDashboardMetrics,
  getQualityRates: dashboard.getQualityRates,
  getProjectRuns: dashboard.getProjectRuns,
  getProjectMilestones: dashboard.getProjectMilestones,
  getRunDetails: dashboard.getRunDetails,
  getRunResults: dashboard.getRunResults,
  getAutomationRuns: dashboard.getAutomationRuns,
  getAnnualTrends: dashboard.getAnnualTrends,
  clearCache: dashboard.clearCache,

  // Reports
  generateReport: reports.generateReport,

  // Sync
  getSyncProjects: sync.getSyncProjects,
  getSyncIterations: sync.getSyncIterations,
  previewSync: sync.previewSync,
  previewSyncCases: sync.previewSyncCases,
  getSyncHistory: sync.getSyncHistory,
  getSyncCasesHistory: sync.getSyncCasesHistory,
  getAutoSyncConfig: sync.getAutoSyncConfig,
  updateAutoSyncConfig: sync.updateAutoSyncConfig,

  // Crosstest
  getCrosstestIterations: crosstest.getCrosstestIterations,
  getCrosstestIssues: crosstest.getCrosstestIssues,
  getCrosstestComments: crosstest.getCrosstestComments,
  saveCrosstestComment: crosstest.saveCrosstestComment,
  deleteCrosstestComment: crosstest.deleteCrosstestComment,

  // Notifications
  getNotificationSettings: notifications.getNotificationSettings,
  saveNotificationSettings: notifications.saveNotificationSettings,
  testNotificationWebhook: notifications.testNotificationWebhook,

  // Export
  generateBackendPDF: exportModule.generateBackendPDF,
  generateCSV: exportModule.generateCSV,
  generateExcel: exportModule.generateExcel,

  // Admin
  getAnomalies: admin.getAnomalies,
  getCircuitBreakers: admin.getCircuitBreakers,
  getAuditLogs: admin.getAuditLogs,
  getFeatureFlagsAdmin: admin.getFeatureFlagsAdmin,
  createFeatureFlag: admin.createFeatureFlag,
  updateFeatureFlag: admin.updateFeatureFlag,
  deleteFeatureFlag: admin.deleteFeatureFlag,
  createTestmoManualRun: admin.createTestmoManualRun,
  addTestmoManualRunResults: admin.addTestmoManualRunResults,
  checkTestmoBrowserHealth: admin.checkTestmoBrowserHealth,

  /**
   * Gestion des erreurs
   * @private
   */
  _handleError(operation: string, error: AxiosError | Error): Error {
    return handleError(operation, error);
  },
};

export default apiService;
