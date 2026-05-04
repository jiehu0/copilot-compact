# Copilot Compact

这个 VSCode 扩展会在扩展宿主进程里 patch `globalThis.fetch`，把检测到的 Copilot/OAI-compatible 对话压缩请求从：

```text
/v1/responses
```

改写为：

```text
/v1/responses/compact
```

普通聊天请求仍然保持 `/responses`，只有符合“压缩/总结历史对话”特征的请求会被改写。

## 已确认的压缩请求特征

从本机 `~/.copilot/oaicopilot/logs/oaicopilot-20260504.log` 看到，Copilot 触发压缩时仍请求 `/v1/responses`，但 request body 有明显特征：

- `instructions` 类似：`Your task is to create a comprehensive, detailed summary of the entire conversation ...`
- `input` 中的用户文本包含：`Summarize the conversation history so far ...`
- 通常不带 `tools`

扩展就是用这些特征判断是否改写到 `/responses/compact`。

## 使用

在本目录运行：

```sh
npm test
```

开发调试：

1. 用 VSCode 打开本目录。
2. 按 `F5` 启动 Extension Development Host。
3. 在新窗口里使用 Copilot/OAI-compatible provider 触发 `/compact` 或上下文压缩。
4. 打开命令面板执行 `Copilot Compact: Show Output` 查看是否出现 `Rewriting compact request`。

注意：`johnny-zhao.oai-compatible-copilot` 自己的 `request.body` 日志是在调用 `fetch` 前打印的，所以那里可能仍显示 `/responses`；以本扩展 Output、服务端访问日志或抓包看到的实际 URL 为准。

安装到当前 VSCode（任选一种）：

```sh
# 方式 1：直接把本目录作为本地扩展软链进去，然后重载 VSCode
ln -s "$(pwd)" ~/.vscode/extensions/copilot-compact-0.0.1
```

也可以用 `vsce package` 打包成 `.vsix` 后再执行：

```sh
code --install-extension copilot-compact-0.0.1.vsix
```

## 配置

- `copilotCompact.enabled`: 总开关，默认 `true`
- `copilotCompact.targetHosts`: 可选 host 白名单，默认空数组表示所有 host
- `copilotCompact.rewriteMode`: 默认 `compactOnly`；调试时可切到 `allResponses`
- `copilotCompact.logLevel`: `off` / `info` / `debug`

## 注意

这个方案依赖 VSCode 扩展宿主中的全局 `fetch`。它适用于像 `johnny-zhao.oai-compatible-copilot` 这种直接调用 `fetch(url, init)` 的 provider；如果某个扩展在独立进程/原生二进制里发请求，VSCode 扩展无法通过这种方式拦截。
