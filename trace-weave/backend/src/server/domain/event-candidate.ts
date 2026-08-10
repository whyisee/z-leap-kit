import { z } from "zod";
import { confirmedLocationLinkSchema, locationInputSchema } from "./location";

export const factualStatusSchema = z.enum([
  "occurred",
  "ongoing",
  "planned",
  "cancelled",
  "negated",
  "uncertain",
  "inferred",
]);

export const candidateEntitySchema = z.object({
  mention: z.string().trim().min(1).max(240),
  entityType: z.string().trim().min(1).max(60),
  role: z.string().trim().min(1).max(60),
  quantity: z.number().finite().optional(),
  unit: z.string().trim().max(40).optional(),
  amount: z.number().finite().optional(),
  currency: z.string().trim().length(3).optional(),
  confidence: z.number().min(0).max(1).optional(),
  attributes: z.record(z.string(), z.unknown()).default({}),
  resolvedUserEntityId: z.string().uuid().optional(),
});

export const candidateParticipantSchema = z.object({
  mention: z.string().trim().min(1).max(240),
  role: z.string().trim().min(1).max(60),
  isCurrentUser: z.boolean().default(false),
  confidence: z.number().min(0).max(1).optional(),
  resolvedUserEntityId: z.string().uuid().optional(),
});

export const candidateTimeSchema = z.object({
  start: z.string().datetime({ offset: true }).nullable().default(null),
  end: z.string().datetime({ offset: true }).nullable().default(null),
  timezone: z.string().trim().max(80).nullable().default(null),
  precision: z.string().trim().min(1).max(32).default("unknown"),
  sourceExpression: z.string().trim().max(240).nullable().default(null),
}).superRefine((value, context) => {
  if (value.start && value.end && new Date(value.end).getTime() < new Date(value.start).getTime()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["end"], message: "结束时间不能早于开始时间" });
  }
});

export const eventCandidatePayloadSchema = z.object({
  schemaVersion: z.literal("event-candidate/v1"),
  eventType: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(500),
  factualStatus: factualStatusSchema,
  time: candidateTimeSchema,
  participants: z.array(candidateParticipantSchema).default([]),
  entities: z.array(candidateEntitySchema).default([]),
  subjectiveExperience: z.record(z.string(), z.unknown()).default({}),
  extensions: z.record(z.string(), z.unknown()).default({}),
  confidence: z.number().min(0).max(1),
});

export type EventCandidatePayload = z.infer<typeof eventCandidatePayloadSchema>;

export const createEntrySchema = z.object({
  text: z.string().trim().min(1).max(20_000),
  clientTimezone: z.string().trim().min(1).max(80).default("Asia/Shanghai"),
  clientCreatedAt: z.string().datetime({ offset: true }).optional(),
  inputLocale: z.string().trim().min(2).max(35).default("zh-CN"),
  location: locationInputSchema.optional(),
});

const multipartLocationSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}, locationInputSchema.optional());

const multipartTextBlocksSchema = z.preprocess((value) => {
  if (!value) return [];
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}, z.array(z.string().trim().min(1).max(20_000)).max(20).default([]));

const multipartContentOrderSchema = z.preprocess((value) => {
  if (!value) return [];
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}, z.array(z.object({
  type: z.enum(["text", "media"]),
  index: z.number().int().min(0).max(100),
})).max(40).default([]));

export const createVoiceEntrySchema = z.object({
  transcript: z.string().trim().min(1).max(20_000),
  clientTimezone: z.string().trim().min(1).max(80).default("Asia/Shanghai"),
  clientCreatedAt: z.string().datetime({ offset: true }).optional(),
  inputLocale: z.string().trim().min(2).max(35).default("zh-CN"),
  transcriptProvider: z.string().trim().min(1).max(80).default("browser-web-speech"),
  durationMs: z.coerce.number().int().min(0).max(24 * 60 * 60 * 1000).optional(),
  location: multipartLocationSchema,
});

export const createMixedEntrySchema = z.object({
  text: z.string().trim().min(1).max(20_000),
  clientTimezone: z.string().trim().min(1).max(80).default("Asia/Shanghai"),
  clientCreatedAt: z.string().datetime({ offset: true }).optional(),
  inputLocale: z.string().trim().min(2).max(35).default("zh-CN"),
  transcriptProvider: z.string().trim().min(1).max(80).default("manual"),
  durationMs: z.coerce.number().int().min(0).max(24 * 60 * 60 * 1000).optional(),
  location: multipartLocationSchema,
  textBlocks: multipartTextBlocksSchema,
  contentOrder: multipartContentOrderSchema,
});

export const confirmEntrySchema = z.object({
  accepted: z
    .array(
      z.object({
        resolutionId: z.string().uuid(),
        sourceCandidateIds: z.array(z.string().uuid()).min(1).max(20).refine(
          (ids) => new Set(ids).size === ids.length,
          "同一个处理结果不能重复引用来源候选",
        ),
        payload: eventCandidatePayloadSchema,
        location: confirmedLocationLinkSchema.optional(),
      }),
    )
    .max(20),
  rejectedCandidateIds: z.array(z.string().uuid()).max(20).default([]),
}).superRefine((value, context) => {
  if (!value.accepted.length && !value.rejectedCandidateIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "至少接受或拒绝一个候选事件" });
  }
  if (new Set(value.accepted.map((item) => item.resolutionId)).size !== value.accepted.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["accepted"], message: "处理结果标识不能重复" });
  }
  if (new Set(value.rejectedCandidateIds).size !== value.rejectedCandidateIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["rejectedCandidateIds"], message: "拒绝列表不能重复" });
  }
  const rejected = new Set(value.rejectedCandidateIds);
  if (value.accepted.some((item) => item.sourceCandidateIds.some((id) => rejected.has(id)))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "同一来源候选不能同时接受和拒绝" });
  }
});
