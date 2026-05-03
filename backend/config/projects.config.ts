/**
 * ================================================
 * PROJECTS CONFIG - Multi-project mapping
 * ================================================
 * Mapping des projets GitLab ↔ Testmo pour Dashboard 6
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 1.0.0
 */

const PROJECTS = [
  {
    id: 'neo-pilot',
    label: 'Neo-Pilot',
    testmo: {
      projectId: 1,
      repoId: 1,
      rootFolderId: 4514,
      gitlabIntegrationId: 2,
      gitlabConnectionProjectId: 63
    },
    gitlab: {
      projectId: 63,
      token: null, // uses env GITLAB_TOKEN
      label: 'Test::TODO'
    },
    configured: true
  },
  {
    id: 'workshop-web',
    label: 'Workshop Web',
    testmo: {
      projectId: 10,
      repoId: 101,
      rootFolderId: 4522,
      gitlabIntegrationId: 2,
      gitlabConnectionProjectId: 141
    },
    gitlab: {
      projectId: 141,
      token: null,
      label: 'Test::TODO'
    },
    configured: true
  },
  {
    id: 'workshop',
    label: 'Workshop',
    testmo: {
      projectId: 3,
      repoId: 5,
      rootFolderId: null,
      gitlabIntegrationId: 2,
      gitlabConnectionProjectId: 61
    },
    gitlab: {
      projectId: 61,
      token: null,
      label: 'Test::TODO'
    },
    configured: true
  },
  {
    id: 'link',
    label: 'Link',
    testmo: {
      projectId: 7,
      repoId: 39,
      rootFolderId: 694,
      gitlabIntegrationId: 2,
      gitlabConnectionProjectId: 61
    },
    gitlab: {
      projectId: 61,
      token: null,
      label: 'Test::TODO'
    },
    configured: true
  },
  {
    id: 'kiosk',
    label: 'KIOSK',
    testmo: {
      projectId: 2,
      repoId: 4,
      rootFolderId: 15,
      gitlabIntegrationId: 2,
      gitlabConnectionProjectId: null
    },
    gitlab: {
      projectId: null,
      token: null,
      label: 'Test::TODO'
    },
    configured: false
  }
];

export default PROJECTS;
