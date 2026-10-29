const ADMIN_PASSWORD = 'Sapozhka';
const ADMIN_SNAP = 8;

function layoutKey(courseId, groupId) {
  return `georgii-course-layout:${courseId}:${groupId}`;
}

function readCourseLayout(courseId, groupId) {
  try {
    const data = JSON.parse(localStorage.getItem(layoutKey(courseId, groupId)) || '{"images":[]}');
    return Array.isArray(data.images) ? data.images.filter((item) => item && (item.src || item.vimeo)) : [];
  } catch (_) {
    return [];
  }
}

function extendPageForImages(items) {
  const bottom = items.reduce((max, item) => Math.max(max, (Number(item.y) || 0) + (Number(item.h) || 0)), 0);
  if (bottom > 0) document.body.style.minHeight = `${Math.ceil(bottom + 24)}px`;
}

function parseVimeoLink(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const source = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(source);
    const host = url.hostname.replace(/^www\./, '');
    let id = '';
    let hash = '';
    if (host === 'vimeo.com') {
      const parts = url.pathname.split('/').filter(Boolean);
      const idAt = parts.findIndex((part) => /^\d{6,}$/.test(part));
      if (idAt < 0) return null;
      id = parts[idAt];
      const tail = parts[idAt + 1];
      if (tail && /^[A-Za-z0-9]+$/.test(tail)) hash = tail;
    } else if (host === 'player.vimeo.com') {
      const match = url.pathname.match(/\/video\/(\d+)/);
      if (!match) return null;
      id = match[1];
      hash = url.searchParams.get('h') || '';
    } else {
      return null;
    }
    return { id, hash, src: text };
  } catch (_) {
    return null;
  }
}

function vimeoEmbedSrc(video) {
  const params = new URLSearchParams({
    autoplay: '1',
    loop: '1',
    muted: '1',
    title: '0',
    byline: '0',
    portrait: '0',
    autopause: '0',
    controls: '0',
    background: '0',
    transparent: '1',
    dnt: '1',
    badge: '0',
    playsinline: '1',
    quality: 'auto'
  });
  if (video.hash) params.set('h', video.hash);
  return `https://player.vimeo.com/video/${video.id}?${params}`;
}

function courseColumns(width) {
  const inset = 8;
  const gap = 24;
  const cols = width >= 768 ? 12 : width >= 640 ? 6 : 4;
  const colW = (width - inset * 2 - gap * (cols - 1)) / cols;
  return { inset, gap, cols, colW, width };
}

function coversTwelveColumns(item, grid) {
  if (!grid || grid.cols !== 12) return false;
  const right = grid.width - grid.inset;
  return Math.abs(item.x - grid.inset) <= 1.5 && Math.abs((item.x + item.w) - right) <= 1.5;
}

const VOLUME_OFF = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
const VOLUME_ON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';

const wideItems = [];

function syncWide(item) {
  if (!item.setWide) return;
  item.setWide(coversTwelveColumns(item, courseColumns(document.documentElement.clientWidth)));
}

function rememberWide(item) {
  if (!item.setWide || wideItems.includes(item)) return;
  wideItems.push(item);
  syncWide(item);
}

window.addEventListener('resize', () => wideItems.forEach(syncWide));

