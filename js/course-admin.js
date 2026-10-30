const ADMIN_PASSWORD = 'Sapozhka';
const LEVEL_SNAP = 8;

function layoutKey(courseId, groupId) {
  return `georgii-course-layout:${courseId}:${groupId}`;
}

function storageKeyFor(session) {
  if (session && session.storageKey) return session.storageKey;
  return layoutKey(session.courseId, session.groupId);
}

const hydratedLayouts = new Map();
const hydratingLayouts = new Map();
let imageDbPromise = null;

function imageDb() {
  if (!imageDbPromise) {
    imageDbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('no-idb'));
        return;
      }
      const request = indexedDB.open('georgii-admin-images', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch((error) => {
      imageDbPromise = null;
      throw error;
    });
  }
  return imageDbPromise;
}

function imageBlobKey(layoutKey, id) {
  return `${layoutKey}\0${id}`;
}

function parseLayout(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || '{"images":[]}');
    const images = Array.isArray(data.images)
      ? data.images.filter((item) => item && (item.src || item.vimeo || item.blob))
      : [];
    return images;
  } catch (_) {
    return [];
  }
}

function readStoredImages(key) {
  if (hydratedLayouts.has(key)) return hydratedLayouts.get(key);
  return parseLayout(key).filter((item) => item.src || item.vimeo);
}

async function readImageBlob(layoutKey, id) {
  try {
    const db = await imageDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('blobs', 'readonly');
      const request = tx.objectStore('blobs').get(imageBlobKey(layoutKey, id));
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (_) {
    return null;
  }
}

async function putImageBlob(layoutKey, id, blob) {
  try {
    const db = await imageDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('blobs', 'readwrite');
      tx.objectStore('blobs').put(blob, imageBlobKey(layoutKey, id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('abort'));
    });
    return true;
  } catch (_) {
    return false;
  }
}

async function pruneImageBlobs(layoutKey, ids) {
  try {
    const db = await imageDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('blobs', 'readwrite');
      const store = tx.objectStore('blobs');
      const request = store.getAllKeys();
      request.onsuccess = () => {
        const prefix = `${layoutKey}\0`;
        const keep = new Set(ids);
        (request.result || []).forEach((storedKey) => {
          if (typeof storedKey !== 'string' || !storedKey.startsWith(prefix)) return;
          if (!keep.has(storedKey.slice(prefix.length))) store.delete(storedKey);
        });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (_) {}
}

function hydrateImages(key) {
  if (hydratedLayouts.has(key)) return Promise.resolve(hydratedLayouts.get(key));
  if (hydratingLayouts.has(key)) return hydratingLayouts.get(key);
  const job = (async () => {
    try {
      const images = parseLayout(key);
      await Promise.all(images.map(async (item) => {
        if (item.src || item.vimeo || !item.blob) return;
        const blob = await readImageBlob(key, item.id);
        if (blob) item.src = URL.createObjectURL(blob);
      }));
      const ready = images.filter((item) => item.src || item.vimeo);
      hydratedLayouts.set(key, ready);
      return ready;
    } catch (_) {
      const ready = parseLayout(key).filter((item) => item.src || item.vimeo);
      hydratedLayouts.set(key, ready);
      return ready;
    }
  })();
  hydratingLayouts.set(key, job);
  job.finally(() => hydratingLayouts.delete(key));
  return job;
}

function writeLayout(key, payload) {
  const raw = JSON.stringify(payload);
  const previous = localStorage.getItem(key);
  try {
    localStorage.setItem(key, raw);
    return true;
  } catch (_) {}
  try {
    localStorage.removeItem(key);
    localStorage.setItem(key, raw);
    return true;
  } catch (_) {
    if (previous != null) {
      try { localStorage.setItem(key, previous); } catch (_) {}
    }
    return false;
  }
}

function previewHost() {
  const host = window.location.hostname;
  return host === '127.0.0.1' || host === 'localhost';
}

function assetDirFor(session) {
  if (!session) return '';
  if (typeof session.assetDir === 'string' && session.assetDir) return session.assetDir;
  if (session.courseId && session.groupId) return `Courses/${session.courseId}/${session.groupId}`;
  const key = session.storageKey || '';
  const match = /^georgii-project-layout:([^:]+):(.+)$/.exec(key);
  if (!match) return '';
  return projectFilesDir(match[2]);
}

function projectFilesDir(projectName, subfolder) {
  const name = String(projectName || '');
  if (name.toUpperCase() === 'RND') return `${name}${subfolder || ''}`;
  return `projects/${name}${subfolder || ''}/images`;
}

function projectFilesUrl(projectName, subfolder) {
  return projectFilesDir(projectName, subfolder).split('/').map((part) => encodeURIComponent(part)).join('/');
}

function imageFileName(item, ext) {
  const original = item.blob instanceof File ? item.blob.name : '';
  const base = (original.replace(/\.[^.]+$/, '') || 'image')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'image';
  const suffix = String(item.id).replace(/[^A-Za-z0-9]/g, '').slice(-12) || 'image';
  return `${base}-${suffix}.${ext}`;
}

function storedOnDisk(dir, src) {
  return Boolean(dir && typeof src === 'string' && (src.startsWith(`${dir}/`) || src.startsWith(`/${dir}/`)));
}

async function sniffedExt(blob) {
  try {
    const bytes = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
    if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
    if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'gif';
    if (
      bytes.length >= 12
      && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) return 'webp';
    if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      const brand = String.fromCharCode(...bytes.slice(8, 32));
      if (brand.includes('avif')) return 'avif';
    }
  } catch (_) {}
  return '';
}

function blobToJpeg(blob, maxEdge, quality) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const longest = Math.max(img.naturalWidth, img.naturalHeight, 1);
      const scale = Math.min(1, maxEdge / longest);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FAFAFA';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((out) => {
        URL.revokeObjectURL(url);
        resolve(out && out.size ? out : null);
      }, 'image/jpeg', quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

