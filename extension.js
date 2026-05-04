"use strict";

const vscode = require("vscode");
const {
  installFetchPatch,
  uninstallFetchPatch,
} = require("./src/fetchPatch");

/** @type {vscode.OutputChannel | undefined} */
let output;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  output = vscode.window.createOutputChannel("Copilot Compact");

  const logger = {
    info: (message, ...args) => log("info", message, ...args),
    debug: (message, ...args) => log("debug", message, ...args),
    warn: (message, ...args) => log("info", message, ...args),
  };

  installFetchPatch({
    logger,
    getConfig: readConfig,
  });

  context.subscriptions.push(
    output,
    vscode.commands.registerCommand("copilotCompact.showOutput", () => output?.show(true)),
    vscode.commands.registerCommand("copilotCompact.enable", async () => {
      await vscode.workspace
        .getConfiguration("copilotCompact")
        .update("enabled", true, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage("Copilot Compact enabled.");
    }),
    vscode.commands.registerCommand("copilotCompact.disable", async () => {
      await vscode.workspace
        .getConfiguration("copilotCompact")
        .update("enabled", false, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage("Copilot Compact disabled.");
    })
  );

  log("info", "Activated. Fetch patch is installed.");
}

function deactivate() {
  uninstallFetchPatch();
}

function readConfig() {
  const cfg = vscode.workspace.getConfiguration("copilotCompact");
  return {
    enabled: cfg.get("enabled", true),
    targetHosts: cfg.get("targetHosts", []),
    compactPathSuffix: cfg.get("compactPathSuffix", "compact"),
    rewriteMode: cfg.get("rewriteMode", "compactOnly"),
    logLevel: cfg.get("logLevel", "info"),
  };
}

function log(level, message, ...args) {
  const cfgLevel = readConfig().logLevel;
  if (cfgLevel === "off") {
    return;
  }
  if (level === "debug" && cfgLevel !== "debug") {
    return;
  }
  const suffix = args.length ? ` ${args.map(formatLogArg).join(" ")}` : "";
  output?.appendLine(`[${new Date().toISOString()}] ${message}${suffix}`);
}

function formatLogArg(value) {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

module.exports = {
  activate,
  deactivate,
};
