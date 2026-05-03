/**
 * ================================================
 * tRPC ROUTER — Cache
 * ================================================
 */

import { router } from '../init';
import { adminProcedure } from '../middleware';
import testmoService from '../../services/testmo.service';
import logger from '../../services/logger.service';

export const cacheRouter = router({
  clear: adminProcedure.mutation(() => {
    testmoService.clearCache();
    logger.info('Cache cleared manually via tRPC');
    return { success: true as const, message: 'Cache cleared successfully', timestamp: new Date().toISOString() };
  }),
});