async function postCourseImage(dir, item, blob, ext) {
  const name = imageFileName(item, ext);
  const response = await fetch(`api/course-image?dir=${encodeURIComponent(dir)}&name=${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'application/octet-stream' },
    body: blob
  });
  if (!response.ok) return false;
  const data = await response.json();
  if (!data || typeof data.src !== 'string' || !storedOnDisk(dir, data.src)) return false;
  item.src = data.src;
  item.blob = blob;
  const img = item.el && item.el.querySelector('img');
  if (img) img.src = data.src.split('/').map((part) => encodeURIComponent(part)).join('/');
  return true;
}

async function uploadCourseImage(session, item) {
  const dir = assetDirFor(session);
  if (!dir || item.vimeo) return false;
  if (storedOnDisk(dir, item.src)) return true;
  const blob = item.blob instanceof Blob ? item.blob : await (async () => {
    if (!item.src) return null;
    try {
      const response = await fetch(item.src);
      return await response.blob();
    } catch (_) {
      return null;
    }
  })();
  if (!blob) return false;
  item.blob = blob;
  const ext = await sniffedExt(blob);
  if (ext && blob.size <= 25 * 1024 * 1024) {
    try {
      if (await postCourseImage(dir, item, blob, ext)) return true;
    } catch (_) {}
  }
  const shrinks = [[4096, 0.92], [2560, 0.86], [1600, 0.8], [1280, 0.72]];
  for (let i = 0; i < shrinks.length; i += 1) {
    const [edge, quality] = shrinks[i];
    const jpeg = await blobToJpeg(blob, edge, quality);
    if (!jpeg || jpeg.size > 25 * 1024 * 1024) continue;
    try {
      if (await postCourseImage(dir, item, jpeg, 'jpg')) return true;
    } catch (_) {}
  }
  return false;
}

async function publishFileLayout(session, payload) {
  const dir = assetDirFor(session);
  if (!dir) return null;
  const images = [];
  for (const piece of payload.images || []) {
    if (piece.vimeo) {
      images.push(piece);
      continue;
    }
    if (typeof piece.src === 'string' && piece.src.startsWith(`${dir}/`)) {
      images.push(piece);
      continue;
    }
    if (previewHost()) return false;
    return null;
  }
  try {
    const response = await fetch('api/course-layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dir,
        description: payload.description || '',
        images
      })
    });
    if (response.status === 404 || response.status === 405) return null;
    return response.ok;
  } catch (_) {
    return null;
  }
}

const fileLayoutText = new Map();

async function fetchFileLayout(dir) {
  if (!dir) return [];
  try {
    const response = await fetch(`${dir.split('/').map((part) => encodeURIComponent(part)).join('/')}/layout.json`, { cache: 'no-store' });
    if (!response.ok) return [];
    const text = await response.text();
    fileLayoutText.set(dir, text);
    const data = JSON.parse(text);
    return Array.isArray(data.images) ? data.images.filter((item) => item && (item.src || item.vimeo)) : [];
  } catch (_) {
    return [];
  }
}

function draftSrc(src) {
  return typeof src === 'string' && (src.startsWith('blob:') || src.startsWith('data:'));
}

function mergeLayoutImages(local, file) {
  const usable = (item) => item && (item.src || item.vimeo);
  const localItems = local.filter(usable);
  const fileItems = file.filter(usable);
  if (!fileItems.length) return localItems;
  if (!localItems.length) return fileItems;
  const localIds = new Set(localItems.map((item) => item.id));
  const fileIds = new Set(fileItems.map((item) => item.id));
  const fileInLocal = fileItems.every((item) => localIds.has(item.id));
  const localInFile = localItems.every((item) => fileIds.has(item.id));
  if (fileInLocal && !localInFile) return localItems;
  const merged = fileItems.map((item) => {
    const draft = localItems.find((entry) => entry.id === item.id);
    if (draft && draftSrc(draft.src)) return draft;
    return item;
  });
  localItems.forEach((item) => {
    if (fileIds.has(item.id)) return;
    if (localInFile && !draftSrc(item.src)) return;
    merged.push(item);
  });
  return merged.filter(usable);
}

async function loadLayoutImages(session) {
  const local = await hydrateImages(storageKeyFor(session));
  const file = await fetchFileLayout(assetDirFor(session));
  return mergeLayoutImages(local, file);
}

async function refreshFileLayout(session) {
  if (!session || document.getElementById('admin-layer') || document.getElementById('admin-lock')) return;
  const dir = assetDirFor(session);
  if (!dir) return;
  let text = '';
  try {
    const response = await fetch(`${dir.split('/').map((part) => encodeURIComponent(part)).join('/')}/layout.json`, { cache: 'no-store' });
    if (!response.ok) return;
    text = await response.text();
  } catch (_) {
    return;
  }
  if (fileLayoutText.get(dir) === text) return;
  fileLayoutText.set(dir, text);
  const layer = document.getElementById('course-layout');
  if (layer) layer.remove();
  const mobile = document.getElementById('course-mobile-grid');
  if (mobile) mobile.remove();
  document.querySelectorAll('.project-extra-media').forEach((node) => node.remove());
  if (session.courseId) showSavedCourseLayout(session);
  else showSavedProjectLayout(session);
}

function compactImage(src, maxEdge, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const longest = Math.max(img.naturalWidth, img.naturalHeight, 1);
      const scale = Math.min(1, maxEdge / longest);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FAFAFA';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve('');
    img.src = src;
  });
}

function readCourseLayout(courseId, groupId) {
  return readStoredImages(layoutKey(courseId, groupId));
}

function descriptionNode(session) {
  const id = session && session.descriptionId ? session.descriptionId : 'course-description';
  return document.getElementById(id);
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
    img.src = /^(https?:|data:|blob:)/i.test(data.src)
      ? data.src
      : data.src.split('/').map((part) => encodeURIComponent(part)).join('/');
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

function publicPageUrl(session) {
  if (session && typeof session.publicUrl === 'string' && session.publicUrl) return session.publicUrl;
  if (session && session.courseId) {
    const course = encodeURIComponent(session.courseId);
    const group = encodeURIComponent(session.groupId || '');
    return `course.html?course=${course}&group=${group}`;
  }
  const url = new URL(window.location.href);
  url.searchParams.delete('admin');
  const search = url.searchParams.toString();
  return url.pathname + (search ? `?${search}` : '') + url.hash;
}

function publishCourseDescription(session, description) {
  return fetch('api/course-description', {
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

async function showMobileCourseLayout(session) {
  if (!session) return;
  applyCourseDescription(session, false);
  if (document.getElementById('course-mobile-grid')) return;
  const stored = await loadLayoutImages(session);
  if (!stored.length || window.innerWidth >= 640 || document.getElementById('course-mobile-grid')) return;
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
    const desc = document.getElementById('course-description');
    const title = document.querySelector('.course-name');
    const above = desc && desc.getBoundingClientRect().height ? desc : title;
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

async function showSavedCourseLayout(session) {
  if (window.innerWidth < 640) {
    showMobileCourseLayout(session);
    return;
  }
  if (!session || document.getElementById('admin-layer')) return;
  applyCourseDescription(session, false);
  if (document.getElementById('course-layout')) return;
  const stored = await loadLayoutImages(session);
  if (!stored.length || document.getElementById('admin-layer') || document.getElementById('course-layout')) return;
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

function askAdminPassword(session, onOk) {
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
    if (typeof onOk === 'function') onOk(session);
    else if (session) openAdminEditor(session);
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
  let incoming = 0;
  const incomingWaiters = [];

  function waitForIncoming() {
    if (incoming === 0) return Promise.resolve();
    return new Promise((resolve) => incomingWaiters.push(resolve));
  }

  function beginIncoming() {
    incoming += 1;
  }

  function finishIncoming() {
    incoming = Math.max(0, incoming - 1);
    if (incoming === 0) incomingWaiters.splice(0).forEach((resolve) => resolve());
  }

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

  function savedDescription() {
    const note = descriptionNode(session);
    if (note) return descriptionText(note);
    try {
      const data = JSON.parse(localStorage.getItem(storageKeyFor(session)) || '{}');
      if (data && typeof data.description === 'string') return data.description;
    } catch (_) {}
    if (!session.storageKey) return resolveCourseDescription(session);
    return session.descriptionFallback || '';
  }

  async function blobFor(item) {
    if (item.blob instanceof Blob) return item.blob;
    if (!item.src || (!item.src.startsWith('data:') && !item.src.startsWith('blob:'))) return null;
    try {
      const response = await fetch(item.src);
      return await response.blob();
    } catch (_) {
      return null;
    }
  }

  function rememberLayout(key, pieces) {
    hydratedLayouts.set(key, pieces.map((piece) => {
      const item = images.find((entry) => entry.id === piece.id);
      const stored = {
        id: piece.id,
        x: piece.x,
        y: piece.y,
        w: piece.w,
        h: piece.h,
        src: item && item.src ? item.src : (piece.src || '')
      };
      if (piece.vimeo) {
        stored.vimeo = piece.vimeo;
        if (piece.hash) stored.hash = piece.hash;
      }
      return stored;
    }).filter((item) => item.src || item.vimeo));
  }

  async function writeCurrentLayout() {
    const key = storageKeyFor(session);
    const description = savedDescription();
    const dir = assetDirFor(session);
    const snapshot = images.slice();
    for (const item of snapshot) {
      if (!images.includes(item) || item.vimeo || storedOnDisk(dir, item.src)) continue;
      await uploadCourseImage(session, item);
    }
    const pieces = [];
    for (const item of images.slice()) {
      const piece = {
        id: item.id,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h
      };
      if (item.vimeo) {
        piece.vimeo = item.vimeo;
        piece.src = item.src;
        if (item.hash) piece.hash = item.hash;
        pieces.push(piece);
        continue;
      }
      if (storedOnDisk(dir, item.src)) {
        piece.src = item.src;
        pieces.push(piece);
        continue;
      }
      let blob = await blobFor(item);
      if (blob && !(await putImageBlob(key, item.id, blob))) {
        const smaller = await blobToJpeg(blob, 1600, 0.8);
        if (smaller && await putImageBlob(key, item.id, smaller)) blob = smaller;
        else blob = null;
      }
      if (blob) {
        piece.blob = true;
        pieces.push(piece);
        continue;
      }
      let src = item.src && item.src.startsWith('data:') ? item.src : '';
      if (!src && blob) src = await compactImage(URL.createObjectURL(blob), 1600, 0.8);
      piece.src = src;
      pieces.push(piece);
    }
    const live = new Set(images.map((item) => item.id));
    const kept = pieces.filter((piece) => live.has(piece.id) && (piece.src || piece.vimeo || piece.blob));
    kept.forEach((piece) => {
      const item = images.find((entry) => entry.id === piece.id);
      if (!item) return;
      piece.x = item.x;
      piece.y = item.y;
      piece.w = item.w;
      piece.h = item.h;
    });
    const fileReady = Boolean(dir) && kept.length === images.length && kept.every((piece) => piece.vimeo || storedOnDisk(dir, piece.src));
    const shrinkSteps = [[1600, 0.8], [1280, 0.68], [800, 0.55]];
    for (let step = -1; step < shrinkSteps.length; step += 1) {
      if (step >= 0) {
        const [edge, quality] = shrinkSteps[step];
        let changed = false;
        for (const piece of kept) {
          if (!piece.src || !piece.src.startsWith('data:')) continue;
          const smaller = await compactImage(piece.src, edge, quality);
          if (!smaller || smaller.length >= piece.src.length) continue;
          piece.src = smaller;
          changed = true;
          const item = images.find((entry) => entry.id === piece.id);
          if (item) {
            item.src = smaller;
            item.blob = null;
            const img = item.el.querySelector('img');
            if (img) img.src = smaller;
          }
        }
        if (!changed && !fileReady) return false;
      }
      const payload = {
        description,
        images: kept.map((piece) => {
          const stored = {
            id: piece.id,
            x: piece.x,
            y: piece.y,
            w: piece.w,
            h: piece.h
          };
          if (piece.vimeo) {
            stored.vimeo = piece.vimeo;
            stored.src = piece.src;
            if (piece.hash) stored.hash = piece.hash;
          } else if (piece.blob) {
            stored.blob = true;
          } else {
            stored.src = piece.src || '';
          }
          return stored;
        })
      };
      const localOk = writeLayout(key, payload);
      if (localOk) {
        rememberLayout(key, kept);
        pruneImageBlobs(key, kept.filter((piece) => piece.blob).map((piece) => piece.id));
      }
      const browserHasAll = localOk && kept.length === images.length;
      if (fileReady) {
        const published = await publishFileLayout(session, payload);
        if (published === true || browserHasAll) return true;
        if (published === false || (published === null && previewHost())) return false;
        if (localOk) return true;
        continue;
      }
      if (browserHasAll) return true;
      if (previewHost()) return false;
    }
    return false;
  }

  async function persistLayout(depth) {
    const level = depth || 0;
    await waitForIncoming();
    const mark = images.slice();
    const saved = await writeCurrentLayout();
    const changed = incoming > 0 || mark.length !== images.length || mark.some((item, index) => images[index] !== item);
    if (changed && level < 8) return persistLayout(level + 1);
    return saved && !changed;
  }

  let saveTail = Promise.resolve(true);
  let saveWait = null;

  function save() {
    if (!saveWait) {
      saveWait = new Promise((resolve) => {
        requestAnimationFrame(() => {
          saveWait = null;
          const run = saveTail.catch(() => false).then(() => persistLayout());
          saveTail = run.catch(() => false);
          resolve(run);
        });
      });
    }
    return saveWait;
  }

  async function leaveAdmin() {
    if (leaveAdmin.busy) return;
    leaveAdmin.busy = true;
    saveButton.classList.remove('is-wrong');
    const saved = await save();
    if (!saved) {
      leaveAdmin.busy = false;
      saveButton.classList.add('is-wrong');
      const dir = assetDirFor(session);
      images.forEach((item) => {
        const onDisk = item.vimeo || storedOnDisk(dir, item.src);
        item.el.classList.toggle('is-unsaved', !onDisk);
      });
      return;
    }
    const description = savedDescription();
    try {
      if (typeof session.onLeave === 'function') await session.onLeave(description);
      else await publishCourseDescription(session, description);
    } catch (_) {}
    window.location.replace(publicPageUrl(session));
  }

  saveButton.addEventListener('click', leaveAdmin);

  function computeMetrics() {
    const width = document.documentElement.clientWidth;
    const inset = 8;
    const gap = 24;
    const cols = width >= 768 ? 12 : width >= 640 ? 6 : 4;
    const colW = (width - inset * 2 - gap * (cols - 1)) / cols;
    const bottom = images.reduce((max, entry) => Math.max(max, entry.y + entry.h), window.innerHeight);
    const height = Math.max(bottom + 120, document.documentElement.scrollHeight, window.innerHeight);
    return { width, height, inset, gap, cols, colW };
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
      const x = columnLeft(i);
      ctx.fillRect(x, 0, metrics.colW, metrics.height);
    }
  }

  function columnLeft(index) {
    return metrics.inset + index * (metrics.colW + metrics.gap);
  }

  function spanWidth(span) {
    return span * metrics.colW + (span - 1) * metrics.gap;
  }

  function nearestSpan(width) {
    let best = 1;
    let bestDist = Infinity;
    for (let n = 1; n <= metrics.cols; n += 1) {
      const dist = Math.abs(spanWidth(n) - width);
      if (dist < bestDist) {
        bestDist = dist;
        best = n;
      }
    }
    return best;
  }

  function nearestStart(x, span) {
    const maxStart = Math.max(0, metrics.cols - span);
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i <= maxStart; i += 1) {
      const dist = Math.abs(columnLeft(i) - x);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  }

  function seatColumns(item) {
    metrics = computeMetrics();
    const ratio = item.ratio > 0 ? item.ratio : (item.h > 0 ? item.w / item.h : 1);
    const span = nearestSpan(item.w);
    const w = spanWidth(span);
    item.w = w;
    item.h = w / ratio;
    item.x = columnLeft(nearestStart(item.x, span));
  }

  function applyBox(item) {
    item.el.style.left = `${item.x}px`;
    item.el.style.top = `${item.y}px`;
    item.el.style.width = `${item.w}px`;
    item.el.style.height = `${item.h}px`;
    syncWide(item);
  }

  function snapLevel(item) {
    let best = null;
    images.forEach((other) => {
      if (other === item || Math.abs(other.h - item.h) > 1) return;
      const delta = other.y - item.y;
      if (Math.abs(delta) <= LEVEL_SNAP && (best === null || Math.abs(delta) < Math.abs(best))) best = delta;
    });
    if (best) item.y += best;
  }

  function snapMove(item) {
    metrics = computeMetrics();
    const span = nearestSpan(item.w);
    item.x = columnLeft(nearestStart(item.x, span));
    snapLevel(item);
  }

  function itemRatio(item, origin) {
    if (item.ratio > 0) return item.ratio;
    if (origin && origin.w > 0 && origin.h > 0) return origin.w / origin.h;
    return 1;
  }

  function placeFromAnchor(anchorX, anchorY, w, h, edges, origin) {
    const horizontal = edges.left || edges.right;
    const vertical = edges.top || edges.bottom;
    return {
      x: horizontal ? (edges.left ? anchorX - w : anchorX) : origin.x + (origin.w - w) / 2,
      y: vertical ? (edges.top ? anchorY - h : anchorY) : origin.y + (origin.h - h) / 2,
      w,
      h
    };
  }

  function resizeProportional(item, edges, point, origin) {
    const ratio = itemRatio(item, origin);
    const anchorX = edges.left ? origin.x + origin.w : origin.x;
    const anchorY = edges.top ? origin.y + origin.h : origin.y;
    const horizontal = edges.left || edges.right;
    const vertical = edges.top || edges.bottom;
    const minH = 24 / ratio;
    const across = horizontal
      ? Math.max(24, edges.left ? anchorX - point.x : point.x - anchorX)
      : origin.w;
    const down = vertical
      ? Math.max(minH, edges.top ? anchorY - point.y : point.y - anchorY)
      : origin.h;
    const desiredW = horizontal && vertical
      ? Math.max(24, Math.max(minH, (across * ratio + down) / (ratio * ratio + 1)) * ratio)
      : horizontal
        ? across
        : Math.max(24, down * ratio);
    metrics = computeMetrics();
    let span = nearestSpan(desiredW);
    let box;
    if (edges.right) {
      const start = nearestStart(origin.x, 1);
      span = Math.max(1, Math.min(span, metrics.cols - start));
      const w = spanWidth(span);
      box = placeFromAnchor(anchorX, anchorY, w, w / ratio, edges, origin);
      box.x = columnLeft(start);
    } else if (edges.left) {
      let end = 0;
      let endDist = Infinity;
      const right = origin.x + origin.w;
      for (let i = 0; i < metrics.cols; i += 1) {
        const dist = Math.abs(columnLeft(i) + metrics.colW - right);
        if (dist < endDist) {
          endDist = dist;
          end = i;
        }
      }
      span = Math.max(1, Math.min(span, end + 1));
      const w = spanWidth(span);
      box = placeFromAnchor(anchorX, anchorY, w, w / ratio, edges, origin);
      box.x = columnLeft(end - span + 1);
    } else {
      const w = spanWidth(span);
      box = placeFromAnchor(anchorX, anchorY, w, w / ratio, edges, origin);
      box.x = columnLeft(nearestStart(box.x, span));
    }
    item.x = box.x;
    item.y = box.y;
    item.w = box.w;
    item.h = box.h;
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

  function select(item) {
    selected = item;
    images.forEach((image) => image.el.classList.toggle('is-selected', image === item));
    guides.innerHTML = '';
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
      blob: data.blob instanceof Blob ? data.blob : null,
      el: document.createElement('div')
    };
    item.ratio = data.w > 0 && data.h > 0 ? data.w / data.h : 0;
    item.el.className = 'admin-image';
    const visual = mountCourseVisual(item.el, data);
    if (visual.vimeo) {
      item.vimeo = visual.vimeo;
      item.hash = visual.hash;
    }
    const img = item.el.querySelector('img');
    if (img) {
      const rememberRatio = () => {
        if (img.naturalWidth > 0 && img.naturalHeight > 0) item.ratio = img.naturalWidth / img.naturalHeight;
      };
      if (img.complete) rememberRatio();
      else img.addEventListener('load', rememberRatio, { once: true });
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
    seatColumns(item);
    applyBox(item);
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
      resizeProportional(selected, edges, point, origin);
      placeCursor(
        edges.left ? layerRect.left + selected.x : edges.right ? layerRect.left + selected.x + selected.w : event.clientX,
        edges.top ? layerRect.top + selected.y : edges.bottom ? layerRect.top + selected.y + selected.h : event.clientY
      );
    }
    applyBox(selected);
  }

  function onPointerUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null;
    releaseCursor(event);
    save();
    drawGrid();
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
      if (item) {
        seatColumns(item);
        applyBox(item);
      }
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
    files.forEach((blob, index) => {
      beginIncoming();
      const src = URL.createObjectURL(blob);
      const probe = new Image();
      const place = (width, height) => {
        const w = Math.min(280, width || 280);
        const h = Math.max(24, w * ((height || w) / (width || w)));
        const item = addImage({
          src,
          blob,
          x: Math.round(window.scrollX + (window.innerWidth - w) / 2 + index * 24),
          y: Math.round(window.scrollY + 120 + index * 24),
          w,
          h
        });
        if (!item) return;
        seatColumns(item);
        if (index > 0) {
          const span = nearestSpan(item.w);
          const start = Math.min(metrics.cols - span, nearestStart(item.x, span) + index);
          item.x = columnLeft(start);
        }
        applyBox(item);
        select(item);
        drawGrid();
      };
      const done = () => {
        finishIncoming();
        save();
      };
      probe.onload = () => {
        place(probe.naturalWidth, probe.naturalHeight);
        done();
      };
      probe.onerror = () => {
        place(280, 280);
        done();
      };
      probe.src = src;
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
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const before = selected.x;
      seatColumns(selected);
      const span = nearestSpan(selected.w);
      let start = nearestStart(selected.x, span);
      if (Math.abs(before - selected.x) < 0.5) {
        start = event.key === 'ArrowLeft'
          ? Math.max(0, start - 1)
          : Math.min(metrics.cols - span, start + 1);
      }
      selected.x = columnLeft(start);
      moved = true;
    }
    if (event.key === 'ArrowUp') { selected.y -= step; moved = true; }
    if (event.key === 'ArrowDown') { selected.y += step; moved = true; }
    if (!moved) return;
    event.preventDefault();
    applyBox(selected);
    save();
  }

  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', drawGrid);

  if (typeof session.prepare === 'function') session.prepare();
  else applyCourseDescription(session, true);
  drawGrid();
  beginIncoming();
  loadLayoutImages(session).then((stored) => {
    if (!edits.signal.aborted) {
      stored.forEach((data) => addImage(data));
      drawGrid();
    }
  }).finally(finishIncoming);
}

async function showSavedProjectLayout(session) {
  if (!session) return;
  const stored = await loadLayoutImages(session);
  if (!stored.length || document.getElementById('admin-layer')) return;
  if (window.innerWidth < 640) {
    const grid = document.getElementById('file-grid');
    if (!grid || grid.querySelector('.project-extra-media')) return;
    const empty = grid.querySelector('.border-dashed');
    if (empty) empty.remove();
    const items = stored.slice().sort((a, b) => {
      const dy = (Number(a.y) || 0) - (Number(b.y) || 0);
      if (Math.abs(dy) > 8) return dy;
      return (Number(a.x) || 0) - (Number(b.x) || 0);
    });
    items.forEach((data) => {
      const cell = document.createElement('div');
      cell.className = 'project-extra-media col-span-12 w-full';
      const box = document.createElement('div');
      box.className = 'course-layout-image';
      const visual = mountCourseVisual(box, data);
      if (visual.vimeo) visual.setWide(true);
      cell.appendChild(box);
      grid.appendChild(cell);
    });
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
    return;
  }
  if (document.getElementById('admin-layer') || document.getElementById('course-layout')) return;
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

function startProjectAdmin(session) {
  if (window.innerWidth < 640) return;
  if (document.getElementById('admin-layer') || document.getElementById('admin-lock')) return;
  const open = () => openAdminEditor(session);
  if (sessionStorage.getItem('georgii-admin-ok') === '1') open();
  else askAdminPassword(session, open);
}

let projectCopy = { descriptions: {}, added: [], removed: [] };

async function loadProjectCopy() {
  try {
    const response = await fetch(`js/project-copy.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return projectCopy;
    const data = await response.json();
    if (!data || typeof data !== 'object') return projectCopy;
    projectCopy = {
      descriptions: data.descriptions && typeof data.descriptions === 'object' ? data.descriptions : {},
      added: Array.isArray(data.added) ? data.added : [],
      removed: Array.isArray(data.removed) ? data.removed.filter((item) => typeof item === 'string' && item) : []
    };
  } catch (_) {}
  return projectCopy;
}

