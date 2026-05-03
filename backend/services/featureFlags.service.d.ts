/**
 * Types pour FeatureFlagsService (générés depuis Zod + inférence manuelle).
 */

export interface FeatureFlagDetails {
  key: string;
  enabled: boolean;
  description: string;
  rolloutPercentage: number;
  updatedAt: string;
  createdAt: string;
}

export interface FeatureFlagsService {
  _hashUserFlag(key: string, userId: string): number;
  isEnabledForUser(key: string, userId: string, defaultValue?: boolean): boolean;
  getAll(userId?: string | null): Record<string, boolean>;
  getAllDetails(): FeatureFlagDetails[];
  isEnabled(key: string, defaultValue?: boolean, userId?: string | null): boolean;
  getByKey(key: string): FeatureFlagDetails | null;
  create(
    key: string,
    options?: { enabled?: boolean; description?: string; rolloutPercentage?: number }
  ): boolean;
  update(
    key: string,
    options?: { enabled?: boolean; description?: string; rolloutPercentage?: number }
  ): boolean;
  delete(key: string): boolean;
  set(key: string, enabled: boolean): boolean;
}

declare const featureFlagsService: FeatureFlagsService;
export = featureFlagsService;
