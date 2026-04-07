// Страница проекта - работа с локальными файлами
const urlParams = new URLSearchParams(window.location.search);
const projectName = urlParams.get('project') || '';
const projectCategory = urlParams.get('category') || '';

const grid = document.getElementById('file-grid');
const loading = document.getElementById('loading');
const breadcrumb = document.getElementById('breadcrumb');
const viewerOverlay = document.getElementById('viewerOverlay');
const viewerContent = document.getElementById('viewerContent');
const projectTitle = document.getElementById('project-title');
const projectDescription = document.getElementById('project-description');

let currentItems = [];
let currentIndex = 0;

// =============== LAZY LOADING ===============
// Intersection Observer для lazy loading
let imageObserver = null;

// Инициализация Intersection Observer для lazy loading
function initLazyLoading() {
  // Проверяем поддержку Intersection Observer
  if ('IntersectionObserver' in window) {
    imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target;
          
          // Для изображений
          if (element.tagName === 'IMG' && element.dataset.src) {
            element.src = element.dataset.src;
            element.removeAttribute('data-src');
            imageObserver.unobserve(element);
          }
          
          // Для видео
          if (element.tagName === 'VIDEO' && element.dataset.src) {
            const source = element.querySelector('source');
            if (source) {
              source.src = element.dataset.src;
              element.load();
              element.removeAttribute('data-src');
            }
            imageObserver.unobserve(element);
          }
        }
      });
    }, {
      rootMargin: '50px', // Начинаем загрузку за 50px до появления в viewport
      threshold: 0.01
    });
  }
}

// =============== ВСПОМОГАТЕЛЬНОЕ ===============
const isImage = (name) => /\.(jpe?g|png|gif|webp)$/i.test(name);
const isVideo = (name) => /\.(mp4|mov|avi|mkv|webm)$/i.test(name);
const isVimeo = (name) => /^vimeo:/i.test(name) || /vimeo\.com/i.test(name);

// Извлечение ID видео из Vimeo URL
function getVimeoId(url) {
  // Поддерживаем форматы:
  // - vimeo:123456789
  // - https://vimeo.com/123456789
  // - https://player.vimeo.com/video/123456789
  // - 123456789 (просто ID)
  const match = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/|^vimeo:)(\d+)/i) || url.match(/^(\d+)$/);
  return match ? match[1] : null;
}

/** Равномерный рандом (лучше, чем Math.random, для раскладки сетки) */
function randomUint32() {
  const buf = new Uint32Array(1);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
    return buf[0];
  }
  return Math.floor(Math.random() * 0xffffffff);
}
function randomInt(maxExclusive) {
  return maxExclusive <= 0 ? 0 : randomUint32() % maxExclusive;
}

/** Категория R&D в URL — `rnd` (см. projects.json) */
function isRndCategory(category) {
  return String(category || '').trim().toLowerCase() === 'rnd';
}

/** Порядковый номер из имени файла: последний фрагмент вида _01 / _02 перед расширением */
function getFilenameOrderIndex(name) {
  const m = name.match(/_(\d+)(?=\.[^.]+$)/i);
  return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
}

/** Сохраняем заданную в именах последовательность (_00, _01, …); без суффикса — в конце, по имени */
function sortProjectMediaByOrder(arr) {
  return arr.slice().sort((a, b) => {
    const na = getFilenameOrderIndex(a.name);
    const nb = getFilenameOrderIndex(b.name);
    if (na !== nb) return na - nb;
    return String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: 'base' });
  });
}

/** Проекты, где все видео (и Vimeo) должны идти перед картинками */
function isVideosFirstProject(projectName) {
  const n = String(projectName || '').trim().toLowerCase();
  return n === 'red_structure' || n === 'type_oclock';
}

function isVideoMediaItem(item) {
  const n = item.name || '';
  const s = item.src || '';
  return isVideo(n) || isVimeo(n) || isVimeo(s);
}

/** Сначала все видео, затем остальное; внутри групп — по _01, _02 … */
function sortProjectMediaVideosFirstOrder(arr) {
  return arr.slice().sort((a, b) => {
    const va = isVideoMediaItem(a);
    const vb = isVideoMediaItem(b);
    if (va !== vb) return va ? -1 : 1;
    const na = getFilenameOrderIndex(a.name);
    const nb = getFilenameOrderIndex(b.name);
    if (na !== nb) return na - nb;
    return String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: 'base' });
  });
}

