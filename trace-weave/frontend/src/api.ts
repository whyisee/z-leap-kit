export type CandidateEntity = {
  mention: string;
  entityType: string;
  role: string;
  quantity?: number;
  unit?: string;
  amount?: number;
  currency?: string;
  confidence?: number;
  attributes: Record<string, unknown>;
  resolvedUserEntityId?: string;
};

export type CandidateParticipant = {
  mention: string;
  role: string;
  isCurrentUser: boolean;
  confidence?: number;
  resolvedUserEntityId?: string;
};

export type EventCandidate = {
  schemaVersion: "event-candidate/v1";
  eventType: string;
  title: string;
  factualStatus:
    | "occurred"
    | "ongoing"
    | "planned"
    | "cancelled"
    | "negated"
    | "uncertain"
    | "inferred";
  time: {
    start: string | null;
    end: string | null;
    timezone: string | null;
    precision: string;
    sourceExpression: string | null;
  };
  participants: CandidateParticipant[];
  entities: CandidateEntity[];
  subjectiveExperience: Record<string, unknown>;
  extensions: Record<string, unknown>;
  confidence: number;
};

export type CandidateRecord = {
  id: string;
  resolutionId?: string;
  sourceCandidateIds?: string[];
  payload: EventCandidate;
  parserProvider?: "mock" | "deepseek";
  parserModelVersion?: string;
  location?: {
    observationId: string;
    role: LocationRole;
  };
};

export type LocationRole = "occurred_at" | "recorded_at";

export type LocationInput = {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  altitudeM?: number | null;
  altitudeAccuracyM?: number | null;
  headingDeg?: number | null;
  speedMps?: number | null;
  capturedAt: string;
  source: "browser_geolocation" | "manual_pin" | "shared_place" | "import";
  label: string | null;
  defaultEventRole: LocationRole;
  socialMatching: boolean;
};

export type LocationObservation = {
  id: string;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  capturedAt: string;
  label: string | null;
  defaultEventRole: LocationRole;
  socialMatching: boolean;
  sensitivity: "normal" | "sensitive" | "prohibited";
};

export type MediaKind = "voice" | "image" | "screenshot" | "video" | "file";

export type MediaAttachment = {
  id: string;
  kind: MediaKind;
  originalFilename: string | null;
  mimeType: string;
  byteSize: number;
  durationMs: number | null;
  url: string;
};

export type EventPrivacySettings = {
  contentVisibility: "private" | "friends" | "circle" | "public" | "isolated";
  allowAnonymousStats: boolean;
  allowMatching: boolean;
  allowIdentityDisclosure: boolean;
  allowSharedOccurrence: boolean;
  policyVersion: number;
  hasOverride: boolean;
  discoveryEnabled: boolean;
  effectiveMatching: boolean;
  sensitiveMatchExcluded: boolean;
  sources: Record<
    "contentVisibility" | "allowAnonymousStats" | "allowMatching" | "allowIdentityDisclosure" | "allowSharedOccurrence",
    { level: string; subjectKeys: string[]; version: number; reason?: string }
  >;
};

export type PrivacyPolicy = {
  level: "user_default" | "activity_category" | "entity";
  subjectKey: string;
  version: number;
  contentVisibility: EventPrivacySettings["contentVisibility"] | null;
  allowAnonymousStats: boolean | null;
  allowMatching: boolean | null;
  allowIdentityDisclosure: boolean | null;
  allowSharedOccurrence: boolean | null;
};

export type PrivacyOverview = {
  defaultPolicy: PrivacyPolicy;
  categories: Array<{ eventType: string; eventCount: number; policy: PrivacyPolicy | null }>;
  entities: Array<{ id: string; name: string; entityType: string; eventCount: number; policy: PrivacyPolicy | null }>;
};

