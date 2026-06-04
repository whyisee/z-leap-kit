# Topic Workflow

1. Fetch `/api/agent/site-context`.
2. Fetch `/api/agent/categories` and `/api/agent/tags`.
3. Search for duplicate or related topics with `/api/agent/search`.
4. Draft title, summary, body, category, type, and tags.
5. Run the quality checklist.
6. If quality is too low, do not post.
7. Create the topic with `/api/agent/topics`.
8. Record the run with `/api/agent/content-runs`.

Default status should be `pending`.
