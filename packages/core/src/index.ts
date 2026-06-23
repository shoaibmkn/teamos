// @teamos/core public surface. Framework- and data-source-agnostic domain
// core: entities, enums, errors, repository interfaces, application services,
// the AI advisory boundary, and an in-memory backend for local use and tests.

// Domain
export * from './domain/enums';
export * from './domain/entities';
export * from './domain/errors';
export { ID_PREFIXES, newId, hasPrefix } from './domain/ids';
export type { IdPrefix } from './domain/ids';

// Repositories
export type {
  ActivityRepository,
  DayLogRepository,
  EvidenceRepository,
  ListOptions,
  NotificationRepository,
  Page,
  Repositories,
  SubtaskRepository,
  SummaryRepository,
  TaskFilter,
  TaskMessageRepository,
  TaskRepository,
  UserRepository,
  WorkflowInstanceRepository,
  WorkflowStageRepository,
  WorkflowTemplateRepository,
} from './repositories/interfaces';
export { createInMemoryRepositories } from './repositories/memory/index';

// Services
export {
  createServices,
  UserService,
  TaskService,
  EvidenceService,
  WorkflowService,
  DashboardService,
  AiService,
  SubtaskService,
  MessageService,
  AssessmentService,
  assessmentToCsv,
  AttendanceService,
  NotificationService,
  canAccessTask,
} from './services/index';
export type { EmployeeAssessment, MonthlyPoint } from './services/assessmentService';
export type { AttendanceEntry } from './services/attendanceService';
export type { CoreConfig, Services, ServicesDeps } from './services/index';
export type { Clock, RequestContext } from './services/context';
export { systemClock, nowIso, SYSTEM_ACTOR_ID } from './services/context';
export * as rbac from './services/rbac';
export type { CreateTaskInput, UpdateStatusInput, StatusUpdateResult } from './services/taskService';
export type { AddEvidenceInput } from './services/evidenceService';
export type {
  CreateTemplateInput,
  StartInstanceInput,
  StageInput,
  InstanceDetail,
} from './services/workflowService';
export type {
  EmployeeDashboard,
  ManagerDashboard,
  ExecutiveDashboard,
  Bottleneck,
} from './services/dashboardService';
export type { GenerateSummaryInput, GeneratedSummary } from './services/aiService';
export type { MeResponse, CreateUserInput, UpdateUserInput } from './services/userService';

// AI providers
export type { AiProvider, AiSummaryInput, AiSummaryOutput, RiskSignal, AiTaskSnapshot } from './ai/provider';
export { OfflineAiProvider } from './ai/offline';
export { GeminiAiProvider } from './ai/gemini';

// Seed
export { seedDemoOrg } from './seed';
export type { SeededOrg } from './seed';