export type EntityMemory = {
  id: string;
  entityType: string;
  displayName: string;
  normalizedName: string;
  canonicalEntityId: string | null;
  sensitivity: "normal" | "sensitive" | "prohibited";
  eventCount: number;
  aliases: Array<{ id: string; alias: string; normalizedAlias: string }>;
  createdAt: string;
  updatedAt: string;
};

export type EntityEvidence = {
  id: string;
  evidenceType: "entity_relation" | "participant";
  eventId: string;
  eventTitle: string;
  eventType: string;
  occurredStart: string | null;
  role: string;
};

export type EntityOperation = {
  id: string;
  operationType: "merge" | "split";
  sourceEntityId: string;
  sourceName: string;
  targetEntityId: string;
  targetName: string;
  status: "active" | "undone";
  createdAt: string;
};

export type NotificationPreferences = {
  browserNotificationsEnabled: boolean;
  draftReminderDelayMinutes: number;
};

export type AppNotification = {
  id: string;
  notificationType: "draft_due" | string;
  resourceType: "raw_entry" | string;
  resourceId: string;
  title: string;
  body: string;
  status: "pending" | "delivered" | "read";
  scheduledAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
};

export type LifeQueryIntent = {
  intent: "count_events" | "sum_amount" | "latest_event" | "top_entities" | "list_events";
  datePreset: "all" | "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "recent_7_days" | "recent_30_days" | "custom";
  dateRange: { start: string | null; end: string | null };
  eventTypes: string[];
  entityMention: string | null;
  entityType: string | null;
  limit: number;
};

export type LifeQueryResult = {
  question: string;
  answer: string;
  rows: Array<Record<string, unknown>>;
  query: LifeQueryIntent;
  parser: { provider: "mock" | "deepseek"; model: string };
};

export type PeriodReport = {
  period: "week" | "month";
  range: { start: string; end: string; timezone: string };
  summary: { eventCount: number; activeDays: number; previousEventCount: number };
  eventTypes: Array<{ eventType: string; count: number }>;
  topEntities: Array<{ name: string; type: string; count: number }>;
  spending: Array<{ currency: string; amount: number }>;
  recentEvents: Array<{ id: string; title: string; eventType: string; occurredStart: string | null }>;
};

export type LifeInsights = {
  generatedAt: string;
  trends: Array<{ eventType: string; currentCount: number; previousCount: number; change: number }>;
  anomalies: Array<{ day: string; count: number; baseline: number }>;
  assertions: Array<{
    id: string; predicate: string; value: Record<string, unknown>; status: "active" | "retracted";
    confidence: number; evidenceEventIds: string[]; createdAt: string;
    targetName: string | null; targetType: string | null; targetEntityId: string | null;
  }>;
  inferences: Array<{
    id: string; relationType: string; confidence: number; evidence: { eventCount?: number; eventIds?: string[]; lastOccurred?: string };
    inferenceVersion: string; status: "active" | "confirmed" | "rejected" | "hidden";
    generatedAt: string; expiresAt: string | null; targetName: string | null; targetType: string | null; targetEntityId: string | null;
  }>;
};

export type HealthStatus = {
  status: "ok";
  databaseTime: string;
  appliedMigrations: number;
  ai: {
    provider: "mock" | "deepseek";
    model: string;
    configured: boolean;
  };
  speechToText: { provider: string; model: string; configured: boolean };
  webPush: { configured: boolean };
};

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  createdAt?: string;
};

export type GraphNode = {
  id: string;
  kind: "user" | "event" | "occurrence" | "entity" | "person" | "location" | "match";
  label: string;
  category: string;
  weight: number;
  metadata: Record<string, unknown>;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type: "participated" | "evidence" | "relationship";
  label: string;
  weight: number;
  evidenceEventIds: string[];
};

export type PersonalGraph = {
  nodes: GraphNode[];
  evidenceEdges: GraphEdge[];
  relationshipEdges: GraphEdge[];
  stats: {
    events: number; entities: number; people: number; locations: number; socialMatches: number;
    users?: number; occurrences?: number; sharedFeatures?: number;
    catalogEntities?: number; connectedEntities?: number;
  };
};