function localAddedProjects() {
  try {
    const data = JSON.parse(localStorage.getItem('georgii-added-projects') || '[]');
    return Array.isArray(data) ? data.filter((item) => item && typeof item.name === 'string' && item.name) : [];
  } catch (_) {
    return [];
  }
}

function rememberAddedProject(project) {
  const list = localAddedProjects().filter((item) => item.name !== project.name);
  list.push({
    name: project.name,
    title: project.title,
    category: project.category,
    description: project.description || ''
  });
  try {
    localStorage.setItem('georgii-added-projects', JSON.stringify(list));
  } catch (_) {}
}

function forgetAddedProject(name) {
  try {
    localStorage.setItem('georgii-added-projects', JSON.stringify(localAddedProjects().filter((item) => item.name !== name)));
  } catch (_) {}
}

function localRemovedProjects() {
  try {
    const data = JSON.parse(localStorage.getItem('georgii-removed-projects') || '[]');
    return Array.isArray(data) ? data.filter((item) => typeof item === 'string' && item) : [];
  } catch (_) {
    return [];
  }
}

function rememberRemovedProject(name) {
  const list = localRemovedProjects().filter((item) => item !== name);
  list.push(name);
  try {
    localStorage.setItem('georgii-removed-projects', JSON.stringify(list));
  } catch (_) {}
}