/** Случайный порядок медиа (для категории R&D) */
function shuffleProjectMedia(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

/**
 * Случайная колонка (равномерно по допустимому диапазону) и ширина в колонках
 * с взвешенным выбором span — без фиксированного ритма.
 * @param {{ minSpan?: number, maxSpan?: number }} [options]
 * @param {number} [options.minSpan=2] — минимум колонок (например 4 для highres в имени файла)
 * @param {number} [options.maxSpan=11] — максимум колонок (например 4 для lowres)
 */
function pickRandomGridLayout(options = {}) {
  const maxSpan = options.maxSpan != null ? options.maxSpan : 11;
  const minSpan = options.minSpan != null ? options.minSpan : 2;
  let cap = Math.min(11, Math.max(2, maxSpan));
  let floor = Math.min(11, Math.max(2, minSpan));
  if (floor > cap) {
    floor = cap;
  }
  const u = randomUint32() / 0xffffffff;
  let span;
  if (u < 0.18) {
    span = 2 + randomInt(3);
  } else if (u < 0.45) {
    span = 3 + randomInt(4);
  } else if (u < 0.72) {
    span = 5 + randomInt(3);
  } else if (u < 0.9) {
    span = 7 + randomInt(3);
  } else {
    span = 9 + randomInt(3);
  }
  span = Math.min(11, Math.max(2, span));
  span = Math.min(cap, Math.max(floor, span));
  const maxStart = 12 - span + 1;
  const start = maxStart <= 1 ? 1 : 1 + randomInt(maxStart);
  return { start, span };
}

/** С вероятностью 50% даёт ~3× вертикальный ритм относительно одного gap-y-24 (6rem): row-gap + по 6rem сверху и снизу ≈ 18rem между рядами. */
function applyRandomProjectGridVerticalMargin(el) {
  if (randomInt(2) === 0) return;
  el.style.marginTop = '6rem';
  el.style.marginBottom = '6rem';
}

// Генерация случайного текста из 3 предложений
function generateRandomDescription() {
  const sentences = [
    "This project explores the boundaries between digital and physical spaces, creating a unique visual language that challenges traditional perceptions.",
    "Through careful composition and thoughtful design, we aim to communicate complex ideas in a simple and accessible way.",
    "The work reflects on contemporary issues while maintaining a timeless aesthetic that resonates across different cultures and contexts.",
    "By combining innovative techniques with classical principles, we create something that feels both familiar and entirely new.",
    "Each element has been carefully considered to contribute to the overall narrative and emotional impact of the piece.",
    "The project seeks to bridge the gap between artistic expression and functional design, proving that beauty and utility can coexist.",
    "Through experimentation and iteration, we discovered new ways of seeing and understanding the world around us.",
    "This work represents a synthesis of different disciplines, bringing together diverse perspectives to create a cohesive whole.",
    "The visual language developed here speaks to universal themes while remaining deeply personal and authentic.",
    "We believe that good design should not only look beautiful but also serve a purpose and tell a story."
  ];
  
  // Выбираем 3 случайных предложения
  const selected = [];
  const used = new Set();
  while(selected.length < 3) {
    const index = Math.floor(Math.random() * sentences.length);
    if(!used.has(index)) {
      used.add(index);
      selected.push(sentences[index]);
    }
  }
  
  return selected.join(' ');
}

function renderBreadcrumb(projectName, subfolder = ''){
  breadcrumb.innerHTML = '';
  
  // URL для возврата на главную страницу (без параметров)
  const homeUrl = 'index.html';
  
  // URL для возврата на страницу категории
  const categoryParam = projectCategory ? `?category=${encodeURIComponent(projectCategory)}` : '';
  const categoryUrl = `index.html${categoryParam}`;
  
  // Форматируем название категории (первая буква заглавная)
  const categoryDisplayName = projectCategory 
    ? projectCategory.charAt(0).toUpperCase() + projectCategory.slice(1).toLowerCase()
    : 'Projects';
  
  const crumbs = [
    { name:'Home', on: () => window.location.href=homeUrl },
    { name: categoryDisplayName, on: () => window.location.href=categoryUrl }
  ];
  
  // Форматируем название проекта (заменяем подчеркивания на пробелы)
  const projectDisplayName = projectName.replace(/_/g, ' ');
  crumbs.push({ name: projectDisplayName, on: () => loadProject(projectName, '') });
  
  if(subfolder){
    const parts = subfolder.split('/').filter(Boolean);
    let cumulative = '';
    parts.forEach(p => { 
      cumulative += '/'+p; 
      crumbs.push({ name:p, on: () => loadProject(projectName, cumulative) }); 
    });
  }

  crumbs.forEach((c,i)=>{
    const b=document.createElement('button'); 
    b.className='hover:underline cursor-pointer'; 
    b.textContent=c.name; 
    b.onclick=c.on;
    breadcrumb.appendChild(b); 
    if(i<crumbs.length-1) {
      const separator = document.createTextNode(' / ');
      breadcrumb.appendChild(separator);
    }
  });
}

// =============== ЗАГРУЗКА ПРОЕКТА ===============
async function loadProject(projectName, subfolder = ''){
  loading.style.display='block';
  grid.innerHTML='';
  
  if(!projectName){
    loading.textContent='Проект не указан. Вернитесь на главную страницу.';
    return;
  }

  // Используем категорию для построения пути, если она указана
  // Приводим категорию к правильному регистру (первая буква заглавная)
  const categoryCapitalized = projectCategory ? projectCategory.charAt(0).toUpperCase() + projectCategory.slice(1).toLowerCase() : '';
  const categoryPath = categoryCapitalized ? `${categoryCapitalized}/` : '';
  const projectPath = subfolder 
    ? `projects/${categoryPath}${projectName}${subfolder}` 
    : `projects/${categoryPath}${projectName}`;
  
  const imagesPath = `${projectPath}/images`;
  
  try{
    // Загружаем список файлов из папки images
    console.log(`Загрузка проекта: ${projectName}, категория: ${projectCategory || 'нет'}, подпапка: ${subfolder || 'корневая'}`);
    const images = await getProjectImages(projectName, subfolder, projectCategory);
    console.log(`Загружено файлов: ${images.length}`);
    
    renderBreadcrumb(projectName, subfolder);
    breadcrumb.style.display = 'flex';
    grid.style.display = 'grid';

    if(!images || images.length === 0){
      grid.innerHTML='<div class="col-span-12 text-center text-gray-400 border border-dashed rounded-lg p-6">Файлы не найдены.<br>Добавьте изображения или видео в папку <code class="bg-gray-100 px-2 py-1 rounded">projects/' + (projectCategory ? projectCategory + '/' : '') + projectName + '/images/</code><br><br>Файлы будут автоматически обнаружены при следующей загрузке страницы.</div>';
      loading.style.display='none'; 
      return;
    }

    currentItems = [];
    const mediaToRender = isRndCategory(projectCategory)
      ? shuffleProjectMedia(images)
      : isVideosFirstProject(projectName)
        ? sortProjectMediaVideosFirstOrder(images)
        : sortProjectMediaByOrder(images);
    
    mediaToRender.forEach((image, idx) => {
      const wrap = document.createElement('div');
      
      // Проверяем, есть ли "fullwidth" в имени файла (включая fullwidthRepeat)
      const nameLower = image.name.toLowerCase();
      const isFullwidth = nameLower.includes('fullwidth');
      const isFullwidthRepeat = nameLower.includes('fullwidthrepeat');
      const isLowres = nameLower.includes('lowres');
      const isHighres = nameLower.includes('highres');
      const isImg = isImage(image.name);
      const isVid = isVideo(image.name);
      
      // Если fullwidth, элемент занимает все колонки на всех размерах экрана
      if(isFullwidth){
        wrap.className = 'cursor-pointer col-span-12 w-full';
        wrap.style.width = '100%';
        wrap.style.maxWidth = '100%';
      } else {
        let minSpan = isHighres ? 4 : 2;
        if (isImg || isVid) minSpan = Math.max(3, minSpan);
        const { start, span } = pickRandomGridLayout({
          minSpan,
          maxSpan: isLowres ? 4 : 11,
        });
        wrap.className = 'cursor-pointer col-span-4 project-grid-random flex items-center justify-center';
        wrap.style.setProperty('--gc-start', String(start));
        wrap.style.setProperty('--gc-span', String(span));
      }

      if(isImg){
        const img = document.createElement('img');
        img.alt = image.name;
        img.style.cssText = 'width:100%; height:auto; display:block;';
        
        // Lazy loading для изображений
        if (imageObserver) {
          // Используем placeholder или data-src для lazy loading
          img.dataset.src = image.src;
          // Создаем placeholder (можно использовать blur или прозрачный пиксель)
          img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';
          img.loading = 'lazy'; // Нативный lazy loading как fallback
          imageObserver.observe(img);
        } else {
          // Fallback если Intersection Observer не поддерживается
          img.src = image.src;
          img.loading = 'lazy';
        }
        
        wrap.appendChild(img);
        // Изображения не кликабельны - убрали открытие в viewer
      } else if(isVimeo(image.src || image.name)){
        // Встраивание видео Vimeo - всегда fullwidth с таким же UI как у локальных видео
        const vimeoId = getVimeoId(image.src || image.name);
        if (vimeoId) {
          // Устанавливаем fullwidth для Vimeo видео
          wrap.className = 'cursor-pointer col-span-12 w-full';
          wrap.style.width = '100%';
          wrap.style.maxWidth = '100%';
          
          // Создаем контейнер для Vimeo видео - простой зацикленный автоплей с кнопкой звука
          const vimeoContainer = document.createElement('div');
          vimeoContainer.className = 'relative w-full flex items-center justify-center';
          vimeoContainer.setAttribute('data-vimeo-id', vimeoId);
          vimeoContainer.style.cursor = 'none';
          vimeoContainer.style.pointerEvents = 'auto';
          
          // Создаем невидимый overlay поверх iframe для перехвата событий мыши
          const mouseOverlay = document.createElement('div');
          mouseOverlay.style.cssText = 'position:absolute; inset:0; z-index:1; cursor:none !important; pointer-events:auto;';
          mouseOverlay.style.cursor = 'none';
          
          const iframe = document.createElement('iframe');
          // Простое зацикленное видео с автоплеем, без UI
          // autoplay=1 - проигрываем сразу
          // loop=1 - зацикливаем
          // muted=1 - без звука
          // quality=auto - максимальное качество
          iframe.src = `https://player.vimeo.com/video/${vimeoId}?autoplay=1&loop=1&muted=1&title=0&byline=0&portrait=0&autopause=0&controls=0&background=0&transparent=1&dnt=1&badge=0&quality=auto`;
          iframe.setAttribute('allow', 'autoplay');
          iframe.setAttribute('allowfullscreen', '');
          iframe.setAttribute('frameborder', '0');
          iframe.id = `vimeo-player-${vimeoId}`;
          iframe.style.cssText = 'width:100%; height:auto; aspect-ratio:16/9; border:none; display:block; cursor:none !important; pointer-events:none;';
          iframe.style.cursor = 'none';
          iframe.style.pointerEvents = 'none';
          
          // Иконка звука (правый нижний угол)
          const volumeBtn = document.createElement('div');
          volumeBtn.className = 'video-volume-btn';
          volumeBtn.style.cssText = 'position:absolute; bottom:12px; right:12px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; cursor:pointer; pointer-events:auto; z-index:10; opacity:1; transition:opacity 0.3s;';
          
          let vimeoPlayer = null;
          let isMuted = true;
          let currentVolume = 0;
          
          // Обновление иконки звука
          const updateVolumeIcon = () => {
            if(isMuted || currentVolume === 0) {
              volumeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" style="width:20px; height:20px; fill:#ACACAC;" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
            } else if(currentVolume < 0.5) {
              volumeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" style="width:20px; height:20px; fill:#ACACAC;" viewBox="0 0 24 24"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>';
            } else {
              volumeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" style="width:20px; height:20px; fill:#ACACAC;" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
            }
          };
          
          // Устанавливаем начальную иконку выключенного звука
          updateVolumeIcon();
          
          // Клик на кнопку звука
          volumeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (vimeoPlayer) {
              if(isMuted || currentVolume === 0) {
                vimeoPlayer.setVolume(1).then(() => {
                  currentVolume = 1;
                  isMuted = false;
                  updateVolumeIcon();
                }).catch(() => {});
            } else {
                vimeoPlayer.setVolume(0).then(() => {
                  currentVolume = 0;
                  isMuted = true;
                  updateVolumeIcon();
                }).catch(() => {});
            }
            }
          });
          
          // Инициализация Vimeo Player API для установки максимального качества и управления звуком
          iframe.addEventListener('load', () => {
            if (typeof Vimeo !== 'undefined' && Vimeo.Player) {
              vimeoPlayer = new Vimeo.Player(iframe);
              
              // Устанавливаем максимальное качество видео
              vimeoPlayer.getQualities().then(qualities => {
                if(qualities && qualities.length > 0) {
                  const maxQuality = qualities[qualities.length - 1];
                  vimeoPlayer.setQuality(maxQuality).catch(() => {
                    vimeoPlayer.setQuality('auto').catch(() => {});
                  });
                } else {
                  vimeoPlayer.setQuality('auto').catch(() => {});
                }
              }).catch(() => {
                vimeoPlayer.setQuality('auto').catch(() => {});
              });
            
              // Явно устанавливаем volume = 0 и muted = true при инициализации
              vimeoPlayer.setVolume(0).then(() => {
                currentVolume = 0;
                isMuted = true;
                updateVolumeIcon();
              }).catch(() => {
                // Если не удалось установить, проверяем текущее состояние
                vimeoPlayer.getVolume().then(volume => {
                  currentVolume = volume;
                  isMuted = volume === 0;
                  updateVolumeIcon();
                }).catch(() => {
                  // Если и это не работает, оставляем начальное состояние
                  currentVolume = 0;
                  isMuted = true;
                  updateVolumeIcon();
                });
              });
          
              // Слушаем изменения громкости
              vimeoPlayer.on('volumechange', (data) => {
                currentVolume = data.volume;
                isMuted = data.volume === 0;
                updateVolumeIcon();
              });
            }
          });
          
          // Размещаем элементы: iframe, затем overlay поверх него, затем кнопка звука поверх всего
          vimeoContainer.appendChild(iframe);
          vimeoContainer.appendChild(mouseOverlay);
          vimeoContainer.appendChild(volumeBtn);
          wrap.appendChild(vimeoContainer);
          
          // Убеждаемся, что кнопка звука остается кликабельной (z-index выше overlay)
          volumeBtn.style.zIndex = '20';
          
          // Добавляем обработчики для обновления кастомного курсора над Vimeo контейнером
          const customCursor = document.getElementById('custom-cursor');
          if (customCursor) {
            const updateCursor = (e) => {
              if (customCursor) {
                customCursor.style.left = e.clientX + 'px';
                customCursor.style.top = e.clientY + 'px';
                customCursor.style.opacity = '1';
            }
          };
          
            // Обработчики на overlay для перехвата событий мыши
            mouseOverlay.addEventListener('mousemove', updateCursor);
            mouseOverlay.addEventListener('mouseenter', () => {
              if (customCursor) {
                customCursor.style.opacity = '1';
            }
            });
            
            // Также на контейнере для надежности
            vimeoContainer.addEventListener('mousemove', updateCursor);
            vimeoContainer.addEventListener('mouseenter', () => {
              if (customCursor) {
                customCursor.style.opacity = '1';
              }
            });
          }
          
          // Логирование для отладки
          console.log(`🎬 Vimeo видео загружено (fullwidth, автоплей, зациклено): ID ${vimeoId}, URL: ${image.src || image.name}`);
          
          // Не добавляем в observer - загружаем сразу для быстрого отображения
          
          // Не добавляем в observer - загружаем сразу для быстрого отображения
        }
      } else if(isVid){
        const video = document.createElement('video');
        const source = document.createElement('source');
        
        // Загружаем видео сразу (без lazy loading) для быстрого отображения
        source.src = image.src;
        source.type = 'video/mp4';
        
        video.appendChild(source);
          
        // Если fullwidthRepeat - простое зацикленное видео на всю ширину без плеера
        if(isFullwidthRepeat) {
          console.log(`   🎬 Обработка fullwidthRepeat видео: ${image.name}`);
          video.className = 'w-full h-auto object-contain';
          video.style.cssText = 'width:100%; max-width:100%; height:auto; display:block;';
          video.preload = 'auto'; // Предзагрузка для быстрого отображения
          video.autoplay = true;
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          
          // Добавляем обработчики ошибок для диагностики
          video.addEventListener('error', (e) => {
            console.error(`   ❌ Ошибка загрузки видео ${image.name}:`, e);
            console.error(`   URL: ${image.src}`);
          });
          video.addEventListener('loadeddata', () => {
            console.log(`   ✅ Видео загружено: ${image.name}`);
          });
          
          // Простой контейнер без контролов
          const videoContainer = document.createElement('div');
          videoContainer.className = 'relative w-full';
          videoContainer.appendChild(video);
          wrap.appendChild(videoContainer);
          
          // Не добавляем в observer - загружаем сразу
        }
        // Если fullwidth (но не fullwidthRepeat) - простое зацикленное видео на всю ширину без плеера
        else if(isFullwidth) {
          console.log(`   🎬 Обработка fullwidth видео: ${image.name}`);
          video.className = 'w-full h-auto object-contain';
          video.style.cssText = 'width:100%; max-width:100%; height:auto; display:block;';
          video.preload = 'auto'; // Предзагрузка для быстрого отображения
          video.autoplay = true;
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          
          // Добавляем обработчики ошибок для диагностики
          video.addEventListener('error', (e) => {
            console.error(`   ❌ Ошибка загрузки видео ${image.name}:`, e);
            console.error(`   URL: ${image.src}`);
          });
          video.addEventListener('loadeddata', () => {
            console.log(`   ✅ Видео загружено: ${image.name}`);
          });
          
          // Простой контейнер без контролов
          const videoContainer = document.createElement('div');
          videoContainer.className = 'relative w-full';
          videoContainer.appendChild(video);
          wrap.appendChild(videoContainer);
        
          // Не добавляем в observer - загружаем сразу
        } else {
          // Для обычных видео (не fullwidth) - простое автопроигрывание с зацикливанием
          // Без ограничений по высоте и без серого фона
          video.className = 'w-full h-auto object-contain';
          video.style.cssText = 'width:100%; height:auto; display:block;';
          video.preload = 'auto'; // Предзагрузка для быстрого отображения
          video.autoplay = true;
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          
          // Простой контейнер без контролов и без ограничений
          const videoContainer = document.createElement('div');
          videoContainer.className = 'relative w-full';
          videoContainer.appendChild(video);
          wrap.appendChild(videoContainer);
          
          // Не добавляем в observer - загружаем сразу для быстрого отображения
        }
      } else {
        return; // Пропускаем неизвестные типы файлов
      }

      applyRandomProjectGridVerticalMargin(wrap);
      grid.appendChild(wrap);
    });

    loading.style.display='none';
  }catch(e){
    console.error('Ошибка загрузки проекта:', e);
    loading.textContent='Ошибка загрузки проекта. Проверьте, что папка существует.';
  }
}

