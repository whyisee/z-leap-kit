import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { config, quoteIdentifier } from "../config";
import type { LocationInput } from "../domain/location";

const schema = quoteIdentifier(config.DB_SCHEMA);
const base32 = "0123456789bcdefghjkmnpqrstuvwxyz";
const sensitiveLabelPattern = /家|住址|小区|宿舍|医院|诊所|寺|庙|教堂|清真寺|学校|幼儿园/;

export type SavedLocationObservation = {
  id: string;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  capturedAt: string;
  label: string | null;
  defaultEventRole: "occurred_at" | "recorded_at";
  socialMatching: boolean;
  sensitivity: "normal" | "sensitive" | "prohibited";
};

export function encodeGeohash(latitude: number, longitude: number, precision = 12): string {
  let latitudeRange: [number, number] = [-90, 90];
  let longitudeRange: [number, number] = [-180, 180];
  let evenBit = true;
  let bit = 0;
  let value = 0;
  let result = "";

  while (result.length < precision) {
    const range = evenBit ? longitudeRange : latitudeRange;
    const coordinate = evenBit ? longitude : latitude;
    const midpoint = (range[0] + range[1]) / 2;
    if (coordinate >= midpoint) {
      value = (value << 1) | 1;
      range[0] = midpoint;
    } else {
      value <<= 1;
      range[1] = midpoint;
    }
    evenBit = !evenBit;
    bit += 1;

    if (bit === 5) {
      result += base32[value];
      bit = 0;
      value = 0;
    }
  }

  return result;
}

export function classifyLocationSensitivity(label: string | null | undefined) {
  return label && sensitiveLabelPattern.test(label) ? ("sensitive" as const) : ("normal" as const);
}

export async function insertLocationObservation(
  client: PoolClient,
  input: {
    rawEntryId: string;
    ownerUserId: string;
    location: LocationInput;
  },
): Promise<SavedLocationObservation> {
  const id = randomUUID();
  const label = input.location.label?.trim() || null;
  const sensitivity = classifyLocationSensitivity(label);
  const socialMatching = input.location.socialMatching && sensitivity === "normal";
  const exactGeohash = encodeGeohash(input.location.latitude, input.location.longitude, 10);
  const socialCell = socialMatching
    ? encodeGeohash(input.location.latitude, input.location.longitude, 6)
    : null;

  await client.query(
    `
      INSERT INTO ${schema}.location_observations (
        id,
        raw_entry_id,
        owner_user_id,
        latitude,
        longitude,
        accuracy_m,
        altitude_m,
        altitude_accuracy_m,
        heading_deg,
        speed_mps,
        captured_at,
        source,
        user_label,
        default_event_role,
        exact_geohash,
        social_cell,
        sensitivity,
        match_eligible,
        technical_metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11::timestamptz, $12, $13, $14, $15, $16, $17, $18, $19::jsonb
      )
    `,
    [
      id,
      input.rawEntryId,
      input.ownerUserId,
      input.location.latitude,
      input.location.longitude,
      input.location.accuracyM ?? null,
      input.location.altitudeM ?? null,
      input.location.altitudeAccuracyM ?? null,
      input.location.headingDeg ?? null,
      input.location.speedMps ?? null,
      input.location.capturedAt,
      input.location.source,
      label,
      input.location.defaultEventRole,
      exactGeohash,
      socialCell,
      sensitivity,
      socialMatching,
      JSON.stringify({ userInitiated: true, socialCellPrecision: socialMatching ? 6 : null }),
    ],
  );

  return {
    id,
    latitude: input.location.latitude,
    longitude: input.location.longitude,
    accuracyM: input.location.accuracyM ?? null,
    capturedAt: input.location.capturedAt,
    label,
    defaultEventRole: input.location.defaultEventRole,
    socialMatching,
    sensitivity,
  };
}

export function parserLocationContext(location: LocationInput | undefined) {
  if (!location) return undefined;
  return {
    label: location.label?.trim() || undefined,
    role: location.defaultEventRole,
  };
}