function forgetRemovedProject(name) {
  try {
    localStorage.setItem('georgii-removed-projects', JSON.stringify(localRemovedProjects().filter((item) => item !== name)));
  } catch (_) {}
}

function mergeProjectRecords(base) {
  const projects = (Array.isArray(base) ? base : []).map((project) => Object.assign({}, project));
  const seen = new Set(projects.map((project) => project.name));
  localAddedProjects().concat(projectCopy.added || []).forEach((project) => {
    if (!project || typeof project.name !== 'string' || !project.name || seen.has(project.name)) return;
    seen.add(project.name);
    projects.push({
      name: project.name,
      title: typeof project.title === 'string' && project.title ? project.title : project.name.replace(/_/g, ' '),
      category: String(project.category || 'commerce').toLowerCase(),
      description: typeof project.description === 'string' ? project.description : ''
    });
  });
  projects.forEach((project) => {
    const category = String(project.category || '').toLowerCase();
    const key = `${category}:${project.name}`;
    const shared = projectCopy.descriptions ? projectCopy.descriptions[key] : undefined;
    if (typeof shared === 'string') project.description = shared;
    try {
      const raw = localStorage.getItem(`georgii-project-layout:${category}:${project.name}`);
      if (raw == null) return;
      const data = JSON.parse(raw);
      if (data && typeof data.description === 'string') project.description = data.description;
    } catch (_) {}
  });
  const removed = new Set(localRemovedProjects().concat(projectCopy.removed || []));
  return projects.filter((project) => !removed.has(project.name));
}

