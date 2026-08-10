import type { CandidateRecord } from "./api";

export function prepareCandidates(records: CandidateRecord[], createId: () => string = () => crypto.randomUUID()): CandidateRecord[] {
  return records.map((candidate) => ({ ...candidate, resolutionId: createId(), sourceCandidateIds: [candidate.id] }));
}

export function mergeCandidatePayloads(first: CandidateRecord["payload"], second: CandidateRecord["payload"]): CandidateRecord["payload"] {
  const starts = [first.time.start, second.time.start].filter((value): value is string => Boolean(value)).sort();
  const ends = [first.time.end, second.time.end].filter((value): value is string => Boolean(value)).sort();
  const participants = [...first.participants, ...second.participants].filter((item, index, all) => all.findIndex((other) =>
    other.mention === item.mention && other.role === item.role && other.isCurrentUser === item.isCurrentUser) === index);
  const entities = [...first.entities, ...second.entities].filter((item, index, all) => all.findIndex((other) =>
    other.mention === item.mention && other.entityType === item.entityType && other.role === item.role) === index);
  return {
    ...first,
    title: `${first.title}；${second.title}`,
    time: { ...first.time, start: starts[0] ?? null, end: ends.at(-1) ?? null,
      sourceExpression: [first.time.sourceExpression, second.time.sourceExpression].filter(Boolean).join("；") || null },
    participants, entities,
    subjectiveExperience: { ...first.subjectiveExperience, ...second.subjectiveExperience },
    extensions: { ...first.extensions, ...second.extensions, userMerged: true },
    confidence: Math.min(first.confidence, second.confidence),
  };
}
