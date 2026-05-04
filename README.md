# Copilot Compact

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-007ACC.svg)](https://code.visualstudio.com/)

Rewrite VS Code Copilot/OAI-compatible conversation compaction requests from `/responses` to `/responses/compact`.

将 VS Code Copilot 或 OAI 兼容服务的会话压缩请求从 `/responses` 改写到 `/responses/compact`。

`Copilot Compact` is a lightweight VS Code extension for users who route Copilot Chat or OAI-compatible providers through a Responses-compatible API gateway that supports the binary compact endpoint.

`Copilot Compact` 是一个轻量级 VS Code 扩展，适用于将 Copilot Chat 或 OAI 兼容服务接入到支持 Responses API 和二进制 compact 端点的网关用户。

## Why / 为什么

Some Copilot/OAI-compatible flows summarize long conversations by sending a normal request to:

某些 Copilot/OAI 兼容流程会通过普通端点总结长对话：

```text
/v1/responses
```

For providers that support the compact endpoint, the more efficient route is:

如果服务端支持 compact 端点，更高效的路径是：

```text
/v1/responses/compact
```

This extension detects Copilot's conversation-history compaction prompt and rewrites only that request. Normal chat requests continue to use `/responses`.

本扩展会识别 Copilot 的会话历史压缩提示词，并且只改写这类请求；普通聊天请求仍然走 `/responses`。

## Features / 功能

- Detects Copilot-style conversation compaction requests.
- Rewrites matched `POST /responses` requests to `POST /responses/compact`.
- Optionally resolves the matching compact channel from `/models`, for example `gpt-5.5-xhigh` -> request model `gpt-5.5` for backend channel `gpt-5.5-openai-compact`.
- Leaves normal chat, tool-use, and regular Responses API requests unchanged.
- Supports an optional host allow-list.
- Provides an optional debug output channel.
- Does not print request bodies or API keys in logs.

- 识别 Copilot 风格的会话压缩请求。
- 将匹配到的 `POST /responses` 改写为 `POST /responses/compact`。
- 可自动从 `/models` 解析匹配的 compact 通道，例如 `gpt-5.5-xhigh` -> 请求模型 `gpt-5.5`，对应后端通道 `gpt-5.5-openai-compact`。
- 普通聊天、工具调用和常规 Responses API 请求保持不变。
- 支持可选的目标域名白名单。
- 支持可选的调试输出通道。
- 日志不会打印请求体或 API Key。

## Confirmed compaction request pattern / 已确认的压缩请求特征

The extension identifies compaction requests using known Copilot/OAI-compatible request-body patterns:

扩展会根据已知的 Copilot/OAI 兼容请求体特征识别压缩请求：

- `instructions` contains text like:
- `instructions` 包含类似文本：
  - `create a comprehensive, detailed summary of the entire conversation`
- `input` contains text like:
- `input` 包含类似文本：
  - `Summarize the conversation history so far`
- the request usually has no `tools`
- 这类请求通常不包含 `tools`

When these signals are present, the URL is rewritten from:

当这些信号出现时，URL 会从：

```text
https://example.com/v1/responses
```

rewritten to:

改写为：

```text
https://example.com/v1/responses/compact
```

## Installation / 安装

### Option 1: Install from GitHub Release / 方式一：从 GitHub Release 安装

1. Open the [Releases](https://github.com/jiehu0/copilot-compact/releases) page.
2. Download the latest `.vsix` file.
3. Install it:

1. 打开 [Releases](https://github.com/jiehu0/copilot-compact/releases) 页面。
2. 下载最新的 `.vsix` 文件。
3. 安装扩展：

```bash
code --install-extension copilot-compact-v0.0.1.vsix
```

Then reload VS Code.

然后重载 VS Code。

### Option 2: Install from source / 方式二：从源码安装

Clone the repository and symlink it into your local VS Code extensions directory:

克隆仓库，并将它软链接到本地 VS Code 扩展目录：

```bash
git clone https://github.com/jiehu0/copilot-compact.git
cd copilot-compact
ln -s "$(pwd)" ~/.vscode/extensions/copilot-compact-0.0.1
```

Then reload VS Code.

然后重载 VS Code。

## Configuration / 配置

Open VS Code settings and search for `Copilot Compact`, or edit `settings.json`:

打开 VS Code 设置并搜索 `Copilot Compact`，或直接编辑 `settings.json`：

```json
{
  "copilotCompact.enabled": true,
  "copilotCompact.targetHosts": [],
  "copilotCompact.compactPathSuffix": "compact",
  "copilotCompact.responsesCompactModel": "",
  "copilotCompact.compactModelOverride": "",
  "copilotCompact.rewriteMode": "compactOnly",
  "copilotCompact.logLevel": "info"
}
```

| Setting / 配置项 | Default / 默认值 | Description / 说明 |
| --- | --- | --- |
| `copilotCompact.enabled` | `true` | Enable or disable request rewriting. / 启用或禁用请求改写。 |
| `copilotCompact.targetHosts` | `[]` | Optional host allow-list. Empty means all hosts. Example: `["newapi.example.com"]`. / 可选目标域名白名单；为空表示匹配所有域名。 |
| `copilotCompact.compactPathSuffix` | `"compact"` | Path segment appended after `/responses`. / 追加到 `/responses` 后的路径片段。 |
| `copilotCompact.responsesCompactModel` | `""` | Optional explicit model sent to `/responses/compact`, e.g. `gpt-5.5`. Keep it empty for generic per-model matching. Empty means auto-fetch `/models`, match a compact channel, and send the base model. / 可选的 compact 请求模型，例如 `gpt-5.5`；如果你会切换多个模型，建议保持为空以启用通用自动匹配。为空时自动请求 `/models`，匹配 compact 通道后发送基础模型。 |
| `copilotCompact.compactModelOverride` | `""` | Deprecated alias of `responsesCompactModel`. / `responsesCompactModel` 的兼容别名，后续不建议使用。 |
| `copilotCompact.rewriteMode` | `"compactOnly"` | `compactOnly` rewrites only detected compaction requests. `allResponses` rewrites every `POST /responses` request and should only be used for debugging. / `compactOnly` 只改写识别到的压缩请求；`allResponses` 会改写所有 `POST /responses` 请求，仅建议调试时使用。 |
| `copilotCompact.logLevel` | `"info"` | `off`, `info`, or `debug`. / 可选 `off`、`info` 或 `debug`。 |

## Rewrite rules / 请求改写规则

The extension only considers `POST .../responses` requests. A request is treated as a Copilot compaction request when it has no tools and its prompt/body contains summary + conversation-history signals such as `summary`, `summarization`, `compact`, `conversation history`, `transcript`, or `history`.

扩展只处理 `POST .../responses`。当请求不带 `tools`，并且提示词/请求体中同时出现总结和对话历史相关信号时，才认为它是 Copilot 压缩请求，例如 `summary`、`summarization`、`compact`、`conversation history`、`transcript`、`history`。

When matched:

命中后：

1. Endpoint: `/v1/responses` -> `/v1/responses/compact`
2. Body cleanup: keep only `model`, `input`, `instructions`, `previous_response_id`
3. Remove regular chat-only fields such as `stream`, `tools`, `tool_choice`, `prompt_cache_key`
4. Model normalization:
   - If `copilotCompact.responsesCompactModel` is set, use it directly. This is a fixed override and is not recommended when switching between model families.
   - Otherwise fetch `/models` with the original request auth.
   - Match compact channels like `gpt-5.5-openai-compact` or `gpt-5.4-openai-compact`.
   - Send the matched base model, for example `gpt-5.5` or `gpt-5.4`, to `/responses/compact`, because new-api appends `-openai-compact` internally.

1. Endpoint：`/v1/responses` -> `/v1/responses/compact`
2. 请求体清理：只保留 `model`、`input`、`instructions`、`previous_response_id`
3. 删除普通聊天字段：`stream`、`tools`、`tool_choice`、`prompt_cache_key`
4. 模型归一：
   - 如果设置了 `copilotCompact.responsesCompactModel`，直接使用该值。它是固定覆盖值；如果你会在多个模型之间切换，不建议设置。
   - 否则使用原请求认证信息请求 `/models`。
   - 匹配类似 `gpt-5.5-openai-compact` 或 `gpt-5.4-openai-compact` 的 compact 通道。
   - 发送匹配到的基础模型，例如 `gpt-5.5` 或 `gpt-5.4` 到 `/responses/compact`，因为 new-api 会在内部追加 `-openai-compact`。

## Usage / 使用

After installation, the extension activates automatically.

安装后扩展会自动激活。

To inspect rewrite activity:

查看请求改写情况：

1. Open the command palette.
2. Run `Copilot Compact: Show Output`.
3. Trigger Copilot/OAI-compatible conversation compaction.
4. Look for `Rewriting compact request`.

1. 打开命令面板。
2. 运行 `Copilot Compact: Show Output`。
3. 触发 Copilot/OAI 兼容的会话压缩。
4. 查找 `Rewriting compact request` 日志。

> Note: Some providers log the request URL before calling `fetch`, so their own logs may still show `/responses`. Use this extension's output, server access logs, or network capture to confirm the actual rewritten URL.
>
> 注意：某些 provider 会在调用 `fetch` 前记录请求 URL，因此它们自己的日志中可能仍显示 `/responses`。请以本扩展输出、服务端访问日志或网络抓包来确认实际改写后的 URL。

## Development / 开发

Requirements:

环境要求：

- VS Code
- Node.js 20 or newer / Node.js 20 或更新版本

Run tests:

运行测试：

```bash
npm test
```

Package locally:

本地打包：

```bash
npm run package
```

Debug in VS Code:

在 VS Code 中调试：

1. Open this repository in VS Code.
2. Press `F5` to launch an Extension Development Host.
3. Use a Copilot/OAI-compatible provider in the new window.
4. Check `Copilot Compact: Show Output`.

1. 在 VS Code 中打开本仓库。
2. 按 `F5` 启动 Extension Development Host。
3. 在新窗口中使用 Copilot/OAI 兼容 provider。
4. 查看 `Copilot Compact: Show Output`。

## Local deployment / 本地部署

For source-based local deployment, keep a symlink from this repository to the VS Code extensions directory:

源码方式本地部署时，请保持本仓库到 VS Code 扩展目录的软链接：

```bash
ln -s "$(pwd)" ~/.vscode/extensions/copilot-compact-0.0.1
```

If the link already exists, pull or edit this repository and reload VS Code to use the latest code.

如果软链接已经存在，更新本仓库后重载 VS Code 即可使用最新代码。

## Release / 发布

This repository includes a GitHub Actions workflow that packages the extension on version tags.

本仓库包含 GitHub Actions 工作流，会在推送版本标签时自动打包扩展。

Create a release:

创建发布：

```bash
git tag v0.0.1
git push origin v0.0.1
```

GitHub Actions will:

GitHub Actions 会：

1. run tests,
2. package the `.vsix`,
3. create a GitHub Release,
4. upload the `.vsix` as a release asset.

1. 运行测试；
2. 打包 `.vsix`；
3. 创建 GitHub Release；
4. 将 `.vsix` 上传为 Release 资产。

## Limitations / 限制

This extension patches `globalThis.fetch` inside the VS Code extension host. It works for extensions/providers that send requests through the extension host's JavaScript `fetch`.

本扩展会在 VS Code extension host 内部 patch `globalThis.fetch`。它适用于通过 extension host 的 JavaScript `fetch` 发起请求的扩展或 provider。

It cannot intercept requests sent from:

它无法拦截以下来源的请求：

- separate native binaries,
- separate Node.js processes,
- external proxies,
- providers that do not use the VS Code extension host `fetch`.

- 独立原生二进制程序；
- 独立 Node.js 进程；
- 外部代理；
- 不使用 VS Code extension host `fetch` 的 provider。

## License / 许可证

[MIT](LICENSE)
