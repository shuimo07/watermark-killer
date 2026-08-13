// 水印斩 Web 版 · 主控制器（路由 / 解析 / 结果 / 历史 / 缓存）
import { CONFIG } from './config.js';
import { detect, platformName, platformIcon } from './lib/platform.js';
import { parse } from './adapters/index.js';
import { getHistory, addHistory, removeHistory, clearHistory } from './lib/history.js';
import { fetchBlob, saveBlob, makeFilename, extFromUrl } from './lib/download.js';
import { copyText, shareData } from './lib/share.js';
import { FAQ_CONTENT } from './views/faq.js';
import { COURSE_CONTENT } from './views/course.js';

/* ---------- 工具 ---------- */
const $ = (id) => document.getElementById(id);
let toastTimer = null;
function toast(msg, ms = 1800) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

const CACHE_KEY = 'wz_cache_v1';
function cacheGet(url) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const hit = all[url];
    if (hit && Date.now() - hit.ts < CONFIG.cacheTTL) return hit.result;
  } catch { /* ignore */ }
  return null;
}
function cacheSet(url, result) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    all[url] = { ts: Date.now(), result };
    const keys = Object.keys(all);
    if (keys.length > 100) {
      keys.sort((a, b) => all[a].ts - all[b].ts);
      keys.slice(0, keys.length - 100).forEach((k) => delete all[k]);
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

/* ---------- 状态 ---------- */
const state = {
  currentView: 'home',
  lastResult: null,
  lastParseKey: null,
};

/* ---------- 路由 ---------- */
function showView(name) {
  state.currentView = name;
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const el = $('view-' + name);
  if (el) el.classList.add('active');
  document.querySelectorAll('.tab-item').forEach((t) => {
    t.classList.toggle('active', t.dataset.view === name);
  });
  window.scrollTo(0, 0);
  if (name === 'history') renderHistory();
}

/* ---------- 首页 ---------- */
let lastDetect = { platform: 'unknown', url: null };

function onInput() {
  const text = $('share-input').value.trim();
  lastDetect = detect(text);
  const bar = $('detect-bar');
  if (text && lastDetect.url) {
    bar.innerHTML = `<span class="tag">${platformIcon(lastDetect.platform)} ${platformName(lastDetect.platform)}</span>已识别链接`;
    bar.classList.remove('hidden');
  } else if (text) {
    bar.innerHTML = `<span class="tag unknown">⚠️ 未识别到支持平台的链接</span>`;
    bar.classList.remove('hidden');
  } else {
    bar.classList.add('hidden');
  }
}

async function doParse(textOverride) {
  const text = (textOverride !== undefined ? textOverride : $('share-input').value).trim();
  if (!text) { toast('请先粘贴分享链接'); return; }
  const det = detect(text);
  if (!det.url) { toast('未识别到支持平台的链接'); return; }
  if (det.platform === 'unknown') { toast('暂不支持该平台'); return; }

  const status = $('home-status');
  status.className = 'status-area loading';
  status.textContent = `正在解析 ${platformName(det.platform)} 内容…`;

  const btn = $('parse-btn');
  btn.disabled = true;

  try {
    // 缓存命中检查
    let result = cacheGet(det.url);
    if (!result) {
      result = await parse(det.platform, text, det.url);
      cacheSet(det.url, result);
    }
    if (result.unsupported) {
      status.className = 'status-area';
      status.textContent = '';
      toast('该平台链接暂不支持解析');
      return;
    }
    state.lastResult = result;
    state.lastParseKey = det.url;
    // 写入历史
    addHistory({
      platform: det.platform,
      title: result.title || platformName(det.platform),
      url: det.url,
      text,
      type: result.type,
      mediaUrl: result.mediaUrl || '',
    });
    renderResult(result);
    showView('result');
    renderRecent();
  } catch (e) {
    status.className = 'status-area error';
    status.textContent = '解析失败：' + (e.message || '未知错误');
  } finally {
    btn.disabled = false;
  }
}

function renderRecent() {
  const list = $('recent-list');
  const items = getHistory().slice(0, 5);
  if (!items.length) {
    list.innerHTML = '<li class="empty-tip" style="border:none">暂无解析记录</li>';
    return;
  }
  list.innerHTML = items
    .map(
      (h) => `<li data-url="${escapeAttr(h.url)}" data-text="${escapeAttr(h.text)}">
        <span class="li-icon">${platformIcon(h.platform)}</span>
        <div class="li-main"><div class="li-title">${escapeHtml(h.title)}</div>
        <div class="li-sub">${platformName(h.platform)} · ${fmtTime(h.time)}</div></div>
        <span class="li-action">重新解析</span>
      </li>`
    )
    .join('');
  list.querySelectorAll('li').forEach((li) => {
    li.addEventListener('click', () => {
      const url = li.dataset.url;
      const text = li.dataset.text;
      // 找到对应历史项
      const item = getHistory().find((h) => h.url === url && h.text === text);
      if (item && item.mediaUrl && state.lastResult) {
        // 直接恢复上次结果展示
        showView('result');
        return;
      }
      $('share-input').value = text || url;
      onInput();
      doParse(text || url);
    });
  });
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s);
}
function fmtTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ---------- 结果页 ---------- */
function renderResult(r) {
  const body = $('result-body');
  $('result-platform').textContent = `${platformIcon(r.platform)} ${platformName(r.platform)}`;

  let mediaHtml = '';
  if (r.type === 'video' && r.mediaUrl) {
    mediaHtml = `
      <div class="video-wrap">
        <video controls playsinline ${r.cover ? `poster="${escapeAttr(r.cover)}"` : ''}
          src="${escapeAttr(r.mediaUrl)}" referrerpolicy="no-referrer"></video>
      </div>`;
  } else if (r.type === 'images' && r.images && r.images.length) {
    mediaHtml = `<div class="album-grid">${r.images
      .map((img, i) => `<img src="${escapeAttr(img)}" data-i="${i}" alt="图${i + 1}" loading="lazy" />`)
      .join('')}</div>`;
  } else if (r.unsupported) {
    mediaHtml = `<p class="empty-tip">该平台链接暂不支持解析（反爬限制）</p>`;
  } else {
    mediaHtml = `<p class="empty-tip">未获取到可预览内容</p>`;
  }

  let actions = '';
  if (r.type === 'video' && r.mediaUrl) {
    actions = `
      <div class="action-row">
        <button class="btn-action primary" id="act-download">⬇️ 下载视频</button>
        <button class="btn-action" id="act-copy">📋 复制链接</button>
        <button class="btn-action" id="act-share">↗️ 分享</button>
      </div>
      <div class="copy-box"><input readonly value="${escapeAttr(r.mediaUrl)}" /></div>`;
  } else if (r.type === 'images' && r.images && r.images.length) {
    actions = `
      <div class="action-row">
        <button class="btn-action primary" id="act-download">⬇️ 下载全部图片</button>
        <button class="btn-action" id="act-share">↗️ 分享</button>
      </div>`;
  } else if (r.unsupported) {
    actions = `
      <div class="action-row">
        <button class="btn-action" id="act-copy">📋 复制原链接</button>
      </div>`;
  }

  body.innerHTML = `
    <div class="result-title">${escapeHtml(r.title || '解析结果')}</div>
    ${mediaHtml}
    ${actions}`;

  // 图集点击放大
  if (r.type === 'images') {
    body.querySelectorAll('.album-grid img').forEach((img) => {
      img.addEventListener('click', () => showLightbox(r.images[Number(img.dataset.i)]));
    });
  }

  // 动作绑定
  const bind = (id, fn) => {
    const el = body.querySelector('#' + id);
    if (el) el.addEventListener('click', fn);
  };
  bind('act-download', () => downloadResult(r));
  bind('act-copy', () => {
    copyText(r.mediaUrl || r.images?.[0] || state.lastParseKey || '').then((ok) =>
      toast(ok ? '链接已复制' : '复制失败')
    );
  });
  bind('act-share', () => {
    shareData({
      title: r.title || '水印斩解析结果',
      text: `我用「水印斩」解析了${platformName(r.platform)}内容`,
      url: r.mediaUrl || r.images?.[0] || location.href,
    }).then((ok) => { if (!ok) toast('分享不可用'); });
  });
}

