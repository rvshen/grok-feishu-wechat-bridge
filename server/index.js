#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import readline from "node:readline";
import {
  loadConfig,
  saveConfig,
  paths,
  appendInbox,
  drainInbox,
  monitorRunning,
  clearPid,
} from "./store.js";
import { sendMessage, sendCard } from "./feishu.js";

const selfDir = path.dirname(fileURLToPath(import.meta.url));

function ok(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function fail(message) {
  return { content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }], isError: true };
}

function ensureMonitor() {
  const pid = monitorRunning();
  if (pid) return { running: true, pid };

  const monitorScript = path.join(selfDir, "monitor.js");
  const child = spawn(process.execPath, [monitorScript], {
    detached: true,
    stdio: "ignore",
    cwd: selfDir,
  });
  child.unref();

  return { started: true, pid: child.pid };
}

const tools = {
  feishu_configure: {
    description: "配置飞书应用凭证与 Grok Bot Webhook 唤醒参数。配置后会自动重启长连接监听。",
    inputSchema: {
      type: "object",
      properties: {
        app_id: { type: "string", description: "飞书自建应用的 App ID (cli_xxx)" },
        app_secret: { type: "string", description: "飞书自建应用的 App Secret" },
        wake_url: { type: "string", description: "Grok Bot Routine 提供的 Webhook URL" },
        wake_key: { type: "string", description: "Grok Bot Routine 提供的 Webhook Key / Token" },
      },
    },
    handle: async ({ app_id, app_secret, wake_url, wake_key }) => {
      const updated = saveConfig((c) => {
        if (app_id) c.appId = app_id;
        if (app_secret) c.appSecret = app_secret;
        if (wake_url) c.wakeUrl = wake_url;
        if (wake_key !== undefined) c.wakeKey = wake_key;
        return c;
      });

      // 如果有运行中的 monitor，重启它
      const oldPid = monitorRunning();
      if (oldPid) {
        try { process.kill(oldPid, "SIGTERM"); } catch { /* ignore */ }
        clearPid();
      }
      const monitorStatus = ensureMonitor();

      return ok({
        configured: true,
        app_id: updated.appId ? `${updated.appId.slice(0, 6)}...` : "",
        has_secret: Boolean(updated.appSecret),
        wake_url: updated.wakeUrl || "",
        monitor: monitorStatus,
      });
    },
  },

  feishu_status: {
    description: "查看飞书渠道状态、配置信息、长连接进程 PID 以及收件箱积压情况。",
    inputSchema: { type: "object", properties: {} },
    handle: async () => {
      const config = loadConfig();
      const pid = monitorRunning();
      const { inbox } = paths();
      let inboxCount = 0;
      if (fs.existsSync(inbox)) {
        const lines = fs.readFileSync(inbox, "utf-8").split("\n").filter((l) => l.trim().length > 0);
        inboxCount = lines.length;
      }
      return ok({
        app_id_configured: Boolean(config.appId),
        app_secret_configured: Boolean(config.appSecret),
        wake_configured: Boolean(config.wakeUrl),
        monitor_running: Boolean(pid),
        monitor_pid: pid || null,
        pending_inbox_messages: inboxCount,
        allow_users: config.allowUsers || [],
      });
    },
  },

  feishu_inbox: {
    description: "取出飞书收到的新消息列表（取出后收件箱自动排空）。每条消息包含 chat_id, message_id, text, sender_id 等。",
    inputSchema: { type: "object", properties: {} },
    handle: async () => {
      const messages = drainInbox();
      return ok({ messages, count: messages.length });
    },
  },

  feishu_send: {
    description: "向飞书发送纯文本消息或针对特定消息进行引用回复。",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "要回复或发送的文本内容" },
        chat_id: { type: "string", description: "飞书会话 ID (oc_xxx)" },
        message_id: { type: "string", description: "可选：被回复的消息 ID (om_xxx)，传入时使用引用回复" },
      },
      required: ["text"],
    },
    handle: async ({ text, chat_id, message_id }) => {
      const config = loadConfig();
      if (!config.appId || !config.appSecret) {
        throw new Error("尚未配置飞书 appId 与 appSecret，请先调用 feishu_configure");
      }
      if (!chat_id && !message_id) {
        throw new Error("必须提供 chat_id 或 message_id 之一");
      }
      const res = await sendMessage({
        appId: config.appId,
        appSecret: config.appSecret,
        receiveIdType: "chat_id",
        receiveId: chat_id,
        text,
        messageId: message_id,
      });
      return ok({ sent: true, data: res });
    },
  },

  feishu_send_card: {
    description: "向飞书发送富文本 Markdown 交互式卡片。",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "卡片标题" },
        markdown: { type: "string", description: "Markdown 正文" },
        chat_id: { type: "string", description: "飞书会话 ID (oc_xxx)" },
        message_id: { type: "string", description: "可选：被引用的消息 ID (om_xxx)" },
      },
      required: ["markdown"],
    },
    handle: async ({ title = "Grok Bot 回复", markdown, chat_id, message_id }) => {
      const config = loadConfig();
      if (!config.appId || !config.appSecret) {
        throw new Error("尚未配置飞书 appId 与 appSecret");
      }
      const card = {
        config: { wide_screen_mode: true },
        header: {
          title: { tag: "plain_text", content: title },
          template: "blue",
        },
        elements: [
          {
            tag: "div",
            text: { tag: "lark_md", content: markdown },
          },
        ],
      };
      const res = await sendCard({
        appId: config.appId,
        appSecret: config.appSecret,
        receiveIdType: "chat_id",
        receiveId: chat_id,
        card,
        messageId: message_id,
      });
      return ok({ sent: true, data: res });
    },
  },

  feishu_start_monitor: {
    description: "手动启动后台飞书 WebSocket 长连接监听进程。",
    inputSchema: { type: "object", properties: {} },
    handle: async () => ok(ensureMonitor()),
  },

  feishu_stop_monitor: {
    description: "停止后台飞书长连接监听进程。",
    inputSchema: { type: "object", properties: {} },
    handle: async () => {
      const pid = monitorRunning();
      if (!pid) return ok({ stopped: true, was_running: false });
      try { process.kill(pid, "SIGTERM"); } catch { /* ignore */ }
      clearPid();
      return ok({ stopped: true, pid });
    },
  },

  feishu_approve: {
    description: "配置用户白名单（Open ID）。不传参数或 clear=true 为清空白名单（允许所有人）。",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "允许访问的飞书用户 Open ID" },
        clear: { type: "boolean", description: "是否清空白名单" },
      },
    },
    handle: async ({ user_id, clear }) => {
      const updated = saveConfig((c) => {
        if (clear) {
          c.allowUsers = [];
        } else if (user_id && !c.allowUsers.includes(user_id)) {
          c.allowUsers.push(user_id);
        }
        return c;
      });
      return ok({ allow_users: updated.allowUsers });
    },
  },
};

const TOOL_LIST = Object.entries(tools).map(([name, t]) => ({
  name,
  description: t.description,
  inputSchema: t.inputSchema,
}));

async function dispatchTool(name, args) {
  const tool = tools[name];
  if (!tool) return fail(`未知工具: ${name}`);
  try {
    return await tool.handle(args || {});
  } catch (err) {
    return fail(err.message || String(err));
  }
}

async function handleRpc(msg) {
  const { id, method, params } = msg;

  if (method === "initialize") {
    ensureMonitor();
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "grok-feishu-wechat-bridge", version: "1.0.0" },
      },
    };
  }

  if (method === "notifications/initialized") {
    return null;
  }

  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOL_LIST } };
  }

  if (method === "tools/call") {
    const res = await dispatchTool(params?.name, params?.arguments);
    return { jsonrpc: "2.0", id, result: res };
  }

  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", async (line) => {
  if (!line.trim()) return;
  try {
    const parsed = JSON.parse(line);
    const resp = await handleRpc(parsed);
    if (resp) {
      process.stdout.write(JSON.stringify(resp) + "\n");
    }
  } catch (err) {
    process.stderr.write(`RPC 解析错误: ${err.message}\n`);
  }
});