function mountCourseVisual(box, data) {
  const parsed = data.vimeo
    ? { id: String(data.vimeo), hash: data.hash || '' }
    : parseVimeoLink(data.src);
  if (!parsed) {
    const img = document.createElement('img');
    img.src = data.src;
    img.alt = '';
    img.draggable = false;
    box.appendChild(img);
    return { setWide() {}, destroy() {} };
  }

  box.dataset.vimeoId = parsed.id;
  const iframe = document.createElement('iframe');
  iframe.src = vimeoEmbedSrc(parsed);
  iframe.setAttribute('allow', 'autoplay; fullscreen');
  iframe.setAttribute('frameborder', '0');
  iframe.title = '';
  const chrome = document.createElement('div');
  chrome.className = 'course-video-chrome';
  const seek = document.createElement('div');
  seek.className = 'course-video-seek';
  seek.setAttribute('aria-label', 'time');
  const fill = document.createElement('span');
  seek.appendChild(fill);
  const volume = document.createElement('button');
  volume.type = 'button';
  volume.className = 'course-video-volume';
  volume.setAttribute('aria-label', 'sound');
  volume.innerHTML = VOLUME_OFF;
  chrome.append(seek, volume);
  box.append(iframe, chrome);

  let player = null;
  let duration = 0;
  let muted = true;
  let scrubbing = false;

  seek.addEventListener('pointerdown', (event) => {
    if (!box.classList.contains('is-wide') || !player || !duration) return;
    event.stopPropagation();
    event.preventDefault();
    scrubbing = true;
    seek.setPointerCapture(event.pointerId);
    const place = (ev) => {
      const rect = seek.getBoundingClientRect();
      const ratio = rect.width ? Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width)) : 0;
      fill.style.width = `${ratio * 100}%`;
      player.setCurrentTime(ratio * duration).catch(() => {});
    };
    const end = () => {
      scrubbing = false;
      seek.removeEventListener('pointermove', place);
      seek.removeEventListener('pointerup', end);
    };
    place(event);
    seek.addEventListener('pointermove', place);
    seek.addEventListener('pointerup', end);
  });
  volume.addEventListener('pointerdown', (event) => {
    if (!box.classList.contains('is-wide')) return;
    event.stopPropagation();
  });
  volume.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!player || !box.classList.contains('is-wide')) return;
    muted = !muted;
    volume.innerHTML = muted ? VOLUME_OFF : VOLUME_ON;
    if (muted) {
      player.setVolume(0).catch(() => {});
      player.setMuted(true).catch(() => {});
    } else {
      player.setMuted(false).then(() => player.setVolume(1)).catch(() => {});
    }
  });

  iframe.addEventListener('load', () => {
    if (!window.Vimeo || !window.Vimeo.Player) return;
    player = new window.Vimeo.Player(iframe);
    player.setMuted(true).catch(() => {});
    player.setVolume(0).catch(() => {});
    player.on('timeupdate', (update) => {
      if (scrubbing || !update.duration) return;
      duration = update.duration;
      fill.style.width = `${(update.percent || 0) * 100}%`;
    });
    player.on('volumechange', (update) => {
      muted = !update.volume;
      volume.innerHTML = muted ? VOLUME_OFF : VOLUME_ON;
    });
  });

  return {
    vimeo: parsed.id,
    hash: parsed.hash || '',
    setWide(on) {
      const wide = Boolean(on);
      box.classList.toggle('is-wide', wide);
      if (!wide && player && !muted) {
        muted = true;
        volume.innerHTML = VOLUME_OFF;
        player.setVolume(0).catch(() => {});
        player.setMuted(true).catch(() => {});
      }
    },
    destroy() {
      if (player) player.destroy().catch(() => {});
    }
  };
}

async function vimeoRatio(video) {
  const page = `https://vimeo.com/${video.id}${video.hash ? `/${video.hash}` : ''}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(page)}`, {
      signal: controller.signal
    });
    if (!response.ok) return 9 / 16;
    const data = await response.json();
    if (data.width && data.height) return data.height / data.width;
  } catch (_) {
    return 9 / 16;
  } finally {
    clearTimeout(timer);
  }
  return 9 / 16;
}

function descriptionText(el) {
  if (!el) return '';
  return (el.innerText || '').replace(/\u00a0/g, ' ').replace(/\n+$/g, '');
}

let publishedCopy = {};

