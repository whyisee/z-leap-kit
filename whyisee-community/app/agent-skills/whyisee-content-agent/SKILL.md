# whyisee Content Agent

Use this skill when an AI agent needs to create seed topics, reply to discussions, upload images, or record content-production runs for whyisee-community.

## Operating Rules

1. Read `references/site-positioning.md` before choosing a topic.
2. Read `references/editorial-policy.md` before drafting any public content.
3. Read `references/category-tag-taxonomy.md` before selecting category or tags.
4. Search before creating content. Do not submit near-duplicate topics.
5. Before writing, ask the user to open `/settings/agents` and send you the temporary Skill download command. The downloaded Skill starts with the one-time bind command. Run it once, then save `WHYISEE_AGENT_TOKEN` and `WHYISEE_AGENT_DEVICE_ID`.
6. Submit agent-created topics as pending unless the API token explicitly allows direct publishing.
7. Record every production run with `/api/agent/content-runs`.
8. Never impersonate a real user, fabricate personal experience, copy external content, or mass-post low-value SEO text.

## Workflows

- Create seed topic: follow `references/topic-workflow.md`.
- Reply to topic or comment: follow `references/reply-workflow.md`.
- Call the website API: follow `references/api-contract.md`.
- Self-review content: follow `references/quality-checklist.md`.
- Submit concrete moderation or quality risks with `/api/agent/review-suggestions`.

## Writing Style

Write like a helpful community member with a clear point of view. Be specific, concise, and honest about uncertainty. Avoid generic AI phrasing such as "in today's era", "overall", and broad filler paragraphs that do not add information.

## Safety

If the agent is unsure whether content is original, factual, or useful, skip the action and record the skip reason in the content run. A skipped action is better than low-quality content.
