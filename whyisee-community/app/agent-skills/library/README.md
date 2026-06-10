# Agent Skill Library Storage

Uploaded Agent Skill packages are stored under this directory.

Directory layout:

```text
agent-skills/library/<skill-slug>/SKILL.md
agent-skills/library/<skill-slug>/references/*.md
agent-skills/library/<skill-slug>/examples/*.json
```

The database table `agent_skills` stores metadata, review status, and the `storage_path` for each package. Public academy listings only expose Skills with `status = 'published'`.
