import type { HouseData } from "../resident/ResidentModel";
import type { AcquisitionSource, PublicPage } from "@chega-de-briga/domain";

export type HouseholdRole = "responsavel" | "morador";
export type AccessSource = "lista" | "convite_admin" | "convite_morador" | "publico";
export type WaitlistContactChannel = "email" | "whatsapp";
export type UserStatus = "ativo" | "suspenso" | "excluido";
export type InvitationStatus = "pendente" | "aceito" | "revogado" | "expirado";
export type Period = 7 | 30 | 90;
export type SourceFilter = AccessSource | "todos";
export type SizeFilter = "todos" | "1" | "2" | "3+";

export interface User {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  source: AccessSource;
  accessId: string;
  createdAt: string;
  lastSeenAt?: string;
}
export interface Household {
  id: string;
  name: string;
  createdAt: string;
  firstValueAt?: string;
}
export interface Membership {
  userId: string;
  householdId: string;
  role: HouseholdRole;
  joinedAt: string;
}
export interface AllowEntry {
  id: string;
  email: string;
  addedAt: string;
  revokedAt?: string;
}
export interface Invitation {
  id: string;
  email: string;
  source: Exclude<AccessSource, "lista" | "publico">;
  householdId?: string;
  inviterId?: string;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
}
export interface TaskMeta {
  id: string;
  householdId: string;
  createdAt: string;
  dueAt: string;
  completedAt?: string;
  isOpen?: boolean;
}
export interface ActivityEvent {
  id: string;
  userId?: string;
  householdId?: string;
  type:
    | "conta_criada"
    | "acesso"
    | "entrada_casa"
    | "tarefa_criada"
    | "tarefa_concluida"
    | "tarefa_pulada"
    | "tarefa_editada"
    | "item_compra_adicionado";
  at: string;
}
export interface AuditEvent {
  id: string;
  action: string;
  targetId: string;
  at: string;
}
export interface DataSet {
  users: User[];
  households: Household[];
  memberships: Membership[];
  allowlist: AllowEntry[];
  invitations: Invitation[];
  tasks: TaskMeta[];
  activity: ActivityEvent[];
  audit: AuditEvent[];
}
export interface UserPage {
  items: User[];
  total: number;
  page: number;
  pages: number;
}
export interface UserQuery {
  search: string;
  status: UserStatus | "todos";
  page: number;
}
export interface AnalyticsFilter {
  period: Period;
  source: SourceFilter;
  size: SizeFilter;
}
export interface FunnelStep {
  label: string;
  count: number;
  denominator: number;
}
export interface CohortRow {
  week: string;
  houses: number;
  week1?: number;
  week1Denominator: number;
  week4?: number;
  week4Denominator: number;
}
export interface Analytics {
  filter: AnalyticsFilter;
  from: string;
  to: string;
  sampleHouses: number;
  people: FunnelStep[];
  activation: FunnelStep[];
  firstValue: FunnelStep[];
  weeklyActive: { week: string; houses: number; denominator: number }[];
  cohorts: CohortRow[];
  overdueOpen: number;
  tasksOpen: number;
  insights: string[];
}
export interface WaitlistEntry {
  id: string;
  channel: WaitlistContactChannel;
  contact: string;
  createdAt: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}
export interface WaitlistQuery {
  search: string;
  channel: WaitlistContactChannel | "todos";
  campaign: string;
  page: number;
}
export interface WaitlistPage {
  items: WaitlistEntry[];
  total: number;
  page: number;
  pages: number;
}
export interface WaitlistAnalytics {
  period: 7 | 30 | 90;
  signupEnabled: boolean;
  from: string;
  to: string;
  pageLoads: number;
  formStarts: number;
  signups: number;
  conversion: number;
  byChannel: { channel: WaitlistContactChannel; count: number }[];
  byCampaign: { campaign: string; pageLoads: number; formStarts: number; signups: number }[];
  bySource: { source: AcquisitionSource; pageLoads: number; guideViews: number; formStarts: number; signups: number; conversion: number | null }[];
  byGuide: { page: Exclude<PublicPage, "landing">; views: number }[];
  daily: { date: string; pageLoads: number; formStarts: number; signups: number }[];
  publicFunnel: FunnelStep[];
}
export interface PublicConfig { signupEnabled: boolean }

