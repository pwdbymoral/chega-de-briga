import type { AuthGateway, AuthSession, InvitationPreview, ProductSyncEvent, ResidentGateway, TaskHistoryResponse, WeeklyReviewAnswers, WeeklyReviewEntry } from "../admin/contracts";
import { api, ApiError, json } from "../api/http";
import { clearCachedHouses } from "../resident/localCache";

export const residentGateway: ResidentGateway = {
  loadHousehold(id) {
    return api(`/api/households/${encodeURIComponent(id)}/state`);
  },
  saveHousehold(id, version, data, events: ProductSyncEvent[] = []) {
    return api(`/api/households/${encodeURIComponent(id)}/state`, json("PUT", { version, data, events }));
  },
  async updateProfileName(name) {
    await api("/api/me", json("PATCH", { name }));
  },
  exportAccount() { return api("/api/me/export"); },
  async deleteAccount() { await api("/api/me", json("DELETE")); },
  reminder() { return api("/api/me/reminder"); },
  async saveReminder(enabled, time) { await api("/api/me/reminder", json("PATCH", { enabled, time })); },
  reviewReminder() { return api("/api/me/review-reminder"); },
  async saveReviewReminder(enabled) { await api("/api/me/review-reminder", json("PATCH", { enabled })); },
  async vapidPublicKey() { return (await api<{ key: string }>("/api/push/vapid-public-key")).key; },
  async savePushSubscription(subscription) { await api("/api/push/subscriptions", json("POST", { subscription })); },
  async removePushSubscription(endpoint) { await api("/api/push/subscriptions", json("DELETE", { endpoint })); },
  async renameHousehold(id, name) {
    await api(`/api/households/${encodeURIComponent(id)}`, json("PATCH", { name }));
  },
  async inviteResident(id, email) {
    await api(`/api/households/${encodeURIComponent(id)}/invitations`, json("POST", { email }));
  },
  async revokeInvitation(householdId, invitationId) {
    await api(`/api/households/${encodeURIComponent(householdId)}/invitations/${encodeURIComponent(invitationId)}`, json("DELETE"));
  },
  async leaveHousehold(id) {
    return (await api<{ session: AuthSession }>(`/api/households/${encodeURIComponent(id)}/members/me`, json("DELETE"))).session;
  },
  async deleteHousehold(id) {
    await api(`/api/households/${encodeURIComponent(id)}`, json("DELETE"));
  },
  async removeMember(householdId, userId) {
    await api(`/api/households/${encodeURIComponent(householdId)}/members/${encodeURIComponent(userId)}`, json("DELETE"));
  },
  async transferResponsibility(householdId, userId) {
    return (await api<{ session: AuthSession }>(`/api/households/${encodeURIComponent(householdId)}/members/${encodeURIComponent(userId)}`, json("PATCH", { role: "responsavel" }))).session;
  },
  fetchTaskHistory(householdId, taskId) {
    return api<TaskHistoryResponse>(`/api/households/${encodeURIComponent(householdId)}/tasks/${encodeURIComponent(taskId)}/history`);
  },
  async submitWeeklyReview(householdId, answers: WeeklyReviewAnswers) {
    await api(`/api/households/${encodeURIComponent(householdId)}/review`, json("POST", answers));
  },
  fetchWeeklyReviews(householdId) {
    return api<WeeklyReviewEntry[]>(`/api/households/${encodeURIComponent(householdId)}/reviews/mine`);
  },
};

export const httpAuthGateway: AuthGateway = {
  residents: residentGateway,
  async invitation(id): Promise<InvitationPreview> {
    return api("/api/auth/invitations/preview", json("POST", { token: id }));
  },
  async register(input) {
    const result = await api<{ session?: AuthSession }>("/api/auth/registrations", json("POST", input));
    return result.session ?? null;
  },
  async verifyEmail(token) {
    const result = await api<{ session: AuthSession }>("/api/auth/email-verifications", json("POST", { token }));
    return result.session;
  },
  async login(email, password) {
    const result = await api<{ session: AuthSession }>("/api/auth/session", json("POST", { email, password }));
    return result.session;
  },
  async session() {
    try {
      const result = await api<{ session: AuthSession }>("/api/auth/session");
      return result.session;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },
  async logout() {
    let sessionClosed = false;
    try {
      let subscription: PushSubscription | null = null;
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready.catch(() => undefined);
        subscription = await registration?.pushManager.getSubscription() ?? null;
        if (subscription) await residentGateway.removePushSubscription(subscription.endpoint);
      }
      await api("/api/auth/session", json("DELETE"));
      sessionClosed = true;
      await subscription?.unsubscribe();
    } finally {
      if (sessionClosed) await clearCachedHouses();
    }
  },
  async requestPasswordReset(email) {
    await api("/api/auth/password-resets", json("POST", { email }));
    return undefined;
  },
  async resetPassword(token, password) {
    await api("/api/auth/password-resets/confirm", json("POST", { token, password }));
  },
  async createHouse(name, timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Fortaleza") {
    const result = await api<{ session: AuthSession }>("/api/households", json("POST", { name, timezone }));
    return result.session;
  },
};
