export async function triggerWake(wakeUrl, wakeKey, extra = {}) {
  if (!wakeUrl) {
    console.warn("[Wake] 未配置 wakeUrl，跳过唤醒");
    return { ok: false, error: "no_wake_url" };
  }

  const headers = {
    "Content-Type": "application/json",
  };
  if (wakeKey) {
    headers["Authorization"] = `Bearer ${wakeKey}`;
  }

  const payload = {
    source: extra.source || "feishu",
    event: "incoming_message",
    timestamp: Date.now(),
    ...extra,
  };

  try {
    const res = await fetch(wakeUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const status = res.status;
    const text = await res.text();
    console.log(`[Wake] 唤醒请求发送成功: HTTP ${status}, 返回: ${text.slice(0, 100)}`);
    return { ok: res.ok, status, text };
  } catch (err) {
    console.error("[Wake] 唤醒请求失败:", err);
    return { ok: false, error: err.message };
  }
}
