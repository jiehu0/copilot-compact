# Copilot Compact

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-007ACC.svg)](https://code.visualstudio.com/)

Rewrite VS Code Copilot/OAI-compatible conversation compaction requests from `/responses` to `/responses/compact`.

`Copilot Compact` is a small VS Code extension for users who route Copilot Chat or OAI-compatible providers through a Responses-compatible API gateway that supports the binary compact endpoint.

## Why

Some Copilot/OAI-compatible flows summarize long conversations by sending a normal request to:

```text
/v1/responses
```

For providers that support the compact endpoint, the more efficient route is:

```text
/v1/responses/compact
```

This extension detects Copilot's conversation-history compaction prompt and rewrites only that request. Normal chat requests continue to use `/responses`.

## Features

- Detects Copilot-style conversation compaction requests.
- Rewrites matched `POST /responses` requests to `POST /responses/compact`.
- Leaves normal chat, tool-use, and regular Responses API requests unchanged.
- Optional host allow-list.
- Optional debug output channel.
- No request body or API key is printed in logs.

## Confirmed compaction request pattern

The extension identifies compaction requests using known Copilot/OAI-compatible request-body patterns:

- `instructions` contains text like:
  - `create a comprehensive, detailed summary of the entire conversation`
- `input` contains text like:
  - `Summarize the conversation history so far`
- the request usually has no `tools`

When these signals are present, the URL is rewritten from:

```text
https://example.com/v1/responses
```

to:

```text
https://example.com/v1/responses/compact
```

## Installation

### Option 1: Install from GitHub Release

1. Open the [Releases](https://github.com/jiehu0/copilot-compact/releases) page.
2. Download the latest `.vsix` file.
3. Install it:

```bash
code --install-extension copilot-compact-v0.0.1.vsix
```

Then reload VS Code.

### Option 2: Install from source

Clone the repository and symlink it into your local VS Code extensions directory:

```bash
git clone https://github.com/jiehu0/copilot-compact.git
cd copilot-compact
ln -s "$(pwd)" ~/.vscode/extensions/copilot-compact-0.0.1
```

Then reload VS Code.

## Configuration

Open VS Code settings and search for `Copilot Compact`, or edit `settings.json`:

```json
{
  "copilotCompact.enabled": true,
  "copilotCompact.targetHosts": [],
  "copilotCompact.rewriteMode": "compactOnly",
  "copilotCompact.logLevel": "info"
}
```

| Setting | Default | Description |
| --- | --- | --- |
| `copilotCompact.enabled` | `true` | Enable or disable request rewriting. |
| `copilotCompact.targetHosts` | `[]` | Optional host allow-list. Empty means all hosts. Example: `["newapi.example.com"]`. |
| `copilotCompact.compactPathSuffix` | `"compact"` | Path segment appended after `/responses`. |
| `copilotCompact.rewriteMode` | `"compactOnly"` | `compactOnly` rewrites only detected compaction requests. `allResponses` rewrites every `POST /responses` request and should only be used for debugging. |
| `copilotCompact.logLevel` | `"info"` | `off`, `info`, or `debug`. |

## Usage

After installation, the extension activates automatically.

To inspect rewrite activity:

1. Open the command palette.
2. Run `Copilot Compact: Show Output`.
3. Trigger Copilot/OAI-compatible conversation compaction.
4. Look for `Rewriting compact request`.

> Note: Some providers log the request URL before calling `fetch`, so their own logs may still show `/responses`. Use this extension's output, server access logs, or network capture to confirm the actual rewritten URL.

## Development

Requirements:

- VS Code
- Node.js 20 or newer

Run tests:

```bash
npm test
```

Package locally:

```bash
npm run package
```

Debug in VS Code:

1. Open this repository in VS Code.
2. Press `F5` to launch an Extension Development Host.
3. Use Copilot/OAI-compatible provider in the new window.
4. Check `Copilot Compact: Show Output`.

## Release

This repository includes a GitHub Actions workflow that packages the extension on version tags.

Create a release:

```bash
git tag v0.0.1
git push origin v0.0.1
```

GitHub Actions will:

1. run tests,
2. package the `.vsix`,
3. create a GitHub Release,
4. upload the `.vsix` as a release asset.

## Limitations

This extension patches `globalThis.fetch` inside the VS Code extension host. It works for extensions/providers that send requests through the extension host's JavaScript `fetch`.

It cannot intercept requests sent from:

- separate native binaries,
- separate Node.js processes,
- external proxies,
- providers that do not use the VS Code extension host `fetch`.

## License

[MIT](LICENSE)
