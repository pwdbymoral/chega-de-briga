import type { AdminGateway, Analytics, AnalyticsFilter, Household, Invitation, UserPage, UserQuery, UserStatus, AllowEntry, HouseholdRole, WaitlistQuery, WaitlistPage, WaitlistAnalytics } from "./contracts";
import { api, ApiError, json } from "../api/http";

export const httpAdminGateway: AdminGateway = {
  async login(email, password) {
    await api("/api/admin/session/challenge", json("POST", { email, password }));
    return "totp_required";
  },
  async verifyTotp(totp) { await api("/api/admin/session/verify", json("POST", { totp })); },
  async session() {
    try { await api("/api/admin/session"); return true; }
    catch (error) { if (error instanceof ApiError && error.status === 401) return false; throw error; }
  },
  async logout() { await api("/api/admin/session", json("DELETE")); },
  async bootstrapStatus() { return (await api<{ enabled: boolean }>("/api/admin/bootstrap/status")).enabled; },
  async requestBootstrap() { return api<{ status: "queued" }>("/api/admin/bootstrap/request", json("POST", {})); },
  bootstrapChallenge(token) { return api("/api/admin/bootstrap/challenge", json("POST", { token })); },
  async completeBootstrap(input) { return (await api<{ recoveryCodes: string[] }>("/api/admin/bootstrap/complete", json("POST", input))).recoveryCodes; },
  users(query: UserQuery): Promise<UserPage> {
    const params = new URLSearchParams({ search: query.search, status: query.status, page: String(query.page), page_size: "10" });
    return api(`/api/admin/users?${params}`);
  },
  user(id) { return api(`/api/admin/users/${encodeURIComponent(id)}`); },
  async updateUser(id, patch) { await api(`/api/admin/users/${encodeURIComponent(id)}`, json("PATCH", patch)); },
  async setUserStatus(id, status: UserStatus) { await api(`/api/admin/users/${encodeURIComponent(id)}/status`, json("PATCH", { status })); },
  async setMembershipRole(userId, householdId, role: HouseholdRole) { await api(`/api/admin/households/${encodeURIComponent(householdId)}/members/${encodeURIComponent(userId)}`, json("PATCH", { role })); },
  access() { return api<{ allowlist: AllowEntry[]; invitations: Invitation[] }>("/api/admin/access"); },
  async addAllowed(email) { await api("/api/admin/allow-entries", json("POST", { email })); },
  async revokeAllowed(id) { await api(`/api/admin/allow-entries/${encodeURIComponent(id)}`, json("DELETE")); },
  async invite(email, householdId) { await api("/api/admin/invitations", json("POST", { email, householdId })); },
  async revokeInvite(id) { await api(`/api/admin/invitations/${encodeURIComponent(id)}`, json("DELETE")); },
  async resendInvite(id) { await api(`/api/admin/invitations/${encodeURIComponent(id)}/resend`, json("POST", {})); },
  households(): Promise<Household[]> { return api("/api/admin/households"); },
  household(id) { return api(`/api/admin/households/${encodeURIComponent(id)}`); },
  analytics(filter: AnalyticsFilter): Promise<Analytics> {
    const params = new URLSearchParams({ period: String(filter.period), source: filter.source, size: filter.size });
    return api(`/api/admin/analytics?${params}`);
  },
  waitlistAnalytics(period: 7 | 30 | 90): Promise<WaitlistAnalytics> {
    return api(`/api/admin/waitlist/analytics?period=${period}`);
  },
  waitlist(query: WaitlistQuery): Promise<WaitlistPage> {
    const params = new URLSearchParams({ search: query.search, channel: query.channel, campaign: query.campaign, page: String(query.page), page_size: "10" });
    return api(`/api/admin/waitlist?${params}`);
  },
  async deleteWaitlistEntry(id) { await api(`/api/admin/waitlist/${encodeURIComponent(id)}`, json("DELETE")); },
};