// Извлекает номер из имени файла для сортировки
// Новая структура: ProjectName_image_01, ProjectName_video_01, ProjectName_image_fullwidth_01, ProjectName_video_fullwidthRepeat_01
function extractNumber(filename){
  // Ищем паттерны для новой системы названий:
  // ProjectName_image_01, ProjectName_video_01, ProjectName_image_fullwidth_01, ProjectName_video_fullwidthRepeat_01
  const patterns = [
    /_(image|video)_fullwidthRepeat_(\d+)\.(jpg|jpeg|png|gif|webp|mp4|mov|avi|mkv|webm)$/i,  // _video_fullwidthRepeat_01.mp4
    /_(image|video)_fullwidth_(\d+)\.(jpg|jpeg|png|gif|webp|mp4|mov|avi|mkv|webm)$/i,  // _image_fullwidth_01.jpg
    /_(image|video)_(\d+)\.(jpg|jpeg|png|gif|webp|mp4|mov|avi|mkv|webm)$/i,  // _image_01.jpg, _video_01.mp4
    /_(\d+)\.(jpg|jpeg|png|gif|webp|mp4|mov|avi|mkv|webm)$/i,  // _01.jpg (fallback для старой системы)
    /^(\d+)\.(jpg|jpeg|png|gif|webp|mp4|mov|avi|mkv|webm)$/i   // 01.jpg (fallback)
  ];
  
  for(const pattern of patterns){
    const match = filename.match(pattern);
    if(match){
      // Для новых паттернов номер во второй группе, для старых - в первой
      const number = match[2] || match[1];
      if(number){
        return parseInt(number, 10);
      }
    }
  }
  
  // Если номер не найден, возвращаем большое число для сортировки в конец
  return 999999;
}