async function loadPublishedCopy() {
  try {
    const response = await fetch('js/course-copy.json', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    if (data && typeof data === 'object') publishedCopy = data;
  } catch (_) {}
}

function resolveCourseDescription(session) {
  try {
    const raw = localStorage.getItem(layoutKey(session.courseId, session.groupId));
    if (raw != null) {
      const data = JSON.parse(raw);
      if (data && typeof data.description === 'string') return data.description;
    }
  } catch (_) {}
  const shared = publishedCopy[session.courseId];
  if (shared && typeof shared[session.groupId] === 'string') return shared[session.groupId];
  return session.descriptionFallback || '';
}

function applyCourseDescription(session, editing) {
  const nameCol = document.querySelector('.course-name-col');
  if (!session || !nameCol) return;
  const text = resolveCourseDescription(session);
  let el = document.getElementById('course-description');
  if (!editing && !text) {
    if (el) el.remove();
    return;
  }
  if (editing && el && document.activeElement === el) return;
  if (!el) {
    el = document.createElement('p');
    el.id = 'course-description';
    el.className = 'course-description';
    nameCol.appendChild(el);
  }
  if (descriptionText(el) !== text) el.textContent = text;
  el.contentEditable = editing ? 'plaintext-only' : 'false';
  el.spellcheck = false;
  el.classList.toggle('is-editing', Boolean(editing));
  el.classList.toggle('is-empty', Boolean(editing) && text === '');
  if (editing && !el.dataset.bound) {
    el.dataset.bound = '1';
    el.addEventListener('input', () => {
      el.classList.toggle('is-empty', descriptionText(el) === '');
    });
  }
}

function finishCourseDescription() {
  const el = document.getElementById('course-description');
  if (!el) return;
  const text = descriptionText(el);
  el.textContent = text;
  el.contentEditable = 'false';
  el.classList.remove('is-editing', 'is-empty');
  if (!text) el.remove();
}

function publishCourseDescription(session, description) {
  fetch('api/course-description', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      courseId: session.courseId,
      groupId: session.groupId,
      description
    })
  }).then((response) => {
    if (!response.ok) return;
    const course = Object.assign({}, publishedCopy[session.courseId]);
    course[session.groupId] = description;
    publishedCopy[session.courseId] = course;
  }).catch(() => {});
}

function showMobileCourseLayout(session) {
  if (!session) return;
  applyCourseDescription(session, false);
  if (document.getElementById('course-mobile-grid')) return;
  const stored = readCourseLayout(session.courseId, session.groupId);
  if (!stored.length) return;
  const works = document.getElementById('course-works');
  if (!works) return;
  const items = stored.slice().sort((a, b) => {
    const dy = (Number(a.y) || 0) - (Number(b.y) || 0);
    if (Math.abs(dy) > 8) return dy;
    return (Number(a.x) || 0) - (Number(b.x) || 0);
  });
  const grid = document.createElement('div');
  grid.id = 'course-mobile-grid';
  items.forEach((data) => {
    const cell = document.createElement('div');
    const box = document.createElement('div');
    box.className = 'course-layout-image';
    const visual = mountCourseVisual(box, data);
    if (visual.vimeo) visual.setWide(true);
    cell.appendChild(box);
    grid.appendChild(cell);
  });
  works.hidden = false;
  works.appendChild(grid);

  const fit = () => {
    if (window.innerWidth >= 640) return;
    const main = document.getElementById('course-root');
    const above = works.previousElementSibling;
    if (!main || !above) return;
    const top = above.getBoundingClientRect().bottom - main.getBoundingClientRect().top + 48;
    works.style.top = `${Math.round(top)}px`;
    const bottom = works.getBoundingClientRect().bottom + window.scrollY;
    document.body.style.minHeight = `${Math.ceil(bottom + 24)}px`;
  };
  requestAnimationFrame(fit);
  grid.querySelectorAll('img').forEach((img) => {
    if (!img.complete) img.addEventListener('load', fit);
  });
  window.addEventListener('resize', fit);
}

