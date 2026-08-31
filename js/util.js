/* 공통 유틸 */
(function (g) {
  'use strict';

  const U = {};

  // ---------- DOM ----------
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  U.el = function (tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'class') n.className = attrs[k];
        else if (k === 'html') n.innerHTML = attrs[k];
        else if (k === 'text') n.textContent = attrs[k];
        else if (k.startsWith('on') && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) n.setAttribute(k, attrs[k]);
      }
    }
    (Array.isArray(children) ? children : children ? [children] : []).forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return n;
  };

  U.esc = function (s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  // ---------- id / hash ----------
  U.uid = function (prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  };

  // 문자열 -> 안정적인 정수 해시 (코스 거리 추정값을 항상 동일하게 만들기 위해 사용)
  U.hash = function (str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h >>> 0);
  };

  // ---------- 단위 ----------
  // 내부 저장은 항상 미터. 표시할 때만 변환.
  U.M2Y = 1.09361;
  U.toDisplay = function (meters, unit) {
    if (meters === null || meters === undefined || meters === '') return null;
    return unit === 'y' ? Math.round(meters * U.M2Y) : Math.round(meters);
  };
  U.fromDisplay = function (val, unit) {
    const n = Number(val);
    if (!isFinite(n)) return null;
    return unit === 'y' ? Math.round(n / U.M2Y) : Math.round(n);
  };
  U.unitLabel = (unit) => (unit === 'y' ? 'yd' : 'm');

  // ---------- 날짜 ----------
  U.today = function () {
    const d = new Date();
    const p = (x) => String(x).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };
  U.fmtDate = function (iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${y}.${m}.${d}`;
  };
  U.fmtDateShort = function (iso) {
    if (!iso) return '';
    const [, m, d] = iso.split('-');
    return `${Number(m)}/${Number(d)}`;
  };

  // ---------- 숫자 ----------
  U.avg = function (arr) {
    const v = arr.filter((x) => typeof x === 'number' && isFinite(x));
    if (!v.length) return null;
    return v.reduce((a, b) => a + b, 0) / v.length;
  };
  U.round1 = (n) => (n === null || n === undefined ? null : Math.round(n * 10) / 10);
  U.round2 = (n) => (n === null || n === undefined ? null : Math.round(n * 100) / 100);
  U.pct = function (num, den) {
    if (!den) return null;
    return Math.round((num / den) * 1000) / 10;
  };
  U.sign = function (n) {
    if (n === null || n === undefined) return '-';
    if (n === 0) return 'E';
    return (n > 0 ? '+' : '') + n;
  };

  // ---------- 스코어 명칭 ----------
  U.scoreName = function (score, par) {
    if (!score || !par) return '';
    const d = score - par;
    if (score === 1) return '홀인원';
    if (d <= -3) return '알바트로스';
    if (d === -2) return '이글';
    if (d === -1) return '버디';
    if (d === 0) return '파';
    if (d === 1) return '보기';
    if (d === 2) return '더블보기';
    if (d === 3) return '트리플보기';
    return '+' + d;
  };
  U.scoreClass = function (score, par) {
    if (!score || !par) return '';
    const d = score - par;
    if (d <= -2) return 'sc-eagle';
    if (d === -1) return 'sc-birdie';
    if (d === 0) return 'sc-par';
    if (d === 1) return 'sc-bogey';
    return 'sc-double';
  };

  // ---------- 토스트 ----------
  let toastTimer = null;
  U.toast = function (msg, kind) {
    let box = U.$('#toast');
    if (!box) {
      box = U.el('div', { id: 'toast', class: 'toast' });
      document.body.appendChild(box);
    }
    box.textContent = msg;
    box.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { box.className = 'toast'; }, 2400);
  };

  // ---------- 확인 대화상자 ----------
  U.confirm = function (msg) {
    return window.confirm(msg);
  };

  // ---------- 다운로드 ----------
  U.download = function (filename, text) {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = U.el('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  };

  g.U = U;
})(window);
