import fs from "node:fs";
import { execSync } from "node:child_process";
import { loadConfig, paths, appendInbox, writePid, clearPid } from "./store.js";
import { triggerWake } from "./wake.js";

const { log: logPath } = paths();

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(logPath, line, "utf-8");
  } catch { /* ignore */ }
  console.log(line.trim());
}

async function ensureDependencies() {
  try {
    await import("@larksuiteoapi/node-sdk");
  } catch (err) {
    log("未检测到 @larksuiteoapi/node-sdk，正在自动安装依赖...");
    try {
      execSync("npm install --production", { cwd: new URL(".", import.meta.url).pathname });
      log("依赖安装成功！");
    } catch (e) {
      log(`自动安装依赖失败: ${e.message}`);
      throw e;
    }
  }
}

async function start() {
  writePid(process.pid);
  log(`Feishu Monitor 启动，PID: ${process.pid}`);

  const config = loadConfig();
  if (!config.appId || !config.appSecret) {
    log("错误: 未配置飞书 appId 或 appSecret，监听退出");
    clearPid();
    process.exit(1);
  }

  await ensureDependencies();
  const lark = await import("@larksuiteoapi/node-sdk");

  const wsClient = new lark.WSClient({
    appId: config.appId,
    appSecret: config.appSecret,
    loggerLevel: lark.LoggerLevel.info,
  });

  const eventDispatcher = new lark.EventDispatcher({}).register({
    "im.message.receive_v1": async (data) => {
      try {
        const { message, sender } = data;
        if (!message) return;

        // 避免自身机器人死循环
        if (sender?.sender_type === "app") {
          return;
        }

        const senderId = sender?.sender_id?.open_id || sender?.sender_id?.user_id || "";
        const latestConfig = loadConfig();

        // 白名单检查
        if (
          Array.isArray(latestConfig.allowUsers) &&
          latestConfig.allowUsers.length > 0 &&
          !latestConfig.allowUsers.includes(senderId)
        ) {
          log(`用户 ${senderId} 不在 allowUsers 白名单中，已忽略消息`);
          return;
        }

        let textContent = "";
        try {
          const parsed = JSON.parse(message.content);
          textContent = parsed.text || "";
        } catch {
          textContent = message.content || "";
        }

        const inbound = {
          message_id: message.message_id,
          chat_id: message.chat_id,
          chat_type: message.chat_type,
          msg_type: message.message_type,
          sender_id: senderId,
          text: textContent,
          create_time: message.create_time,
        };

        log(`收到飞书消息: [${inbound.chat_type}] 来自 ${senderId}: ${textContent.slice(0, 50)}`);

        // 存入待处理收件箱
        appendInbox(inbound);

        // 唤醒 Grok Bot
        if (latestConfig.wakeUrl) {
          await triggerWake(latestConfig.wakeUrl, latestConfig.wakeKey, {
            message_id: inbound.message_id,
            chat_id: inbound.chat_id,
            text: inbound.text,
          });
        } else {
          log("未设置 wakeUrl，已存入收件箱但未唤醒 Grok Bot");
        }
      } catch (err) {
        log(`处理飞书消息事件异常: ${err.message}`);
      }
    },
  });

  process.on("SIGINT", () => {
    log("收到 SIGINT，停止监听");
    clearPid();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    log("收到 SIGTERM，停止监听");
    clearPid();
    process.exit(0);
  });

  try {
    await wsClient.start({ eventDispatcher });
    log("飞书 WebSocket 长连接已成功建立！正在监听消息...");
  } catch (err) {
    log(`飞书 WebSocket 长连接建立失败: ${err.message}`);
    clearPid();
    process.exit(1);
  }
}

start().catch((err) => {
  log(`Monitor 致命错误: ${err.message}`);
  clearPid();
  process.exit(1);
});
