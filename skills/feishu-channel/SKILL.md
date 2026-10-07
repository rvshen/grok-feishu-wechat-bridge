---
name: 飞书渠道
description: 用户要在 Grok Bot 里安装、配置、监听、回复飞书消息时使用。基于飞书官方长连接与 Webhook 唤醒。
---
# 飞书渠道

通过 MCP `grok-feishu-wechat-bridge` 连接飞书（Feishu / Lark）自建应用机器人。

## 核心通信机制
1. **入站**：插件后台运行 `monitor.js`，通过飞书官方 WebSocket 长连接实时监听机器人收到的单聊和群聊消息。
2. **唤醒**：收到消息后追加写入收件箱，并自动向 Grok Bot 的 Routine（Webhook URL）发送 POST 请求唤醒助手。
3. **出站**：Grok Bot 醒来后调用 `feishu_inbox` 取出消息，思考并生成回答，调用 `feishu_send` 或 `feishu_send_card` 发回飞书。

---

## 唤醒后的处理 SOP (必须严格执行)

当 Grok Bot 被 Routine「飞书入站唤醒」触发唤醒时：

1. **取出消息**：立即调用 `feishu_inbox` 获取收件箱中的全部待处理消息。
2. **检查消息**：
   - 如果 `messages` 为空，直接结束运行。
   - 对每条消息，提取 `text`、`chat_id`、`message_id`。
3. **生成回复并发送**：
   - 结合会话上下文和用户问题生成回答。
   - 调用 `feishu_send`：
     - `text`: 回复正文。
     - `chat_id`: 对应消息的 `chat_id`。
     - `message_id`: 对应消息的 `message_id`（进行引用回复）。
   - 如果包含代码块或格式化结构，推荐调用 `feishu_send_card` 发送漂亮的富文本卡片。

---

## 初次安装与引导配置流程

当用户说要安装、配置或接入飞书时：

1. **引导配置飞书应用凭证**：
   - 提示用户提供飞书开放平台自建应用的 **App ID** 和 **App Secret**。
   - 提醒用户在飞书开放平台「事件订阅」中开启 **长连接模式**，并添加事件：`im.message.receive_v1`（接收消息）。
   - 确保开通了机器人能力和相应权限（获取与发送消息）。

2. **创建唤醒 Routine**：
   - 引导用户在 Grok Bot 控制台创建一个触发器为 Webhook 的 Routine（如命名为「飞书入站唤醒」）。
   - 提示词设为：`请调用 feishu_inbox 取出飞书收到的新消息，思考后调用 feishu_send 进行回复。`
   - 让用户从该 Routine 面板复制 Webhook URL 与 Key。

3. **执行配置**：
   - 调用工具 `feishu_configure`，传入 `app_id`、`app_secret`、`wake_url`、`wake_key`。
   - 调用 `feishu_status` 确认长连接进程 `monitor_running` 为 true。
   - 告知用户：“飞书机器人已成功连通并处于监听状态！现在可以在飞书里向我发消息测试了。”