function showSavedCourseLayout(session) {
  if (window.innerWidth < 640) {
    showMobileCourseLayout(session);
    return;
  }
  if (!session || document.getElementById('admin-layer')) return;
  applyCourseDescription(session, false);
  if (document.getElementById('course-layout')) return;
  const stored = readCourseLayout(session.courseId, session.groupId);
  if (!stored.length) return;
  const layer = document.createElement('div');
  layer.id = 'course-layout';
  stored.forEach((data) => {
    const box = document.createElement('div');
    box.className = 'course-layout-image';
    box.style.left = `${Number(data.x) || 0}px`;
    box.style.top = `${Number(data.y) || 0}px`;
    box.style.width = `${Number(data.w) || 0}px`;
    box.style.height = `${Number(data.h) || 0}px`;
    const visual = mountCourseVisual(box, data);
    layer.appendChild(box);
    rememberWide({
      x: Number(data.x) || 0,
      y: Number(data.y) || 0,
      w: Number(data.w) || 0,
      h: Number(data.h) || 0,
      setWide: visual.setWide
    });
  });
  document.body.appendChild(layer);
  extendPageForImages(stored);
}

function startCourseAdmin(session) {
  if (window.innerWidth < 640) return;
  if (document.getElementById('admin-layer') || document.getElementById('admin-lock')) return;
  if (sessionStorage.getItem('georgii-admin-ok') === '1') {
    openAdminEditor(session);
    return;
  }
  askAdminPassword(session);
}

function askAdminPassword(session) {
  const lock = document.createElement('form');
  lock.id = 'admin-lock';
  const input = document.createElement('input');
  input.type = 'password';
  input.autocomplete = 'current-password';
  input.setAttribute('aria-label', 'password');
  lock.appendChild(input);
  lock.addEventListener('submit', (event) => {
    event.preventDefault();
    if (input.value.trim() !== ADMIN_PASSWORD) {
      input.classList.add('is-wrong');
      input.value = '';
      return;
    }
    sessionStorage.setItem('georgii-admin-ok', '1');
    lock.remove();
    openAdminEditor(session);
  });
  input.addEventListener('input', () => input.classList.remove('is-wrong'));
  document.body.appendChild(lock);
  input.focus();
}

