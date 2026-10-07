---
name: 微信渠道
description: 用户要在 Grok Bot 里安装、配置、监听、回复微信/企业微信消息时使用。基于微信网关与 Webhook 唤醒。
---
# 微信渠道

通过 MCP `grok-feishu-wechat-bridge` 连接微信（WeChat / 企业微信）消息服务。

## 核心通信机制
1. **入站**：通过微信开放接口/网关长轮询或回调接收单聊与群聊消息。
2. **唤醒**：接收到新消息后存入收件箱，自动触发 Grok Bot 的 Routine（Webhook URL）唤醒助手。
3. **出站**：Grok Bot 醒来后处理消息，调用回复接口将内容送达微信。

---

## 唤醒后的处理 SOP (必须严格执行)

当 Grok Bot 被微信入站消息 Routine 唤醒时：

1. **取出消息**：读取收件箱中的微信待处理消息。
2. **提取上下文**：获取用户标识（User ID / Open ID）、会话标识（Chat / Room ID）以及文本内容。
3. **生成回复并发送**：根据会话上下文生成回答，通过桥接通道推送回微信会话。

---

## 引导配置流程

1. **准备微信凭证**：
   - 准备企业微信或微信机器人应用凭证（Corp ID、Secret、Token、EncodingAESKey）。
2. **绑定 Grok Bot Routine**：
   - 在 Grok Bot 控制台创建触发器为 Webhook 的唤醒 Routine。
3. **完成桥接联动**：
   - 配置环境变量或通过桥接工具完成鉴权与地址绑定。