function publishProject(body) {
  return fetch('api/project', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(async (response) => {
    if (!response.ok) return null;
    const data = await response.json();
    if (data && data.copy && typeof data.copy === 'object') {
      projectCopy = {
        descriptions: data.copy.descriptions && typeof data.copy.descriptions === 'object' ? data.copy.descriptions : {},
        added: Array.isArray(data.copy.added) ? data.copy.added : [],
        removed: Array.isArray(data.copy.removed) ? data.copy.removed.filter((item) => typeof item === 'string' && item) : []
      };
    }
    return data;
  }).catch(() => null);
}

window.startCourseAdmin = startCourseAdmin;
window.showSavedCourseLayout = showSavedCourseLayout;
window.loadPublishedCopy = loadPublishedCopy;
window.showSavedProjectLayout = showSavedProjectLayout;
window.startProjectAdmin = startProjectAdmin;
window.loadProjectCopy = loadProjectCopy;
window.mergeProjectRecords = mergeProjectRecords;
window.publishProject = publishProject;
window.rememberAddedProject = rememberAddedProject;
window.forgetAddedProject = forgetAddedProject;
window.rememberRemovedProject = rememberRemovedProject;
window.forgetRemovedProject = forgetRemovedProject;
window.getProjectCopy = () => projectCopy;
window.projectFilesDir = projectFilesDir;
window.projectFilesUrl = projectFilesUrl;
window.projectLayoutKey = (category, name) => `georgii-project-layout:${String(category || '').toLowerCase()}:${name}`;
window.projectLayoutImages = (category, name) => readStoredImages(window.projectLayoutKey(category, name));
window.hydrateProjectLayout = (category, name) => hydrateImages(window.projectLayoutKey(category, name));
window.refreshAdminFileLayout = refreshFileLayout;
window.startHomeAdmin = function (onReady) {
  if (window.innerWidth < 640) return;
  if (document.getElementById('admin-lock') || document.getElementById('admin-home')) return;
  const open = () => { if (typeof onReady === 'function') onReady(); };
  if (sessionStorage.getItem('georgii-admin-ok') === '1') open();
  else askAdminPassword(null, open);
};
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
  await refreshFileLayout(session);
}, 1000);