// Получаем список изображений проекта автоматически из папки
// Сначала проверяет files.json (если есть), затем использует directory listing
async function getProjectImages(projectName, subfolder = '', category = ''){
  // Приводим категорию к правильному регистру (первая буква заглавная)
  const categoryCapitalized = category ? category.charAt(0).toUpperCase() + category.slice(1).toLowerCase() : '';
  const categoryPath = categoryCapitalized ? `${categoryCapitalized}/` : '';
  const isRootFolderProject = (projectName || '').toUpperCase() === 'RND';
  const basePath = isRootFolderProject
    ? `projects/HomeContent`
    : (subfolder
      ? `projects/${categoryPath}${projectName}${subfolder}/images`
      : `projects/${categoryPath}${projectName}/images`);
  
  const foundFiles = [];
  
  // СНАЧАЛА проверяем files.json - это быстрее
  console.log(`🔍 Загрузка файлов проекта: ${projectName}, категория: ${category || 'нет'}`);
  console.log(`   Путь к files.json: ${basePath}/files.json`);
  
  try {
    // Добавляем cache-busting параметр и заголовки для предотвращения кэширования
    const cacheBuster = `?v=${Date.now()}`;
    const response = await fetch(`${basePath}/files.json${cacheBuster}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    console.log(`   Статус ответа files.json: ${response.status} ${response.statusText}`);
    
    if(response.ok){
      const data = await response.json();
      console.log(`   Данные files.json:`, data);
      const jsonFiles = data.files || [];
      
      if(jsonFiles.length > 0){
        console.log(`📋 Найдено ${jsonFiles.length} файлов в files.json`);
        
        // Используем файлы из files.json напрямую
        // Исключаем файлы с "cover" в названии - они используются только как обложки
        // Также исключаем файлы, которые соответствуют паттерну обложки Cover_ProjectName_image_00 или Cover_ProjectName_00
        const escapedProjectName = projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/_/g, '[\\s_]');
        const coverPattern = new RegExp(`^Cover_${escapedProjectName}_image_00|^Cover_${escapedProjectName}_00`, 'i');
        
        for(let i = 0; i < jsonFiles.length; i++){
          const jsonFile = jsonFiles[i];
          // Пропускаем файлы с "cover" в названии или соответствующие паттерну обложки
          if(jsonFile.toLowerCase().includes('cover') || coverPattern.test(jsonFile)){
            console.log(`   ⏭️ Пропущен файл (обложка): ${jsonFile}`);
            continue;
          }
          
          // Проверяем, является ли это Vimeo ссылкой
          if(isVimeo(jsonFile)){
            // Для Vimeo ссылок используем исходный URL как src
            console.log(`   🎬 Добавлено Vimeo видео: ${jsonFile}`);
            foundFiles.push({
              name: jsonFile,
              src: jsonFile, // Используем исходный URL
              number: -1, // Vimeo видео идут первыми (отрицательное число для приоритета)
              originalIndex: i // Сохраняем исходный индекс для сохранения порядка
            });
            continue;
          }
          
          // Для обычных файлов формируем путь
          const encodedFile = encodeURIComponent(jsonFile).replace(/'/g, '%27');
          const fileSrc = `${basePath}/${encodedFile}`;
          console.log(`   ✅ Добавлен файл: ${jsonFile} -> ${fileSrc}`);
          foundFiles.push({
            name: jsonFile,
            src: fileSrc,
            number: extractNumber(jsonFile),
            originalIndex: i // Сохраняем исходный индекс для сохранения порядка
          });
        }
        
        // Если нашли файлы через files.json, используем их
        if(foundFiles.length > 0){
          // Сортируем файлы: сначала Vimeo видео (сохраняя их порядок из files.json), потом остальные (сохраняя их порядок)
          foundFiles.sort((a, b) => {
            const aIsVimeo = isVimeo(a.name);
            const bIsVimeo = isVimeo(b.name);
            
            // Vimeo видео идут первыми, сохраняем их порядок из files.json
            if(aIsVimeo && !bIsVimeo) return -1;
            if(!aIsVimeo && bIsVimeo) return 1;
            if(aIsVimeo && bIsVimeo) return a.originalIndex - b.originalIndex;
            
            const aIsFullwidthVideo = (a.name.toLowerCase().includes('fullwidth') || a.name.toLowerCase().includes('fullwidthrepeat')) && isVideo(a.name);
            const bIsFullwidthVideo = (b.name.toLowerCase().includes('fullwidth') || b.name.toLowerCase().includes('fullwidthrepeat')) && isVideo(b.name);
            
            // Fullwidth видео идут после Vimeo
            if(aIsFullwidthVideo && !bIsFullwidthVideo) return -1;
            if(!aIsFullwidthVideo && bIsFullwidthVideo) return 1;
            
            // Если оба fullwidth видео или оба не fullwidth видео, сохраняем порядок из files.json
            return a.originalIndex - b.originalIndex;
          });
          console.log(`✅ Найдено ${foundFiles.length} файлов для проекта ${projectName}:`, foundFiles.map(f => f.name));
          return foundFiles;
        }
      }
    }
  } catch(e) {
    // files.json не найден - это нормально, будем использовать directory listing
    console.error(`   ❌ Ошибка загрузки files.json:`, e);
  }
  
  // Если files.json нет или пуст, используем directory listing для автоматического обнаружения файлов
  try {
    console.log(`📂 Автоматическое обнаружение файлов из папки...`);
    const dirResponse = await fetch(`${basePath}/`);
    
    if(dirResponse.ok){
      const html = await dirResponse.text();
      
      // Парсим HTML directory listing для извлечения списка файлов
      // Ищем ссылки на файлы (обычно в <a> тегах)
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const links = doc.querySelectorAll('a');
      
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
      const allExtensions = [...imageExtensions, ...videoExtensions];
      
      for(const link of links){
        let href = link.getAttribute('href');
        if(!href || href === '../' || href === './' || href.includes('?')) continue;
        
        // Декодируем URL (пробелы могут быть закодированы как %20)
        try {
          href = decodeURIComponent(href);
        } catch(e) {
          // Если декодирование не удалось, используем исходное значение
        }
        
        // Убираем слеш в конце, если есть
        let filename = href.replace(/\/$/, '');
        
        // Пропускаем пустые имена и родительские директории
        if(!filename || filename === '..' || filename === '.') continue;
        
        // Пропускаем files.json и служебные файлы
        if(filename === 'files.json' || filename.startsWith('.')) continue;
        
        // Пропускаем файлы с "cover" в названии
        if(filename.toLowerCase().includes('cover')) continue;
        
        // Проверяем расширение файла (должно быть хотя бы одна точка)
        const lastDot = filename.lastIndexOf('.');
        if(lastDot === -1 || lastDot === 0) continue; // Нет расширения или файл начинается с точки
        
        const ext = filename.substring(lastDot).toLowerCase();
        if(!allExtensions.includes(ext)) continue;
        
        // Проверяем, что файл существует (не директория)
        // В directory listing обычно директории заканчиваются на /
        // Также проверяем текст ссылки - директории часто имеют отличительные признаки
        const linkText = link.textContent.trim();
        if(!href.endsWith('/') && linkText !== '../' && linkText !== './'){
          // Используем исходный href для src (может быть закодирован)
          const originalHref = link.getAttribute('href');
          foundFiles.push({
            name: filename,
            src: `${basePath}/${originalHref}`,
            number: extractNumber(filename)
          });
        }
      }
      
      if(foundFiles.length > 0){
        // Сортируем файлы: сначала fullwidth видео (включая fullwidthRepeat), потом остальные
        foundFiles.sort((a, b) => {
          const aIsFullwidthVideo = (a.name.toLowerCase().includes('fullwidth') || a.name.toLowerCase().includes('fullwidthrepeat')) && isVideo(a.name);
          const bIsFullwidthVideo = (b.name.toLowerCase().includes('fullwidth') || b.name.toLowerCase().includes('fullwidthrepeat')) && isVideo(b.name);
          
          // Fullwidth видео идут первыми
          if(aIsFullwidthVideo && !bIsFullwidthVideo) return -1;
          if(!aIsFullwidthVideo && bIsFullwidthVideo) return 1;
          
          // Если оба fullwidth видео или оба не fullwidth видео, сортируем по номеру
          return a.number - b.number;
        });
        console.log(`✅ Автоматически найдено ${foundFiles.length} файлов для проекта ${projectName}:`, foundFiles.map(f => f.name));
        return foundFiles;
      }
    }
  } catch(e) {
    console.error('Ошибка при автоматическом обнаружении файлов:', e);
  }
  
  // Если ничего не нашли
  if(foundFiles.length === 0){
    console.warn(`⚠️ Файлы не найдены для проекта ${projectName}`);
  }
  
  return foundFiles;
}

// =============== ПРОСМОТРЩИК ===============
async function openViewer(index){
  currentIndex=index;
  viewerOverlay.classList.remove('hidden');
  document.addEventListener('keydown', handleViewerKey);
  await renderViewer();
}

async function renderViewer(){
  const item=currentItems[currentIndex]; 
  if(!item) return;
  viewerContent.innerHTML='';

  if(item.type==='image'){
    const img=document.createElement('img');
    img.src=item.src;
    img.style.maxWidth='70%';
    img.style.maxHeight='70%';
    img.style.objectFit='contain';
    viewerContent.appendChild(img);
  }else{
    const v=document.createElement('video');
    v.controls=true; 
    v.autoplay=true;
    v.src=item.src;
    v.style.width='70%'; 
    v.style.height='70%'; 
    v.style.objectFit='contain';
    viewerContent.appendChild(v);
  }
}

function closeViewer(){
  viewerOverlay.classList.add('hidden');
  viewerContent.innerHTML='';
  document.removeEventListener('keydown', handleViewerKey);
}

function handleViewerKey(e){
  if(e.key==='Escape') closeViewer();
  else if(e.key==='ArrowRight' && currentIndex<currentItems.length-1){ 
    currentIndex++; 
    renderViewer(); 
  }
  else if(e.key==='ArrowLeft' && currentIndex>0){ 
    currentIndex--; 
    renderViewer(); 
  }
}

viewerOverlay.addEventListener('click',(e)=>{ 
  if(e.target===viewerOverlay) closeViewer(); 
});

// Загрузка описания проекта
async function loadProjectDescription() {
  try {
    // Добавляем cache-busting параметр для предотвращения кэширования
    const cacheBuster = `?v=${Date.now()}`;
    const response = await fetch(`js/projects.json${cacheBuster}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    if(response.ok) {
      const data = await response.json();
      const project = data.projects.find(p => p.name === projectName);
      
      if(project && project.description && project.description.trim() !== '') {
        // Используем описание из JSON, если оно есть
        projectDescription.textContent = project.description;
      } else {
        // Используем случайный текст, если описание пустое
        projectDescription.textContent = generateRandomDescription();
      }
    } else {
      // Если не удалось загрузить JSON, используем случайный текст
      projectDescription.textContent = generateRandomDescription();
    }
  } catch(e) {
    // В случае ошибки используем случайный текст
    projectDescription.textContent = generateRandomDescription();
  }
  
  // Показываем описание
  projectDescription.style.display = 'block';
}

// Инициализация
document.addEventListener('DOMContentLoaded', ()=>{
  // Инициализируем lazy loading
  initLazyLoading();
  
  if(!projectName){
    loading.textContent='Проект не указан. Вернитесь на главную страницу.';
    return;
  }
  
  // Загружаем информацию о проекте из projects.json для получения правильного title
  async function setProjectTitle() {
    try {
      const cacheBuster = `?v=${Date.now()}`;
      const response = await fetch(`js/projects.json${cacheBuster}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if(response.ok) {
        const data = await response.json();
        const project = data.projects.find(p => p.name === projectName);
        if(project && project.title) {
          projectTitle.textContent = project.title;
          document.title = project.title;
          projectTitle.style.display = 'block'; // Показываем заголовок после загрузки
          return;
        }
      }
    } catch(e) {
      console.warn('Не удалось загрузить projects.json, используем название из URL');
    }
    // Fallback: используем название из URL
    projectTitle.textContent = projectName.replace(/_/g, ' ');
    document.title = projectName.replace(/_/g, ' ');
    projectTitle.style.display = 'block'; // Показываем заголовок после загрузки
  }
  
  // Устанавливаем заголовок
  setProjectTitle();
  
  // Ссылка "Step Back" ведет на страницу категории
  const stepBackLink = document.getElementById('step-back-link');
  if(stepBackLink) {
    if(projectCategory) {
      stepBackLink.href = `index.html?category=${encodeURIComponent(projectCategory)}`;
    } else {
      stepBackLink.href = 'index.html';
    }
  }
  
  // Показываем breadcrumb сразу при загрузке страницы
  breadcrumb.style.display = 'flex';
  renderBreadcrumb(projectName, '');
  
  // Загружаем описание проекта
  loadProjectDescription();
  
  // Загружаем контент проекта
  loadProject(projectName);
});
