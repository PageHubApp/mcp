# PageHub MCP

Model Context Protocol server for building and managing PageHub templates. It talks to your local [pagehub.dev](https://github.com/gcphost/pagehub.dev) checkout (for `TemplateBuilder`, examples, and section templates) and optionally to the PageHub API.

## Requirements

- Node.js 18+
- A clone of the **pagehub.dev** app repo at the path you set below (must contain `scripts/TemplateBuilder.js`, `data/examples`, etc.)

## Install

```bash
git clone https://github.com/PageHubJS/mcp.git
cd mcp
npm install
```

## Configuration

Set the app root explicitly when this package is **not** sitting inside `pagehub.dev` (e.g. standalone clone of this repo):

```bash
export PAGEHUB_PROJECT_DIR=/absolute/path/to/pagehub.dev
```

Optional API auth (remote tools):

- `PAGEHUB_API_KEY` — tenant API key
- `PAGEHUB_API_BASE_URL` — default `https://pagehub.dev`

Local overrides can also live in `$PAGEHUB_PROJECT_DIR/.pagehub` (gitignored in the app repo).

## Run (Cursor / Claude Code)

Point the MCP server at this package’s entry file:

```json
{
  "mcpServers": {
    "pagehub-templates": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/index.js"],
      "env": {
        "PAGEHUB_PROJECT_DIR": "/absolute/path/to/pagehub.dev"
      }
    }
  }
}
```

Or use the bin after `npm link` / global install: `pagehub-mcp` (same env vars).

## Agent instructions

See [AGENT.md](./AGENT.md) for tool usage and design rules.

## Branches

- **`main`** — released, stable line for this repo.
- **`feat/*`** — feature work; open PRs into `main` when ready.

Align major template/API changes with the corresponding branch on **pagehub.dev** (e.g. `feat/sdk-pivot`) until both land.

## Monorepo note

In the full **pagehub.dev** workspace, this package lives at `packages/mcp`. `PAGEHUB_PROJECT_DIR` is optional there (auto-detected). The shim `scripts/mcp-server/index.js` keeps old MCP config paths working.

## Publishing this tree to GitHub (PageHubJS/mcp)

Do **not** run `git init` inside `packages/mcp` while it still lives under **pagehub.dev** (nested `.git` breaks the monorepo).

**Option A — subtree split (recommended):** from the **pagehub.dev** repo root:

```bash
git subtree split -P packages/mcp -b mcp-split
git push https://github.com/PageHubJS/mcp.git mcp-split:main
```

Adjust the remote branch name if **PageHubJS/mcp** already uses `main` with content you need to merge.

**Option B — fresh clone:** clone `PageHubJS/mcp`, copy the contents of `packages/mcp/` (excluding `node_modules`), commit, and push.

**Branches:** use **`main`** on **PageHubJS/mcp** for the published line; do feature work on **`feat/<topic>`** (e.g. `feat/api-tools`) and open PRs into `main`. Keep the app repo on a matching branch (e.g. **`feat/sdk-pivot`**) while template builder and MCP change together, then merge both when ready.
