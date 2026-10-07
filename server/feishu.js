let cachedToken = "";
let tokenExpireTime = 0;

export async function getTenantAccessToken(appId, appSecret) {
  const now = Date.now();
  if (cachedToken && now < tokenExpireTime - 60000) {
    return cachedToken;
  }

  const res = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret,
    }),
  });

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`获取飞书 tenant_access_token 失败: [${data.code}] ${data.msg}`);
  }

  cachedToken = data.tenant_access_token;
  tokenExpireTime = now + data.expire * 1000;
  return cachedToken;
}

export async function sendMessage({ appId, appSecret, receiveIdType = "chat_id", receiveId, text, messageId }) {
  const token = await getTenantAccessToken(appId, appSecret);

  // 如果传了 messageId，优先使用“回复消息”接口
  if (messageId) {
    const res = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        msg_type: "text",
        content: JSON.stringify({ text }),
      }),
    });
    const data = await res.json();
    if (data.code !== 0) {
      throw new Error(`回复飞书消息失败: [${data.code}] ${data.msg}`);
    }
    return data.data;
  }

  // 否则使用主动发送消息接口
  const url = `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      receive_id: receiveId,
      msg_type: "text",
      content: JSON.stringify({ text }),
    }),
  });

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`发送飞书消息失败: [${data.code}] ${data.msg}`);
  }
  return data.data;
}

export async function sendCard({ appId, appSecret, receiveIdType = "chat_id", receiveId, card, messageId }) {
  const token = await getTenantAccessToken(appId, appSecret);

  if (messageId) {
    const res = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        msg_type: "interactive",
        content: typeof card === "string" ? card : JSON.stringify(card),
      }),
    });
    const data = await res.json();
    if (data.code !== 0) {
      throw new Error(`回复飞书卡片失败: [${data.code}] ${data.msg}`);
    }
    return data.data;
  }

  const url = `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      receive_id: receiveId,
      msg_type: "interactive",
      content: typeof card === "string" ? card : JSON.stringify(card),
    }),
  });

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`发送飞书卡片失败: [${data.code}] ${data.msg}`);
  }
  return data.data;
}
