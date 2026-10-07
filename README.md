# grok-feishu-wechat-bridge

<div align="center">

# 🌉 Grok Feishu & WeChat Bridge

**连接 xAI Grok 至飞书（Feishu / Lark）与微信（WeChat）的双通道智能桥接开源工具**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-Feishu%20%7C%20WeChat%20%7C%20xAI%20Grok-orange.svg)](#)
[![Architecture](https://img.shields.io/badge/Architecture-Dual--Channel%20WebSocket-blueviolet.svg)](#)

</div>

---

## 📖 项目定位

`grok-feishu-wechat-bridge` 是一款专为 **xAI Grok** 设计的高性能双通道智能桥接开源工具。通过飞书官方 WebSocket 长连接与微信（WeChat / 企业微信）通道，打通 xAI Grok 与国内两大主流办公协作及即时通讯生态，实现单聊、群聊智能实时交互与毫秒级主动唤醒。

无论是团队协作、智能答疑还是个人助手，本项目让您无需公网 IP 和复杂反向代理，即可在飞书与微信中与原汁原味的 Grok Bot 流畅对话。

---

## 🌟 核心特性

- ⚡ **双通道统一桥接 (Dual-Channel Architecture)**：同时支持飞书（Feishu / Lark）与微信（WeChat）消息路由与双向交互，构建统一的 IM 接入层。
- 🌐 **零公网 IP 要求 (NAT-Free / WebSocket)**：飞书通道基于官方 WebSocket 长连接模式，部署在任何内网、家庭网络、本地开发机或云端沙箱均可秒级连通，告别公网 IP、动态域名与内网穿透（frp / ngrok）。
- 🧠 **无需付费 xAI API Key (Native Grok Routine)**：作为原生 MCP 插件直接接入 Grok Bot 生态，利用 Grok 原生 Webhook Routine 机制毫秒级唤醒，复用 Grok Bot 强大的原生思考、联网与推理能力。
- 💬 **丰富的消息形态与引用交互**：支持纯文本、上下文引用回复（Reply）以及飞书 CardKit 富文本 Markdown 交互式卡片，代码与排版清晰优雅。
- 🔒 **严格的安全隔离与白名单**：内置 Open ID / User ID 白名单过滤机制，配置全部支持环境变量（`.env`）隔离解耦，杜绝凭证泄露。
- 🛠️ **极简配置与开箱即用**：支持在 Grok Bot 聊天框内自然语言一句话安装与配置，亦支持独立 Node.js / Docker 后台常驻服务。

---

## 🏗️ 架构原理

```text
┌──────────────────────┐         ┌──────────────────────┐
│  飞书 (Feishu/Lark)  │         │   微信 (WeChat/企微)  │
│  客户端 / 群聊 / 单聊 │         │   客户端 / 群聊 / 单聊 │
└──────────┬───────────┘         └──────────┬───────────┘
           │ (官方 WebSocket 长连接)        │ (网关/回调通道)
           ▼                                ▼
┌────────────────────────────────────────────────────────┐
│           grok-feishu-wechat-bridge (Server)           │
│  - 消息监听与分发 (Monitor)                              │
│  - 收件箱排队与幂等状态管理 (Store)                       │
│  - 安全凭证与白名单校验 (Security)                       │
└──────────────────────────┬─────────────────────────────┘
                           │ 触发 Routine (HTTP POST Webhook)
                           ▼
┌────────────────────────────────────────────────────────┐
│                      xAI Grok Bot                      │
│  - Webhook Routine 自动唤醒                            │
│  - 模型深度思考与上下文理解                              │
│  - 联网搜索 / 工具调用                                  │
└──────────────────────────┬─────────────────────────────┘
                           │ MCP 工具调用 (feishu_send / feishu_send_card)
                           ▼
                 回传飞书 / 微信会话 (完成闭环)
```

---

## 🚀 快速上手

### 方式一：在 Grok Bot 中一键安装（推荐）

直接在 Grok Bot 对话窗口中发送：

```text
安装这个插件 https://github.com/rvshen/grok-feishu-wechat-bridge
```

Grok Bot 会自动拉取插件并在面板中弹出连接器授权确认，点击确认即可加载 MCP 服务。

---

### 方式二：本地 / 服务器独立运行

```bash
# 1. 克隆仓库
git clone https://github.com/rvshen/grok-feishu-wechat-bridge.git
cd grok-feishu-wechat-bridge

# 2. 安装依赖
npm install

# 3. 复制并编辑环境变量
cp .env.example .env
# 编辑 .env 填入您的凭证信息

# 4. 启动服务
npm start
```

---

## 🛠️ 详细配置指南

### 1. 飞书（Feishu / Lark）自建应用配置

1. 登录 [飞书开放平台](https://open.feishu.cn/)，点击 **创建企业自建应用**。
2. 进入「添加应用能力」，选择并添加 **机器人**。
3. 进入「权限管理」，开通以下必要权限：
   - `im:message`（获取与发送单聊/群聊消息）
   - `im:message.p2p_msg:readonly`（获取单聊消息）
   - `im:message.group_at_msg:readonly`（获取群聊中 @ 机器人的消息）
   - `im:message:send_as_bot`（以机器人身份发送消息）
4. 进入「事件与回调」配置：
   - **订阅方式** 选择：**使用长连接模式（WebSocket）**（无需配置请求网址 URL）。
   - **添加事件**：搜索并添加 **接收消息（`im.message.receive_v1`）**。
5. 进入「版本管理与发布」，申请发布一个应用版本并通过审核。
6. 在「凭证与基础信息」中记录下你的 **App ID** 和 **App Secret**。

---

### 2. 微信（WeChat）通道配置说明

微信通道支持企业微信自建应用及第三方微信网关双通道接入：

1. **企业微信应用**：
   - 进入企业微信管理后台，创建自建应用获取 `CorpID` 与 `Secret`。
   - 配置回调参数 `Token` 与 `EncodingAESKey`。
2. **环境变量设置**：在 `.env` 中填写 `WECHAT_CORP_ID`、`WECHAT_CORP_SECRET` 等参数。
3. 桥接服务将自动统一路由收件箱与唤醒逻辑。

---

### 3. Grok Bot Routine Webhook 唤醒配置

1. 在 Grok Bot 对话界面中说：`帮我创建入站唤醒 Routine`（或手动在 Grok Bot Routine 面板创建）。
2. 将 Routine 的触发器设为 **Webhook**。
3. 触发提示词推荐设置为：
   ```text
   请调用 feishu_inbox 取出收到的新消息，思考后调用 feishu_send 或 feishu_send_card 进行针对性回复。
   ```
4. 创建完成后，复制该 Routine 的 **Webhook 地址（URL）** 和 **密钥（Key）**。
5. 向 Grok Bot 发送配置指令：
   ```text
   配置飞书渠道：
   App ID: cli_xxxxxx
   App Secret: xxxxxx
   Webhook URL: https://api.x.ai/v1/routines/webhook/xxxxxx
   Webhook Key: xxxxxx
   ```
6. 插件将自动启动后台 WebSocket 长连接并完成绑定。在飞书中向机器人发送一条消息，Grok Bot 即可实现毫秒级响应！

---

## 🔐 环境变量说明 (`.env`)

项目推荐通过环境变量进行凭证与路径配置：

| 变量名 | 说明 | 示例 / 默认值 |
|---|---|---|
| `FEISHU_APP_ID` | 飞书自建应用 App ID | `cli_a1b2c3d4e5f6` |
| `FEISHU_APP_SECRET` | 飞书自建应用 App Secret | `32位密钥字符串` |
| `WECHAT_CORP_ID` | 微信 / 企业微信 Corp ID（可选） | `ww_xxxxxxxx` |
| `WECHAT_CORP_SECRET` | 微信 / 企业微信 Secret（可选） | `xxxxxxxx` |
| `WECHAT_TOKEN` | 微信通道 Token（可选） | `xxxxxxxx` |
| `WECHAT_ENCODING_AES_KEY` | 微信通道 EncodingAESKey（可选） | `xxxxxxxx` |
| `GROK_WAKE_URL` | Grok Bot Routine Webhook URL | `https://api.x.ai/v1/routines/...` |
| `GROK_WAKE_KEY` | Grok Bot Routine 鉴权 Token | `your_secret_key` |
| `ALLOW_USERS` | 允许访问的用户白名单（逗号分隔） | `ou_xxx,ou_yyy`（留空允许所有人） |
| `GROK_BRIDGE_HOME` | 本地运行时与日志存储目录 | `~/.grok-bridge` |

---

## 🧰 MCP 工具参考

插件向 Grok Bot 注册了完整的 MCP 工具集：

- `feishu_configure`：配置飞书凭证与 Webhook 唤醒参数，自动重启监听。
- `feishu_status`：检查长连接健康状态、进程 PID 及收件箱积压情况。
- `feishu_inbox`：原子化提取待处理消息收件箱（提取后自动排空）。
- `feishu_send`：发送普通文本消息，支持通过 `message_id` 进行精准引用回复。
- `feishu_send_card`：发送结构化交互式 Markdown 富文本卡片。
- `feishu_start_monitor` / `feishu_stop_monitor`：手动启动或停止长连接后台守护进程。
- `feishu_approve`：管理用户 Open ID 白名单，增强企业级安全访问控制。

---

## 🗺️ 发展路线 (Roadmap)

- [x] 飞书官方 WebSocket 长连接实时收发
- [x] 飞书 Markdown CardKit 交互式富文本卡片
- [x] Grok Bot 原生 Webhook Routine 毫秒级唤醒机制
- [x] 环境变量解耦与安全防泄露设计
- [x] 微信（WeChat）/ 企业微信双通道桥接架构设计
- [ ] 微信渠道流式输出（Streaming）与多媒体（图片/语音）深度适配
- [ ] Docker 一键容器化编排部署包

---

## 🤝 贡献与反馈

欢迎提交 Issue 和 Pull Request！如果你有好的建议或发现了 Bug，请随时向我们反馈。

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feat/awesome-feature`)
3. 提交修改 (`git commit -m 'feat: add awesome feature'`)
4. 推送分支 (`git push origin feat/awesome-feature`)
5. 新建 Pull Request

---

## 📄 开源许可证

本项目基于 [MIT 许可证](LICENSE) 开源。