async function downloadResult(r) {
  if (r.type === 'video' && r.mediaUrl) {
    const btn = document.querySelector('#act-download');
    btn.disabled = true;
    btn.textContent = '下载中…';
    try {
      toast('正在获取视频（大文件可能较慢）', 3000);
      const blob = await fetchBlob(r.mediaUrl);
      saveBlob(blob, makeFilename(r.platform, extFromUrl(r.mediaUrl)));
      toast('下载已开始');
    } catch (e) {
      toast('下载失败：' + (e.message || '网络错误'));
      // 降级：新窗口打开
      window.open(r.mediaUrl, '_blank');
    } finally {
      btn.disabled = false;
      btn.textContent = '⬇️ 下载视频';
    }
  } else if (r.type === 'images' && r.images) {
    toast('开始下载图片…', 2000);
    for (let i = 0; i < r.images.length; i++) {
      try {
        const blob = await fetchBlob(r.images[i]);
        saveBlob(blob, makeFilename(r.platform, extFromUrl(r.images[i], 'jpg')));
      } catch {
        toast(`第 ${i + 1} 张下载失败`);
      }
    }
  }
}

function showLightbox(src) {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `<img src="${escapeAttr(src)}" alt="预览" />`;
  lb.addEventListener('click', () => lb.remove());
  document.body.appendChild(lb);
}

