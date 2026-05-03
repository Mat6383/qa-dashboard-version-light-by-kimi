/**
 * ================================================
 * GITLAB OAUTH2 STRATEGY (Passport)
 * ================================================
 */

// @ts-ignore
import { Strategy as GitLabStrategy } from 'passport-gitlab2';
import usersService from '../users.service';
import logger from '../logger.service';

const GITLAB_CLIENT_ID = process.env.GITLAB_CLIENT_ID;
const GITLAB_CLIENT_SECRET = process.env.GITLAB_CLIENT_SECRET;
const GITLAB_URL = process.env.GITLAB_URL || 'https://gitlab.com';

function createStrategy() {
  if (!GITLAB_CLIENT_ID || !GITLAB_CLIENT_SECRET) {
    logger.warn('[GitLabStrategy] GITLAB_CLIENT_ID ou GITLAB_CLIENT_SECRET manquant — OAuth désactivé');
    return null;
  }

  return new GitLabStrategy(
    {
      clientID: GITLAB_CLIENT_ID,
      clientSecret: GITLAB_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/auth/gitlab/callback`,
      baseURL: GITLAB_URL,
    },
    async (_accessToken: any, _refreshToken: any, profile: any, done: any) => {
      try {
        const user = usersService.upsertFromGitLab(profile);
        return done(null, user);
      } catch (err: any) {
        logger.error('[GitLabStrategy] Erreur upsert user:', err.message);
        return done(err, null);
      }
    }
  );
}

export { createStrategy };