export interface AdminGateway {
  login(email: string, password: string): Promise<"authenticated" | "totp_required">;
  verifyTotp(totp: string): Promise<void>;
  session(): Promise<boolean>;
  logout(): Promise<void>;
  bootstrapStatus?(): Promise<boolean>;
  requestBootstrap?(): Promise<{ status: "queued" }>;
  bootstrapChallenge?(token: string): Promise<{ email: string; totpSecret: string; totpUri: string }>;
  completeBootstrap?(input: { token: string; password: string; totp: string }): Promise<string[]>;
  users(query: UserQuery): Promise<UserPage>;
  user(
    id: string,
  ): Promise<{
    user: User;
    memberships: Membership[];
    activity: ActivityEvent[];
    audit: AuditEvent[];
  }>;
  updateUser(id: string, patch: Pick<User, "name" | "email">): Promise<void>;
  setUserStatus(id: string, status: UserStatus): Promise<void>;
  setMembershipRole(
    userId: string,
    householdId: string,
    role: HouseholdRole,
  ): Promise<void>;
  access(): Promise<{ allowlist: AllowEntry[]; invitations: Invitation[] }>;
  addAllowed(email: string): Promise<void>;
  revokeAllowed(id: string): Promise<void>;
  invite(email: string, householdId?: string): Promise<void>;
  revokeInvite(id: string): Promise<void>;
  resendInvite(id: string): Promise<void>;
  households(): Promise<Household[]>;
  household(
    id: string,
  ): Promise<{
    household: Household;
    memberships: Membership[];
    members: User[];
    tasks: TaskMeta[];
    activity: ActivityEvent[];
  }>;
  analytics(filter: AnalyticsFilter): Promise<Analytics>;
  waitlistAnalytics(period: 7 | 30 | 90): Promise<WaitlistAnalytics>;
  waitlist(query: WaitlistQuery): Promise<WaitlistPage>;
  deleteWaitlistEntry(id: string): Promise<void>;
}

export interface InvitationPreview {
  id: string;
  email: string;
  source: Exclude<AccessSource, "lista" | "publico">;
  householdName?: string;
  status: InvitationStatus;
  expiresAt: string;
}

export interface AuthSession {
  user: Pick<User, "id" | "name" | "email">;
  memberships: Array<{
    householdId: string;
    householdName: string;
    role: HouseholdRole;
  }>;
  canCreateHouse: boolean;
}

export interface AuthGateway {
  invitation(id: string): Promise<InvitationPreview>;
  register(input: {
    name: string;
    email: string;
    password: string;
    invitationId?: string;
  }): Promise<AuthSession | null>;
  login(email: string, password: string): Promise<AuthSession>;
  verifyEmail(token: string): Promise<AuthSession>;
  session(): Promise<AuthSession | null>;
  logout(): Promise<void>;
  requestPasswordReset(email: string): Promise<string | undefined>;
  resetPassword(token: string, password: string): Promise<void>;
  createHouse(name: string, timezone?: string): Promise<AuthSession>;
  residents: ResidentGateway;
}

export interface ResidentGateway {
  loadHousehold(id: string): Promise<{ version: number; data: HouseData }>;
  saveHousehold(id: string, version: number, data: HouseData, events?: ProductSyncEvent[]): Promise<{ version: number; firstValueAt?: string }>;
  updateProfileName(name: string): Promise<void>;
  exportAccount(): Promise<unknown>;
  deleteAccount(): Promise<void>;
  reminder(): Promise<{ enabled: boolean; time: string }>;
  saveReminder(enabled: boolean, time: string): Promise<void>;
  vapidPublicKey(): Promise<string>;
  savePushSubscription(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<void>;
  removePushSubscription(endpoint?: string): Promise<void>;
  renameHousehold(id: string, name: string): Promise<void>;
  inviteResident(id: string, email: string): Promise<void>;
  revokeInvitation(householdId: string, invitationId: string): Promise<void>;
  leaveHousehold(id: string): Promise<AuthSession>;
  deleteHousehold(id: string): Promise<void>;
  removeMember(householdId: string, userId: string): Promise<void>;
  transferResponsibility(householdId: string, userId: string): Promise<AuthSession>;
}

export type TaskSyncEvent = {
  id: string;
  type: "tarefa_criada" | "tarefa_concluida" | "tarefa_pulada" | "tarefa_editada";
  taskId: string;
  occurrenceDate?: string;
  scope?: "occurrence" | "series";
};
export type ProductSyncEvent = TaskSyncEvent | {
  id: string;
  type: "item_compra_adicionado";
  itemId: string;
};
