// Service container. Wires repositories, the AI provider, and a clock into the
// application services. The API layer constructs this once per backend and
// passes a RequestContext into each call.

import type { AiProvider } from '../ai/provider';
import type { Repositories } from '../repositories/interfaces';
import { systemClock, type Clock } from './context';
import { UserService } from './userService';
import { TaskService } from './taskService';
import { EvidenceService } from './evidenceService';
import { WorkflowService } from './workflowService';
import { DashboardService } from './dashboardService';
import { AiService } from './aiService';

export interface CoreConfig {
  /** Allowed Workspace email domains. Empty = any (single-tenant local dev). */
  allowedDomains: string[];
}

export interface ServicesDeps {
  repos: Repositories;
  ai: AiProvider;
  config: CoreConfig;
  clock?: Clock;
}

export interface Services {
  users: UserService;
  tasks: TaskService;
  evidence: EvidenceService;
  workflows: WorkflowService;
  dashboards: DashboardService;
  ai: AiService;
}

export function createServices(deps: ServicesDeps): Services {
  const clock = deps.clock ?? systemClock;
  const { repos, ai, config } = deps;

  return {
    users: new UserService(repos.users, config.allowedDomains, repos.activity, clock),
    tasks: new TaskService(repos.tasks, repos.users, repos.evidence, repos.activity, clock),
    evidence: new EvidenceService(repos.evidence, repos.tasks, repos.activity, clock),
    workflows: new WorkflowService(
      repos.workflowTemplates,
      repos.workflowStages,
      repos.workflowInstances,
      repos.tasks,
      repos.evidence,
      repos.users,
      repos.activity,
      clock,
    ),
    dashboards: new DashboardService(
      repos.tasks,
      repos.evidence,
      repos.users,
      repos.workflowInstances,
      repos.summaries,
      clock,
    ),
    // AI service receives read repos + summary write only; no mutation repos.
    ai: new AiService(
      ai,
      repos.tasks,
      repos.evidence,
      repos.users,
      repos.workflowInstances,
      repos.summaries,
      repos.activity,
      clock,
    ),
  };
}

export { UserService } from './userService';
export { TaskService, canAccessTask } from './taskService';
export { EvidenceService } from './evidenceService';
export { WorkflowService } from './workflowService';
export { DashboardService } from './dashboardService';
export { AiService } from './aiService';