/* ---------- 历史页 ---------- */
function renderHistory() {
  const list = $('history-list');
  const empty = $('history-empty');
  const items = getHistory();
  if (!items.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = items
    .map(
      (h) => `<li data-id="${escapeAttr(h.id)}">
        <span class="li-icon">${platformIcon(h.platform)}</span>
        <div class="li-main"><div class="li-title">${escapeHtml(h.title)}</div>
        <div class="li-sub">${platformName(h.platform)} · ${fmtTime(h.time)}</div></div>
        <span class="li-action">查看</span>
      </li>`
    )
    .join('');
  list.querySelectorAll('li').forEach((li) => {
    li.addEventListener('click', () => {
      const item = getHistory().find((h) => h.id === li.dataset.id);
      if (!item) return;
      $('share-input').value = item.text || item.url;
      onInput();
      if (item.mediaUrl && state.lastResult && state.lastParseKey === item.url) {
        showView('result');
      } else {
        doParse(item.text || item.url);
      }
    });
  });
}

/* ---------- 静态页 ---------- */
function renderFaq() {
  $('faq-body').innerHTML = FAQ_CONTENT.map(
    (f) => `<div class="faq-item"><div class="faq-q">Q: ${escapeHtml(f.q)}</div><div class="faq-a">${escapeHtml(f.a)}</div></div>`
  ).join('');
}
function renderCourse() {
  $('course-body').innerHTML = COURSE_CONTENT.map(
    (c) => `<div class="course-step"><span class="step-num">${c.step}</span><div class="step-text">${c.text}</div></div>`
  ).join('');
}

/* ---------- 初始化 ---------- */
function init() {
  $('share-input').addEventListener('input', onInput);
  $('parse-btn').addEventListener('click', () => doParse());
  $('result-back').addEventListener('click', () => showView('home'));
  $('history-clear').addEventListener('click', () => {
    clearHistory();
    renderHistory();
    renderRecent();
    toast('已清空历史');
  });

  document.querySelectorAll('.tab-item').forEach((t) => {
    t.addEventListener('click', () => showView(t.dataset.view));
  });

  // 粘贴自动触发识别
  $('share-input').addEventListener('paste', () => setTimeout(onInput, 0));

  renderRecent();
  renderFaq();
  renderCourse();
  showView('home');
}

init();
