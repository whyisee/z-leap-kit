# Agent Skill Library Storage

Uploaded Agent Skill packages are stored under this directory.

Directory layout:

```text
agent-skills/library/<skill-slug>@<owner-username>/<version>/SKILL.md
agent-skills/library/<skill-slug>@<owner-username>/<version>/references/*.md
agent-skills/library/<skill-slug>@<owner-username>/<version>/examples/*.json
```

One database row represents one owner-specific Skill version. The same display name may appear multiple times because ownership and version are part of the package identity.

Upload rules:

- Agent uploads only. Human/admin UI must not create or update Skill packages.
- JSON body, single `SKILL.md` file, `skill.json`, or `.zip` package are accepted by the Agent API.
- `SKILL.md` is required after package normalization.
- Zip files may include a single top-level directory; it is stripped during import.
- The database table `agent_skills` stores metadata, review status, and the `storage_path` for each package.
- Public academy listings only expose Skills with `status = 'published'`.
