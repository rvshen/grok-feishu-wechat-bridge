import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Automatically load .env file if available (Node.js 20.6+)
try {
  if (typeof process.loadEnvFile === "function") {
    // Attempt to load from current working directory or server parent directory
    const envCandidate = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envCandidate)) {
      process.loadEnvFile(envCandidate);
    } else {
      process.loadEnvFile();
    }
  }
} catch {
  // Ignore if .env does not exist or fails to parse
}

export function homeDir() {
  const raw = process.env.GROK_BRIDGE_HOME?.trim() || process.env.GROK_FEISHU_HOME?.trim();
  if (raw) return path.resolve(raw);
  return path.join(os.homedir(), ".grok-bridge");
}

export function paths() {
  const home = homeDir();
  return {
    home,
    config: path.join(home, "config.json"),
    inbox: path.join(home, "inbox.jsonl"),
    pid: path.join(home, "monitor.pid"),
    log: path.join(home, "monitor.log"),
  };
}

export function ensureHome() {
  const { home } = paths();
  fs.mkdirSync(home, { recursive: true });
}

export function defaultConfig() {
  return {
    appId: process.env.FEISHU_APP_ID || "",
    appSecret: process.env.FEISHU_APP_SECRET || "",
    wakeUrl: process.env.GROK_WAKE_URL || "",
    wakeKey: process.env.GROK_WAKE_KEY || "",
    allowUsers: process.env.ALLOW_USERS
      ? process.env.ALLOW_USERS.split(",").map((u) => u.trim()).filter(Boolean)
      : [],
    dedicatedAssistant: null,
  };
}

export function loadConfig() {
  ensureHome();
  const { config: configPath } = paths();
  if (!fs.existsSync(configPath)) {
    return defaultConfig();
  }
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return { ...defaultConfig(), ...JSON.parse(raw) };
  } catch (err) {
    console.error("加载配置文件失败:", err);
    return defaultConfig();
  }
}

export function saveConfig(updates) {
  ensureHome();
  const current = loadConfig();
  const next = typeof updates === "function" ? updates(current) : { ...current, ...updates };
  const { config: configPath } = paths();
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2), { mode: 0o600 });
  return next;
}

export function appendInbox(message) {
  ensureHome();
  const { inbox } = paths();
  const line = JSON.stringify({ ...message, timestamp: Date.now() }) + "\n";
  fs.appendFileSync(inbox, line, "utf-8");
}

export function drainInbox() {
  ensureHome();
  const { inbox } = paths();
  if (!fs.existsSync(inbox)) return [];
  try {
    const content = fs.readFileSync(inbox, "utf-8");
    fs.writeFileSync(inbox, "", "utf-8");
    return content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (err) {
    console.error("清空收取收件箱失败:", err);
    return [];
  }
}

export function monitorRunning() {
  const { pid } = paths();
  if (!fs.existsSync(pid)) return 0;
  try {
    const p = parseInt(fs.readFileSync(pid, "utf-8").trim(), 10);
    if (!p) return 0;
    process.kill(p, 0);
    return p;
  } catch {
    clearPid();
    return 0;
  }
}

export function writePid(p) {
  ensureHome();
  const { pid } = paths();
  fs.writeFileSync(pid, String(p), "utf-8");
}

export function clearPid() {
  const { pid } = paths();
  try {
    if (fs.existsSync(pid)) fs.unlinkSync(pid);
  } catch { /* ignore */ }
}
