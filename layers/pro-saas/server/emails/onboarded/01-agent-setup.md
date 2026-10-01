---
subject: "If you use a coding agent"
delayHours: 72
---

Hi {firstName},

This email is only for people who use a coding agent, such as Claude Code, Codex, or Cursor. If you do not, you can skip it.

Your agent can read the same indexing record you see in Request Indexing. Then you can ask it, in your own words: "Which of my pages are not indexed, and what reason does Google give?"

Request Indexing runs on gscdump, an open engine for Search Console data. Your agent reads gscdump with an API key from your Request Indexing account.

Agent setup takes one prompt:

1. Open the Developers page: {DEVELOPERS_URL}
2. Click Copy agent setup prompt.
3. Paste the prompt into your agent.

The first copy creates an API key named Agent setup. The agent installs the CLI and the skill. Then it summarises the stored URL Inspection verdicts for your pages.

If the page asks you to connect Search Console or a Site first, do that. Then copy the prompt.

Claude.ai and ChatGPT cannot run the prompt, because they have no terminal. For those, use the MCP tab on the same page.

To stop the agent later, revoke the Agent setup key on the Developers page.

If a step fails, reply with the error. I'll help you fix it.

Harlan