function openAdminEditor(session) {
  const images = [];
  let selected = null;
  let metrics = null;
  let drag = null;
  const edits = new AbortController();

  const layer = document.createElement('div');
  layer.id = 'admin-layer';
  const canvas = document.createElement('canvas');
  canvas.id = 'admin-grid';
  const guides = document.createElement('div');
  guides.id = 'admin-guides';
  const board = document.createElement('div');
  board.id = 'admin-images';
  const file = document.createElement('input');
  file.id = 'admin-file';
  file.type = 'file';
  file.accept = 'image/*';
  file.multiple = true;
  file.hidden = true;
  const tools = document.createElement('div');
  tools.id = 'admin-tools';
  const add = document.createElement('button');
  add.id = 'admin-add';
  add.type = 'button';
  add.textContent = 'image';
  const saveButton = document.createElement('button');
  saveButton.id = 'admin-save';
  saveButton.type = 'button';
  saveButton.textContent = 'save';
  const videoButton = document.createElement('button');
  videoButton.id = 'admin-video';
  videoButton.type = 'button';
  videoButton.textContent = 'video';
  tools.append(saveButton, add, videoButton);
  layer.append(canvas, guides, board);
  document.body.append(layer, file, tools);

  function save() {
    const note = document.getElementById('course-description');
    const payload = {
      description: note ? descriptionText(note) : resolveCourseDescription(session),
      images: images.map((item) => {
        const piece = {
          id: item.id,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          src: item.src
        };
        if (item.vimeo) {
          piece.vimeo = item.vimeo;
          if (item.hash) piece.hash = item.hash;
        }
        return piece;
      })
    };
    try {
      localStorage.setItem(layoutKey(session.courseId, session.groupId), JSON.stringify(payload));
      return true;
    } catch (_) {
      return false;
    }
  }

  function leaveAdmin() {
    const description = descriptionText(document.getElementById('course-description'));
    if (!save()) return;
    publishCourseDescription(session, description);
    finishCourseDescription();
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('resize', drawGrid);
    edits.abort();
    const linkForm = document.getElementById('admin-video-link');
    if (linkForm) linkForm.remove();
    canvas.remove();
    guides.remove();
    tools.remove();
    file.remove();
    images.forEach((item) => {
      item.el.querySelectorAll('.admin-handle').forEach((handle) => handle.remove());
      item.el.classList.remove('is-selected', 'admin-image');
      item.el.classList.add('course-layout-image');
    });
    layer.id = 'course-layout';
    board.removeAttribute('id');
    extendPageForImages(images);
    const course = encodeURIComponent(session.courseId);
    const group = encodeURIComponent(session.groupId);
    history.replaceState(null, '', `course.html?course=${course}&group=${group}`);
  }

  saveButton.addEventListener('click', leaveAdmin);

  function computeMetrics() {
    const width = document.documentElement.clientWidth;
    const inset = 8;
    const gap = 24;
    const cols = width >= 768 ? 12 : width >= 640 ? 6 : 4;
    const colW = (width - inset * 2 - gap * (cols - 1)) / cols;
    const rowH = colW;
    const bottom = images.reduce((max, item) => Math.max(max, item.y + item.h), window.innerHeight);
    const height = Math.max(bottom + 120, document.documentElement.scrollHeight, window.innerHeight);
    const xs = [];
    const ys = [];
    for (let i = 0; i < cols; i += 1) {
      const x = inset + i * (colW + gap);
      xs.push(x, x + colW);
    }
    for (let y = 0; y < height; y += rowH + gap) {
      ys.push(y, y + rowH);
    }
    return { width, height, inset, gap, cols, colW, rowH, xs, ys };
  }

  function drawGrid() {
    metrics = computeMetrics();
    layer.style.height = `${metrics.height}px`;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(metrics.width * dpr);
    canvas.height = Math.round(metrics.height * dpr);
    canvas.style.width = `${metrics.width}px`;
    canvas.style.height = `${metrics.height}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, metrics.width, metrics.height);
    ctx.fillStyle = 'rgba(172, 172, 172, 0.09)';
    for (let i = 0; i < metrics.cols; i += 1) {
      const x = metrics.inset + i * (metrics.colW + metrics.gap);
      for (let y = 0; y < metrics.height; y += metrics.rowH + metrics.gap) {
        ctx.fillRect(x, y, metrics.colW, Math.min(metrics.rowH, metrics.height - y));
      }
    }
  }

  function applyBox(item) {
    item.el.style.left = `${item.x}px`;
    item.el.style.top = `${item.y}px`;
    item.el.style.width = `${item.w}px`;
    item.el.style.height = `${item.h}px`;
    syncWide(item);
  }

  function othersOf(item) {
    return images.filter((image) => image !== item);
  }

  function snapDelta(edges, targets) {
    let best = null;
    edges.forEach((edge) => {
      targets.forEach((target) => {
        const delta = target - edge;
        if (Math.abs(delta) <= ADMIN_SNAP && (best === null || Math.abs(delta) < Math.abs(best))) {
          best = delta;
        }
      });
    });
    return best || 0;
  }

  function imageTargets(item) {
    const xs = [];
    const ys = [];
    othersOf(item).forEach((image) => {
      xs.push(image.x, image.x + image.w);
      ys.push(image.y, image.y + image.h);
    });
    return { xs, ys };
  }

  function snapMove(item) {
    const pictures = imageTargets(item);
    const dxPic = snapDelta([item.x, item.x + item.w], pictures.xs);
    const dyPic = snapDelta([item.y, item.y + item.h], pictures.ys);
    item.x += dxPic || snapDelta([item.x, item.x + item.w], metrics.xs);
    item.y += dyPic || snapDelta([item.y, item.y + item.h], metrics.ys);
  }

  function snapResize(item, edges) {
    const pictures = imageTargets(item);
    if (edges.left || edges.right) {
      const edge = edges.left ? item.x : item.x + item.w;
      const dx = snapDelta([edge], pictures.xs) || snapDelta([edge], metrics.xs);
      if (edges.left) {
        item.x += dx;
        item.w -= dx;
      } else {
        item.w += dx;
      }
    }
    if (edges.top || edges.bottom) {
      const edge = edges.top ? item.y : item.y + item.h;
      const dy = snapDelta([edge], pictures.ys) || snapDelta([edge], metrics.ys);
      if (edges.top) {
        item.y += dy;
        item.h -= dy;
      } else {
        item.h += dy;
      }
    }
    item.w = Math.max(24, item.w);
    item.h = Math.max(24, item.h);
  }

  function layerPoint(event) {
    const rect = layer.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function placeCursor(x, y) {
    window.__courseCursorLock = { x, y };
    const cursor = document.getElementById('custom-cursor');
    if (!cursor) return;
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
  }

  function releaseCursor(event) {
    window.__courseCursorLock = null;
    const cursor = document.getElementById('custom-cursor');
    if (!cursor || !event) return;
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
  }

  function showGuides(item) {
    guides.innerHTML = '';
    const eps = 0.6;
    const verticals = [item.x, item.x + item.w];
    const horizontals = [item.y, item.y + item.h];
    if (metrics) {
      verticals.forEach((x) => {
        if (!metrics.xs.some((value) => Math.abs(value - x) <= eps)) return;
        const line = document.createElement('div');
        line.className = 'admin-guide';
        line.style.left = `${x}px`;
        line.style.top = `${item.y}px`;
        line.style.width = '1px';
        line.style.height = `${item.h}px`;
        guides.appendChild(line);
      });
      horizontals.forEach((y) => {
        if (!metrics.ys.some((value) => Math.abs(value - y) <= eps)) return;
        const line = document.createElement('div');
        line.className = 'admin-guide';
        line.style.left = `${item.x}px`;
        line.style.top = `${y}px`;
        line.style.width = `${item.w}px`;
        line.style.height = '1px';
        guides.appendChild(line);
      });
    }
    othersOf(item).forEach((image) => {
      verticals.forEach((x) => {
        if (![image.x, image.x + image.w].some((value) => Math.abs(value - x) <= eps)) return;
        const top = Math.min(item.y, image.y);
        const bottom = Math.max(item.y + item.h, image.y + image.h);
        const line = document.createElement('div');
        line.className = 'admin-guide';
        line.style.left = `${x}px`;
        line.style.top = `${top}px`;
        line.style.width = '1px';
        line.style.height = `${bottom - top}px`;
        guides.appendChild(line);
      });
      horizontals.forEach((y) => {
        if (![image.y, image.y + image.h].some((value) => Math.abs(value - y) <= eps)) return;
        const left = Math.min(item.x, image.x);
        const right = Math.max(item.x + item.w, image.x + image.w);
        const line = document.createElement('div');
        line.className = 'admin-guide';
        line.style.left = `${left}px`;
        line.style.top = `${y}px`;
        line.style.width = `${right - left}px`;
        line.style.height = '1px';
        guides.appendChild(line);
      });
    });
  }

  function select(item) {
    selected = item;
    images.forEach((image) => image.el.classList.toggle('is-selected', image === item));
    if (item) showGuides(item);
    else guides.innerHTML = '';
  }

  function remove(item) {
    if (item.destroy) item.destroy();
    const wideAt = wideItems.indexOf(item);
    if (wideAt >= 0) wideItems.splice(wideAt, 1);
    item.el.remove();
    const index = images.indexOf(item);
    if (index >= 0) images.splice(index, 1);
    if (selected === item) select(null);
    save();
    drawGrid();
  }

  function addImage(data) {
    if (edits.signal.aborted) return null;
    const item = {
      id: data.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      x: data.x,
      y: data.y,
      w: data.w,
      h: data.h,
      src: data.src,
      vimeo: data.vimeo ? String(data.vimeo) : '',
      hash: data.hash || '',
      el: document.createElement('div')
    };
    item.el.className = 'admin-image';
    const visual = mountCourseVisual(item.el, data);
    if (visual.vimeo) {
      item.vimeo = visual.vimeo;
      item.hash = visual.hash;
    }
    item.setWide = visual.setWide;
    item.destroy = visual.destroy;
    item.el.addEventListener('pointerdown', (event) => {
      if (event.target.closest('.course-video-chrome')) return;
      beginPointer(event, item, edgeAt(event, item));
    }, { signal: edits.signal });
    board.appendChild(item.el);
    images.push(item);
    applyBox(item);
    rememberWide(item);
    return item;
  }

  function edgeAt(event, item) {
    const rect = item.el.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const reach = Math.min(16, Math.max(8, Math.min(rect.width, rect.height) / 3));
    const nearLeft = x <= reach;
    const nearRight = rect.width - x <= reach;
    const nearTop = y <= reach;
    const nearBottom = rect.height - y <= reach;
    let horizontal = '';
    if (nearLeft && nearRight) horizontal = x < rect.width / 2 ? 'w' : 'e';
    else if (nearLeft) horizontal = 'w';
    else if (nearRight) horizontal = 'e';
    let vertical = '';
    if (nearTop && nearBottom) vertical = y < rect.height / 2 ? 'n' : 's';
    else if (nearTop) vertical = 'n';
    else if (nearBottom) vertical = 's';
    return (vertical + horizontal) || 'move';
  }

  function beginPointer(event, item, mode) {
    event.preventDefault();
    event.stopPropagation();
    select(item);
    item.el.setPointerCapture(event.pointerId);
    drag = {
      mode,
      pointerId: event.pointerId,
      start: layerPoint(event),
      origin: { x: item.x, y: item.y, w: item.w, h: item.h }
    };
  }

  function edgesFor(dir) {
    return {
      left: dir.includes('w'),
      right: dir.includes('e'),
      top: dir.includes('n'),
      bottom: dir.includes('s')
    };
  }

  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId || !selected) return;
    const point = layerPoint(event);
    const origin = drag.origin;
    const layerRect = layer.getBoundingClientRect();
    if (drag.mode === 'move') {
      const rawX = origin.x + (point.x - drag.start.x);
      const rawY = origin.y + (point.y - drag.start.y);
      selected.x = rawX;
      selected.y = rawY;
      snapMove(selected);
      placeCursor(event.clientX + (selected.x - rawX), event.clientY + (selected.y - rawY));
    } else {
      const edges = edgesFor(drag.mode);
      let x = origin.x;
      let y = origin.y;
      let w = origin.w;
      let h = origin.h;
      if (edges.left) {
        x = point.x;
        w = origin.x + origin.w - point.x;
      }
      if (edges.right) w = point.x - x;
      if (edges.top) {
        y = point.y;
        h = origin.y + origin.h - point.y;
      }
      if (edges.bottom) h = point.y - y;
      if (w < 24) {
        if (edges.left) x -= 24 - w;
        w = 24;
      }
      if (h < 24) {
        if (edges.top) y -= 24 - h;
        h = 24;
      }
      selected.x = x;
      selected.y = y;
      selected.w = w;
      selected.h = h;
      snapResize(selected, edges);
      placeCursor(
        edges.left ? layerRect.left + selected.x : edges.right ? layerRect.left + selected.x + selected.w : event.clientX,
        edges.top ? layerRect.top + selected.y : edges.bottom ? layerRect.top + selected.y + selected.h : event.clientY
      );
    }
    applyBox(selected);
    showGuides(selected);
  }

  function onPointerUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null;
    releaseCursor(event);
    save();
    drawGrid();
    if (selected) showGuides(selected);
  }

  function askVideoLink() {
    if (document.getElementById('admin-video-link')) return;
    const form = document.createElement('form');
    form.id = 'admin-video-link';
    const input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', 'vimeo');
    form.appendChild(input);
    const close = () => {
      form.remove();
      document.removeEventListener('pointerdown', outside, true);
    };
    const outside = (event) => {
      if (form.contains(event.target) || event.target.closest('#admin-video')) return;
      close();
    };
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const parsed = parseVimeoLink(input.value);
      if (!parsed) {
        input.classList.add('is-wrong');
        return;
      }
      close();
      const ratio = await vimeoRatio(parsed);
      if (edits.signal.aborted) return;
      const w = 280;
      const h = Math.max(24, Math.round(w * ratio));
      const item = addImage({
        src: parsed.src,
        vimeo: parsed.id,
        hash: parsed.hash,
        x: Math.round(window.scrollX + (window.innerWidth - w) / 2),
        y: Math.round(window.scrollY + 120),
        w,
        h
      });
      select(item);
      save();
      drawGrid();
    });
    input.addEventListener('input', () => input.classList.remove('is-wrong'));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    });
    document.body.appendChild(form);
    input.focus();
    setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
  }

  add.addEventListener('click', () => file.click());
  videoButton.addEventListener('click', askVideoLink);
  file.addEventListener('change', () => {
    const files = [...file.files];
    file.value = '';
    let offset = 0;
    files.forEach((blob) => {
      const reader = new FileReader();
      reader.onload = () => {
        const src = String(reader.result);
        const probe = new Image();
        probe.onload = () => {
          const w = Math.min(280, probe.naturalWidth || 280);
          const h = Math.max(24, w * ((probe.naturalHeight || w) / (probe.naturalWidth || w)));
          const item = addImage({
            src,
            x: Math.round(window.scrollX + (window.innerWidth - w) / 2 + offset),
            y: Math.round(window.scrollY + 120 + offset),
            w,
            h
          });
          offset += 24;
          if (!item) return;
          select(item);
          save();
          drawGrid();
        };
        probe.src = src;
      };
      reader.readAsDataURL(blob);
    });
  });

  function onPointerDown(event) {
    if (event.target.closest('.admin-image') || event.target.closest('#admin-tools')) return;
    select(null);
  }

  function onKeyDown(event) {
    if (event.target.closest('input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"]')) return;
    if (!selected) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      remove(selected);
      return;
    }
    const step = event.shiftKey ? 10 : 1;
    let moved = false;
    if (event.key === 'ArrowLeft') { selected.x -= step; moved = true; }
    if (event.key === 'ArrowRight') { selected.x += step; moved = true; }
    if (event.key === 'ArrowUp') { selected.y -= step; moved = true; }
    if (event.key === 'ArrowDown') { selected.y += step; moved = true; }
    if (!moved) return;
    event.preventDefault();
    applyBox(selected);
    showGuides(selected);
    save();
  }

  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', drawGrid);

  applyCourseDescription(session, true);
  readCourseLayout(session.courseId, session.groupId).forEach((data) => addImage(data));
  drawGrid();
}

window.startCourseAdmin = startCourseAdmin;
window.showSavedCourseLayout = showSavedCourseLayout;
window.loadPublishedCopy = loadPublishedCopy;
async function resumePendingCourse() {
  await loadPublishedCopy();
  if (window.__courseAdminPending && window.innerWidth >= 640 && !document.getElementById('admin-layer') && !document.getElementById('admin-lock')) {
    startCourseAdmin(window.__courseAdminPending);
    return;
  }
  const session = window.__courseLayoutPending || (window.innerWidth < 640 ? window.__courseAdminPending : null);
  if (session) showSavedCourseLayout(session);
}
resumePendingCourse();
setInterval(async () => {
  const host = window.location.hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') return;
  const session = window.__courseLayoutPending;
  if (!session || document.getElementById('admin-layer') || document.getElementById('admin-lock')) return;
  await loadPublishedCopy();
  applyCourseDescription(session, false);
}, 1000);
