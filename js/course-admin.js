const ADMIN_PASSWORD = 'Sapozhka';
const ADMIN_SNAP = 8;

const HANDLE_DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function startCourseAdmin(session) {
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
  const storageKey = `georgii-course-layout:${session.courseId}:${session.groupId}`;
  const images = [];
  let selected = null;
  let metrics = null;
  let drag = null;

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
  const add = document.createElement('button');
  add.id = 'admin-add';
  add.type = 'button';
  add.textContent = 'image';
  layer.append(canvas, guides, board);
  document.body.append(layer, file, add);

  function readStored() {
    try {
      const data = JSON.parse(localStorage.getItem(storageKey) || '{"images":[]}');
      return Array.isArray(data.images) ? data.images : [];
    } catch (_) {
      return [];
    }
  }

  function save() {
    const payload = {
      images: images.map((item) => ({
        id: item.id,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        src: item.src
      }))
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (_) {
      // The pictures stay for this visit when storage is full.
    }
  }

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
    ctx.fillStyle = 'rgba(172, 172, 172, 0.18)';
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

  function showGuides(item) {
    guides.innerHTML = '';
    const eps = 0.6;
    const verticals = [item.x, item.x + item.w];
    const horizontals = [item.y, item.y + item.h];
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
    item.el.remove();
    const index = images.indexOf(item);
    if (index >= 0) images.splice(index, 1);
    if (selected === item) select(null);
    save();
    drawGrid();
  }

  function addImage(data) {
    const item = {
      id: data.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      x: data.x,
      y: data.y,
      w: data.w,
      h: data.h,
      src: data.src,
      el: document.createElement('div')
    };
    item.el.className = 'admin-image';
    const img = document.createElement('img');
    img.src = item.src;
    img.alt = '';
    img.draggable = false;
    item.el.appendChild(img);
    const handlePlace = {
      nw: { left: '-3px', top: '-3px' },
      n: { left: 'calc(50% - 3.5px)', top: '-3px' },
      ne: { right: '-3px', top: '-3px' },
      e: { right: '-3px', top: 'calc(50% - 3.5px)' },
      se: { right: '-3px', bottom: '-3px' },
      s: { left: 'calc(50% - 3.5px)', bottom: '-3px' },
      sw: { left: '-3px', bottom: '-3px' },
      w: { left: '-3px', top: 'calc(50% - 3.5px)' }
    };
    HANDLE_DIRS.forEach((dir) => {
      const handle = document.createElement('span');
      handle.className = 'admin-handle';
      handle.dataset.dir = dir;
      Object.assign(handle.style, handlePlace[dir]);
      handle.addEventListener('pointerdown', (event) => beginPointer(event, item, dir));
      item.el.appendChild(handle);
    });
    item.el.addEventListener('pointerdown', (event) => {
      if (event.target.dataset.dir) return;
      beginPointer(event, item, 'move');
    });
    board.appendChild(item.el);
    images.push(item);
    applyBox(item);
    return item;
  }

  function beginPointer(event, item, mode) {
    event.preventDefault();
    event.stopPropagation();
    select(item);
    item.el.setPointerCapture(event.pointerId);
    drag = {
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
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
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const origin = drag.origin;
    if (drag.mode === 'move') {
      selected.x = origin.x + dx;
      selected.y = origin.y + dy;
      snapMove(selected);
    } else {
      const edges = edgesFor(drag.mode);
      selected.x = origin.x;
      selected.y = origin.y;
      selected.w = origin.w;
      selected.h = origin.h;
      if (edges.left) {
        selected.x = origin.x + dx;
        selected.w = origin.w - dx;
      }
      if (edges.right) selected.w = origin.w + dx;
      if (edges.top) {
        selected.y = origin.y + dy;
        selected.h = origin.h - dy;
      }
      if (edges.bottom) selected.h = origin.h + dy;
      selected.w = Math.max(24, selected.w);
      selected.h = Math.max(24, selected.h);
      snapResize(selected, edges);
    }
    applyBox(selected);
    showGuides(selected);
  }

  function onPointerUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null;
    save();
    drawGrid();
    if (selected) showGuides(selected);
  }

  add.addEventListener('click', () => file.click());
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
          select(item);
          save();
          drawGrid();
        };
        probe.src = src;
      };
      reader.readAsDataURL(blob);
    });
  });

  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.admin-image') || event.target.closest('#admin-add')) return;
    select(null);
  });
  document.addEventListener('keydown', (event) => {
    if (!selected || event.target.closest('input, textarea')) return;
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
  });
  window.addEventListener('resize', drawGrid);

  readStored().forEach((data) => {
    if (!data.src) return;
    addImage(data);
  });
  drawGrid();
}

window.startCourseAdmin = startCourseAdmin;
if (window.__courseAdminPending) startCourseAdmin(window.__courseAdminPending);