export type GlobalGraph = PersonalGraph;

export type SocialReason = {
  canonicalEntityId: string;
  featureType: string;
  entityType: string;
  label: string;
  contribution: number;
};

export type SocialMatch = {
  id: string;
  score: number;
  status: "anonymous_candidate" | "contact_pending" | "connected";
  connectionState: "candidate" | "incoming" | "waiting_other" | "connected";
  identityRevealed: boolean;
  otherUser: AuthUser | null;
  anonymousLabel: string;
  reasons: SocialReason[];
};

export type SocialDiscovery = {
  settings: { participateInDiscovery: boolean; policyVersion: number };
  matches: SocialMatch[];
};

export type Draft = {
  id: string;
  status: "awaiting_confirmation" | "failed";
  createdAt: string;
  draftReminderAfter: string | null;
  text: string;
  contentKind: "text" | "voice";
  attachments: MediaAttachment[];
  location: LocationObservation | null;
  candidates: CandidateRecord[];
};

export type TimelineEvent = {
  id: string;
  version: number;
  eventType: string;
  title: string;
  factualStatus: string;
  occurredStart: string | null;
  occurredEnd: string | null;
  timePrecision: string;
  timezone: string | null;
  sourceTimeExpression: string | null;
  createdAt: string;
  isOwned: boolean;
  owner: AuthUser;
  attachments: MediaAttachment[];
  entities: Array<{
    id: string; name: string; type: string; role: string;
    quantity?: number; unit?: string; amount?: number; currency?: string; attributes: Record<string, unknown>;
  }>;
  participants: Array<{
    id: string;
    userEntityId: string | null;
    name: string;
    role: string;
    isCurrentUser: boolean;
    isAccount: boolean;
    link: {
      inviteId: string;
      status: "invited" | "accepted";
      username: string;
      displayName: string;
    } | null;
  }>;
  location: {
    id: string;
    label: string | null;
    latitude: number;
    longitude: number;
    accuracyM: number | null;
    role: LocationRole;
    socialMatching: boolean;
  } | null;
};

export type EventDetail = {
  event: Record<string, unknown>;
  source: {
    entryId: string;
    inputLocale: string;
    clientTimezone: string;
    clientCreatedAt: string | null;
    createdAt: string;
    confirmedAt: string | null;
    contents: Array<{
      id: string;
      position: number;
      kind: string;
      text: string | null;
      transcript: string | null;
      transcriptProvider: string | null;
      attachment: null | { id: string; kind: MediaKind; filename: string | null; mimeType: string; byteSize: number; durationMs: number | null; url: string };
    }>;
  };
  revisions: Array<{
    version: number;
    operation: "created" | "updated" | "deleted";
    changedFields: string[];
    createdAt: string;
    snapshot: Record<string, unknown>;
  }>;
};

export type SharedParticipantInvite = {
  id: string;
  status: "invited" | "accepted";
  participantMention: string;
  event: {
    id: string;
    title: string;
    eventType: string;
    occurredDate: string | null;
  };
  inviter: AuthUser;
  candidateEvents: Array<{ id: string; title: string; eventType: string; occurredStart: string | null }>;
};

export type SharedFactPermissions = { eventTitle: boolean; entities: boolean; coarseTime: boolean; coarseLocation: boolean };
export type SharedOccurrence = {
  id: string; version: number; status: string; occurredDate: string | null; myPermissions: SharedFactPermissions;
  members: Array<{ user: AuthUser; permissions: SharedFactPermissions; joinedAt: string }>;
  events: Array<{ id: string; ownerUserId: string; title: string; eventType: string; occurredDate: string | null; entities: Array<{ canonicalEntityId?: string; name: string; type: string; role: string }> }>;
};

