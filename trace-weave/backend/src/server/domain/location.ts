import { z } from "zod";

export const locationRoleSchema = z.enum(["occurred_at", "recorded_at"]);

export const locationInputSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracyM: z.number().finite().min(0).max(100_000).nullable().optional(),
  altitudeM: z.number().finite().nullable().optional(),
  altitudeAccuracyM: z.number().finite().min(0).nullable().optional(),
  headingDeg: z.number().finite().min(0).max(360).nullable().optional(),
  speedMps: z.number().finite().min(0).nullable().optional(),
  capturedAt: z.string().datetime({ offset: true }),
  source: z
    .enum(["browser_geolocation", "manual_pin", "shared_place", "import"])
    .default("browser_geolocation"),
  label: z.string().trim().max(240).nullable().optional(),
  defaultEventRole: locationRoleSchema.default("occurred_at"),
  socialMatching: z.boolean().default(false),
});

export const confirmedLocationLinkSchema = z.object({
  observationId: z.string().uuid(),
  role: locationRoleSchema,
});

export type LocationInput = z.infer<typeof locationInputSchema>;
export type ConfirmedLocationLink = z.infer<typeof confirmedLocationLinkSchema>;
