// 全局配置
export const CONFIG = {
  // CORS 代理链（依次回退）
  proxies: [
    (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://cors-anywhere.herokuapp.com/${u}`,
  ],
  // 解析结果缓存 TTL（毫秒）
  cacheTTL: 30 * 60 * 1000,
  // 历史记录上限
  historyLimit: 50,
  // 请求超时
  timeout: 20000,
  // 平台展示名
  platformNames: {
    douyin: '抖音',
    kuaishou: '快手',
    weishi: '微视',
    weibo: '微博',
    xiaohongshu: '小红书',
    taobao: '淘宝',
    unknown: '未知平台',
  },
  platformIcons: {
    douyin: '🎵',
    kuaishou: '📹',
    weishi: '📺',
    weibo: '📢',
    xiaohongshu: '📕',
    taobao: '🛒',
    unknown: '🔗',
  },
};