export type SocialCircle = { id: string; name: string; circleType: "interest" | "place"; entityType: string; entityName: string; memberCount: number; joined: boolean };
export type CircleStat = { circleId: string; participantCountLowerBound: number; recentEventCount: number; previousEventCount: number; trend: number };
export type CircleContext = { id: string; name: string; circleType: "interest" | "place" };
export type CircleRelatedEntity = { id: string; name: string; entityType: string; eventCount: number; participantCountLowerBound: number };
export type SocialFeedItem = { id: string; ownerUserId: string; title: string; eventType: string; occurredDate: string | null; createdAt: string; owner: AuthUser; circles: CircleContext[] };
export type CircleDetail = { circle: SocialCircle; stat: CircleStat | null; relatedEntities: CircleRelatedEntity[]; feed: SocialFeedItem[]; anonymityThreshold: number };

export type DirectMessagePreview = {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
};

export type Contact = {
  connectionId: string;
  source: "discovery" | "friend_request" | "shared_occurrence";
  status: "active" | "muted";
  connectedAt: string;
  user: AuthUser;
  conversationId: string | null;
  unreadCount: number;
  lastMessage: DirectMessagePreview | null;
};

export type ContactRequest = {
  id: string;
  direction: "incoming" | "outgoing";
  message: string | null;
  status: "pending";
  createdAt: string;
  respondedAt: string | null;
  user: AuthUser;
};

export type ContactOverview = {
  contacts: Contact[];
  incomingRequests: ContactRequest[];
  outgoingRequests: ContactRequest[];
  unreadTotal: number;
};

export type ContactSearchResult = AuthUser & {
  relationship: "none" | "friend" | "incoming" | "outgoing";
};

export type ConversationSummary = {
  id: string;
  createdAt: string;
  updatedAt: string;
  otherUser: AuthUser;
  lastMessage: DirectMessagePreview | null;
  unreadCount: number;
  canSend: boolean;
};

export type DirectMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isMultipart = init?.body instanceof FormData;
  const hasBody = init?.body !== undefined && init.body !== null;
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(isMultipart || !hasBody ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as
      | { message?: string; code?: string }
      | null;
    throw new ApiError(
      error?.message ?? `请求失败（${response.status}）`,
      response.status,
      error?.code,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  register(input: { username: string; displayName: string; password: string }) {
    return request<{ user: AuthUser }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  login(input: { username: string; password: string }) {
    return request<{ user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  logout() {
    return request<void>("/api/auth/logout", { method: "POST" });
  },

  getMe() {
    return request<{ user: AuthUser }>("/api/auth/me");
  },

  async downloadAccountData() {
    const response = await fetch("/api/data/export", { credentials: "include" });
    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as { message?: string; code?: string } | null;
      throw new ApiError(error?.message ?? `导出失败（${response.status}）`, response.status, error?.code);
    }
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "traceweave-export.json";
    return { blob: await response.blob(), filename };
  },

  deleteAccount(input: { password: string; usernameConfirmation: string }) {
    return request<{ jobId: string; status: "pending"; message: string }>("/api/data/deletion", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  createEntry(text: string, location?: LocationInput) {
    return request<{
      entry: { id: string; status: string; text: string };
      location: LocationObservation | null;
      candidates: CandidateRecord[];
      parser: { provider: "mock" | "deepseek"; model: string };
    }>("/api/entries", {
      method: "POST",
      body: JSON.stringify({
        text,
        clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        clientCreatedAt: new Date().toISOString(),
        location,
      }),
    });
  },

  createVoiceEntry(input: {
    audio: Blob;
    filename: string;
    transcript: string;
    durationMs: number;
    transcriptProvider: "browser-web-speech" | "manual";
    location?: LocationInput;
  }) {
    const form = new FormData();
    form.append("audio", input.audio, input.filename);
    form.append("transcript", input.transcript);
    form.append("durationMs", String(Math.round(input.durationMs)));
    form.append("transcriptProvider", input.transcriptProvider);
    form.append("inputLocale", "zh-CN");
    form.append("clientTimezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
    form.append("clientCreatedAt", new Date().toISOString());
    if (input.location) form.append("location", JSON.stringify(input.location));
    return request<{
      entry: { id: string; status: string; text: string; inputKind: "voice" };
      media: {
        id: string;
        mimeType: string;
        byteSize: number;
        durationMs: number | null;
        url: string;
      };
      location: LocationObservation | null;
      candidates: CandidateRecord[];
      parser: { provider: "mock" | "deepseek"; model: string };
    }>("/api/entries/voice", { method: "POST", body: form });
  },

  createMixedEntry(input: {
    text: string;
    textBlocks?: string[];
    audio?: { blob: Blob; filename: string; durationMs: number };
    attachments: Array<{ file: File; kind: Exclude<MediaKind, "voice"> }>;
    transcriptProvider: "browser-web-speech" | "manual";
    location?: LocationInput;
  }) {
    const form = new FormData();
    form.append("text", input.text);
    form.append("transcriptProvider", input.transcriptProvider);
    form.append("inputLocale", "zh-CN");
    form.append("clientTimezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
    form.append("clientCreatedAt", new Date().toISOString());
    if (input.audio) {
      form.append("durationMs", String(Math.round(input.audio.durationMs)));
      form.append("voice", input.audio.blob, input.audio.filename);
    }
    for (const attachment of input.attachments) {
      form.append(attachment.kind, attachment.file, attachment.file.name);
    }
    if (input.location) form.append("location", JSON.stringify(input.location));
    const textBlocks = input.textBlocks?.filter((block) => block.trim()) ?? [input.text];
    form.append("textBlocks", JSON.stringify(textBlocks));
    const mediaCount = (input.audio ? 1 : 0) + input.attachments.length;
    form.append("contentOrder", JSON.stringify([
      ...textBlocks.map((_, index) => ({ type: "text", index })),
      ...Array.from({ length: mediaCount }, (_, index) => ({ type: "media", index })),
    ]));

    return request<{
      entry: { id: string; status: string; text: string; inputKind: "mixed" };
      attachments: MediaAttachment[];
      location: LocationObservation | null;
      candidates: CandidateRecord[];
      parser: { provider: "mock" | "deepseek"; model: string };
    }>("/api/entries/mixed", { method: "POST", body: form });
  },

  confirmEntry(entryId: string, accepted: CandidateRecord[], rejectedCandidateIds: string[]) {
    return request<{ entryId: string; status: "confirmed"; eventIds: string[] }>(
      `/api/entries/${entryId}/confirm`,
      {
        method: "POST",
        body: JSON.stringify({
          accepted: accepted.map((candidate) => ({
            resolutionId: candidate.resolutionId ?? crypto.randomUUID(),
            sourceCandidateIds: candidate.sourceCandidateIds ?? [candidate.id],
            payload: candidate.payload,
            location: candidate.location,
          })),
          rejectedCandidateIds,
        }),
      },
    );
  },

  appendDraftText(entryId: string, text: string) {
    return request<{
      entry: { id: string; status: "awaiting_confirmation"; text: string };
      candidates: CandidateRecord[];
      parser: { provider: "mock" | "deepseek"; model: string };
    }>(`/api/entries/${entryId}/text-blocks`, { method: "POST", body: JSON.stringify({ text }) });
  },

  getDrafts() {
    return request<{ drafts: Draft[] }>("/api/entries/drafts");
  },

  getNotifications() {
    return request<{
      notifications: AppNotification[];
      preferences: NotificationPreferences;
    }>("/api/notifications");
  },

  runLifeQuery(question: string) {
    return request<LifeQueryResult>("/api/review/query", {
      method: "POST",
      body: JSON.stringify({
        question,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        referenceTime: new Date().toISOString(),
      }),
    });
  },

  getPeriodReport(period: "week" | "month", anchor = new Date()) {
    const search = new URLSearchParams({
      period,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      anchor: anchor.toISOString(),
    });
    return request<PeriodReport>(`/api/review/report?${search.toString()}`);
  },

  getLifeInsights() {
    return request<LifeInsights>("/api/review/insights");
  },

  createAssertion(input: { predicate: string; targetEntityId: string | null; sourceEventId: string | null; value: Record<string, unknown> }) {
    return request<{ id: string }>("/api/review/assertions", { method: "POST", body: JSON.stringify(input) });
  },

  decideInference(inferenceId: string, action: "confirm" | "reject" | "hide") {
    return request<{ status: "ok" }>(`/api/review/inferences/${inferenceId}/action`, { method: "POST", body: JSON.stringify({ action }) });
  },

  retractAssertion(assertionId: string) {
    return request<{ status: "ok" }>(`/api/review/assertions/${assertionId}/retract`, { method: "POST" });
  },

  setNotificationPreferences(preferences: NotificationPreferences) {
    return request<NotificationPreferences>("/api/notification-preferences", {
      method: "PATCH",
      body: JSON.stringify(preferences),
    });
  },

  updateNotification(
    notificationId: string,
    action: "delivered" | "read" | "dismiss",
  ) {
    return request<{ notificationId: string; status: string }>(
      `/api/notifications/${notificationId}/action`,
      { method: "POST", body: JSON.stringify({ action }) },
    );
  },

  getPushConfig() {
    return request<{ configured: boolean; publicKey: string | null }>("/api/push/config");
  },

  savePushSubscription(subscription: PushSubscriptionJSON) {
    return request<{ status: "active" }>("/api/push/subscriptions", { method: "POST", body: JSON.stringify(subscription) });
  },

  transcribeAudio(audio: Blob, filename: string) {
    const form = new FormData();
    form.append("audio", audio, filename);
    form.append("language", "zh-CN");
    return request<{ text: string; provider: string; model: string }>("/api/speech/transcribe", { method: "POST", body: form });
  },

  deleteDraft(entryId: string) {
    return request<void>(`/api/entries/${entryId}`, { method: "DELETE" });
  },

  getTimeline(filters: {
    q?: string; eventType?: string; entityId?: string; personId?: string; placeId?: string;
    from?: string; to?: string; page?: number; limit?: number;
  } = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") query.set(key, String(value));
    return request<{ events: TimelineEvent[]; page: number; limit: number; total: number }>(`/api/timeline${query.size ? `?${query}` : ""}`);
  },

  getEventDetail(eventId: string) {
    return request<EventDetail>(`/api/events/${eventId}`);
  },

  updateEvent(
    eventId: string,
    input: {
      expectedVersion: number;
      title: string;
      eventType: string;
      factualStatus: TimelineEvent["factualStatus"];
      occurredStart: string | null;
      occurredEnd: string | null;
      timePrecision: string;
      timezone: string | null;
      sourceTimeExpression: string | null;
    },
  ) {
    return request<{ eventId: string; version: number; changedFields: string[] }>(
      `/api/events/${eventId}`,
      { method: "PATCH", body: JSON.stringify(input) },
    );
  },

  updateEventRelations(
    eventId: string,
    input: {
      expectedVersion: number;
      participants: Array<CandidateParticipant & { existingParticipantId?: string }>;
      entities: CandidateEntity[];
      location: { observationId: string; role: LocationRole } | null;
    },
  ) {
    return request<{ eventId: string; version: number; changedFields: string[] }>(`/api/events/${eventId}/relations`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  deleteEvent(eventId: string, expectedVersion: number) {
    return request<void>(`/api/events/${eventId}`, {
      method: "DELETE",
      body: JSON.stringify({ expectedVersion }),
    });
  },

  getEventPrivacy(eventId: string) {
    return request<EventPrivacySettings>(`/api/events/${eventId}/privacy`);
  },

  setEventPrivacy(
    eventId: string,
    input: Pick<
      EventPrivacySettings,
      "contentVisibility" | "allowAnonymousStats" | "allowMatching" | "allowIdentityDisclosure" | "allowSharedOccurrence"
    > & { expectedEventVersion: number },
  ) {
    return request<EventPrivacySettings>(`/api/events/${eventId}/privacy`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  getPrivacyOverview() {
    return request<PrivacyOverview>("/api/privacy/settings");
  },

  setDefaultPrivacy(input: Omit<PrivacyPolicy, "level" | "subjectKey" | "version">) {
    return request<PrivacyOverview>("/api/privacy/default", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  setCategoryPrivacy(
    eventType: string,
    input: Omit<PrivacyPolicy, "level" | "subjectKey" | "version">,
  ) {
    return request<PrivacyOverview>(`/api/privacy/categories/${encodeURIComponent(eventType)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  removeCategoryPrivacy(eventType: string) {
    return request<void>(`/api/privacy/categories/${encodeURIComponent(eventType)}`, { method: "DELETE" });
  },

  setEntityPrivacy(
    entityId: string,
    input: Omit<PrivacyPolicy, "level" | "subjectKey" | "version">,
  ) {
    return request<PrivacyOverview>(`/api/privacy/entities/${entityId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  removeEntityPrivacy(entityId: string) {
    return request<void>(`/api/privacy/entities/${entityId}`, { method: "DELETE" });
  },

  getEntityMemory(search = "", entityType?: string) {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (entityType) query.set("entityType", entityType);
    const suffix = query.size ? `?${query.toString()}` : "";
    return request<{ entities: EntityMemory[] }>(`/api/entities${suffix}`);
  },

  renameEntity(entityId: string, displayName: string) {
    return request<{ entities: EntityMemory[] }>(`/api/entities/${entityId}`, {
      method: "PATCH",
      body: JSON.stringify({ displayName }),
    });
  },

  addEntityAlias(entityId: string, alias: string) {
    return request<{ entities: EntityMemory[] }>(`/api/entities/${entityId}/aliases`, {
      method: "POST",
      body: JSON.stringify({ alias }),
    });
  },

  mergeEntity(entityId: string, targetEntityId: string) {
    return request<{ entities: EntityMemory[] }>(`/api/entities/${entityId}/merge`, {
      method: "POST",
      body: JSON.stringify({ targetEntityId }),
    });
  },

  getEntityEvidence(entityId: string) {
    return request<{ evidence: EntityEvidence[] }>(`/api/entities/${entityId}/evidence`);
  },

  splitEntity(entityId: string, input: { displayName: string; evidenceIds: string[]; aliasIds: string[] }) {
    return request<{ entities: EntityMemory[] }>(`/api/entities/${entityId}/split`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  getEntityOperations() {
    return request<{ operations: EntityOperation[] }>("/api/entity-operations");
  },

  undoEntityOperation(operationId: string) {
    return request<{ entities: EntityMemory[] }>(`/api/entity-operations/${operationId}/undo`, { method: "POST" });
  },

  getSharedInvites() {
    return request<{ invites: SharedParticipantInvite[] }>("/api/shared-invites");
  },

  inviteEventParticipant(eventId: string, participantId: string, username: string) {
    return request<{ inviteId: string; status: "invited" }>(
      `/api/events/${eventId}/participants/${participantId}/invite`,
      { method: "POST", body: JSON.stringify({ username }) },
    );
  },

  decideSharedInvite(inviteId: string, decision: "accept" | "decline" | "revoke", options?: { linkedEventId?: string; permissions?: SharedFactPermissions }) {
    return request<{ inviteId: string; status: string }>(
      `/api/shared-invites/${inviteId}/decision`,
      { method: "POST", body: JSON.stringify({ decision, ...options }) },
    );
  },

  getSharedOccurrences() {
    return request<{ occurrences: SharedOccurrence[] }>("/api/shared-occurrences");
  },

  updateSharedOccurrencePermissions(occurrenceId: string, permissions: SharedFactPermissions) {
    return request<{ status: "ok" }>(`/api/shared-occurrences/${occurrenceId}/permissions`, { method: "PATCH", body: JSON.stringify(permissions) });
  },

  getCircles() { return request<{ circles: SocialCircle[]; anonymityThreshold: number }>("/api/circles"); },
  getCircleStats() { return request<{ stats: CircleStat[]; anonymityThreshold: number }>("/api/circles/stats"); },
  getCircleDetail(circleId: string) { return request<CircleDetail>(`/api/circles/${circleId}`); },
  setCircleMembership(circleId: string, joined: boolean) {
    return request<{ circles: SocialCircle[]; anonymityThreshold: number }>(`/api/circles/${circleId}/membership`, { method: "POST", body: JSON.stringify({ joined }) });
  },
  getSocialFeed() { return request<{ feed: SocialFeedItem[] }>("/api/social/feed"); },
  blockUser(userId: string, reason?: string) { return request<{ status: "blocked" }>("/api/social/block", { method: "POST", body: JSON.stringify({ userId, reason }) }); },
  reportUser(input: { reportedUserId: string; reason: "harassment" | "spam" | "impersonation" | "privacy" | "unsafe_content" | "other"; details?: string; contextType?: string; contextId?: string }) {
    return request<{ status: "submitted" }>("/api/social/report", { method: "POST", body: JSON.stringify(input) });
  },

  getContacts() {
    return request<ContactOverview>("/api/contacts");
  },

  searchContactUsers(query: string) {
    return request<{ users: ContactSearchResult[] }>(`/api/contacts/search?q=${encodeURIComponent(query)}`);
  },

  sendFriendRequest(recipientUserId: string, message?: string) {
    return request<{ requestId: string; status: "pending" }>("/api/contact-requests", {
      method: "POST",
      body: JSON.stringify({ recipientUserId, message }),
    });
  },

  decideFriendRequest(requestId: string, decision: "accept" | "reject" | "cancel") {
    return request<{ requestId: string; status: string; conversationId: string | null }>(
      `/api/contact-requests/${requestId}/decision`,
      { method: "POST", body: JSON.stringify({ decision }) },
    );
  },

  removeContact(userId: string) {
    return request<{ status: "removed" }>(`/api/contacts/${userId}`, { method: "DELETE" });
  },

  getConversations() {
    return request<{ conversations: ConversationSummary[]; unreadTotal: number }>("/api/conversations");
  },

  openConversation(userId: string) {
    return request<{ conversationId: string }>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  },

  getConversationMessages(conversationId: string, before?: string) {
    const query = before ? `?before=${encodeURIComponent(before)}` : "";
    return request<{
      conversation: { id: string; otherUser: AuthUser; canSend: boolean };
      messages: DirectMessage[];
      nextCursor: string | null;
    }>(`/api/conversations/${conversationId}/messages${query}`);
  },

  sendDirectMessage(conversationId: string, content: string, clientMessageId = crypto.randomUUID()) {
    return request<{ message: DirectMessage }>(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content, clientMessageId }),
    });
  },

  markConversationRead(conversationId: string) {
    return request<{ status: "read" }>(`/api/conversations/${conversationId}/read`, { method: "POST" });
  },

  getGraph() {
    return request<PersonalGraph>("/api/graph");
  },

  getGlobalGraph() {
    return request<GlobalGraph>("/api/graph/global");
  },

  getSocial() {
    return request<SocialDiscovery>("/api/social");
  },

  setSocialDiscovery(participateInDiscovery: boolean) {
    return request<SocialDiscovery>("/api/social/settings", {
      method: "POST",
      body: JSON.stringify({ participateInDiscovery }),
    });
  },

  decideSocialMatch(matchId: string, decision: "connect" | "dismiss" | "disconnect") {
    return request<SocialDiscovery>(`/api/social/matches/${matchId}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    });
  },

  getHealth() {
    return request<HealthStatus>("/api/health");
  },
};
