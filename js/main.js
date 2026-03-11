// Главная страница - работа с локальными файлами
let currentSection = 'home';
// Делаем currentSection доступной глобально для drawing.js
window.currentSection = currentSection;

const grid = document.getElementById('file-grid');
const loading = document.getElementById('loading');
const breadcrumb = document.getElementById('breadcrumb');
const viewerOverlay = document.getElementById('viewerOverlay');
const viewerContent = document.getElementById('viewerContent');
const projectsList = document.getElementById('projects-list');
const homeProjectNamesContainer = document.getElementById('home-project-names');
const homeContentContainer = document.getElementById('home-content-container');
const homeContentItem = document.getElementById('home-content-item');

// Текущие элементы
let currentItems = [];
let currentIndex = 0;

// =============== АНИМАЦИЯ ФОНА ===============
let backgroundAnimationFrame = null;
let backgroundAnimationStartTime = null;
let backgroundAnimationDuration = 0;
let backgroundHoverTimer = null;
let isBackgroundAnimating = false;
let isBackgroundReturning = false;
let backgroundReturnStartTime = null;
let backgroundReturnStartColor = null;
let currentAnimationStartColor = null; // Начальный цвет текущей анимации
let currentAnimationEndColor = null; // Конечный цвет текущей анимации
let isHovering = false; // флаг, что курсор на логотипе
const BACKGROUND_COLOR_START = { r: 250, g: 250, b: 250 }; // #FAFAFA
const BACKGROUND_COLOR_END = { r: 15, g: 15, b: 15 }; // #0F0F0F
const BACKGROUND_RETURN_DURATION = 3000; // 3 секунды для возврата

// =============== ВСПОМОГАТЕЛЬНОЕ ===============
const isImage = (name) => /\.(jpe?g|png|gif|webp)$/i.test(name);
const isVideo = (name) => /\.(mp4|mov|avi|mkv|webm)$/i.test(name);
const isVimeo = (name) => /^vimeo:/i.test(name) || /vimeo\.com/i.test(name);

// =============== НАСТРОЙКИ ОБЛОЖЕК ===============
// Доступные стили:
//   'minimal'     - Минималистичный: текст снизу слева на белом фоне, без оверлея
//   'classic'     - Классический: полупрозрачный черный оверлей, белый текст по центру
//   'gradient'    - Градиент: градиентный оверлей снизу, текст внизу слева
//   'image-only'  - Только изображение: без текста на обложке
const PROJECT_COVER_STYLE = 'image-only'; // Измените здесь стиль обложек

// Функция getRandomColor() удалена - больше не используем placeholder'ы с серыми обложками

// =============== ЗАГРУЗКА ПРОЕКТОВ ===============
// Кэш для обложек проектов
const projectCoversCache = new Map();

async function loadProjects(category = null){
  try{
    projectsList.innerHTML = '';
    
    // Загружаем список проектов из папки projects/
    // В реальности это будет список папок из projects/
    // Для статического сайта используем конфигурацию
    
    let projects = await getProjectsList();
    
    // Фильтруем по категории, если указана
    if (category) {
      projects = projects.filter(p => p.category && p.category.toLowerCase() === category.toLowerCase());
    } else {
      // Для главной страницы берём только проекты категорий Mind и Commerce
      projects = projects.filter(p => p.category && ['mind', 'commerce'].includes(p.category.toLowerCase()));
    }
    
    if(projects.length === 0){
      projectsList.innerHTML = '<div class="col-span-12 text-center text-gray-400">Проекты не найдены</div>';
      return;
    }

    // Загружаем все обложки параллельно
    const coverPromises = projects.map(project => 
      getCoverImageFromProject(project.name, project.category)
    );
    const coverInfos = await Promise.all(coverPromises);
    
    // Предзагружаем все изображения обложек
    const preloadPromises = [];
    coverInfos.forEach((coverInfo, index) => {
      if (coverInfo.url) {
        const img = new Image();
        img.src = coverInfo.url;
        preloadPromises.push(new Promise((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve(); // Продолжаем даже при ошибке
        }));
      }
    });
    
    // Показываем проекты сразу, не дожидаясь полной загрузки всех изображений
    projects.forEach((project, index) => {
      const coverInfo = coverInfos[index];
      const previewUrl = coverInfo.url;
      const coverFileName = coverInfo.filename;
      
      // Пропускаем проекты без обложки
      if(!previewUrl) {
        console.warn(`Пропущен проект ${project.name} - обложка не найдена`);
        return;
      }
      
      const projectCard = document.createElement('a');
      // Передаем категорию в URL
      const categoryParam = project.category ? `&category=${encodeURIComponent(project.category)}` : '';
      projectCard.href = `project.html?project=${encodeURIComponent(project.name)}${categoryParam}`;
      projectCard.className = 'col-span-4 sm:col-span-4 md:col-span-4 cursor-pointer';
      
      // Используем title из projects.json, если он есть, иначе извлекаем из имени файла
      let projectTitleFromCover = project.title || project.name.replace(/_/g, ' ');
      // Если title есть в projects.json, используем его (он уже содержит правильные символы, включая апостроф)
      if(!project.title && coverFileName) {
        // Парсим название из имени файла только если title не указан в projects.json
        // cover_ProjectName_00.ext, Cover_Project Name_01.ext, cover_Project Name_01.ext
        const coverMatch = coverFileName.match(/^[Cc]over[_-](.+?)[_-]\d+\./i);
        if(coverMatch && coverMatch[1]) {
          projectTitleFromCover = coverMatch[1].replace(/_/g, ' ').trim();
        }
      }
      
      // Определяем, показывать ли текст на обложке
      const showTitle = PROJECT_COVER_STYLE !== 'image-only';
      
      projectCard.innerHTML = `
        <div class="project-card project-cover-style-${PROJECT_COVER_STYLE}">
          <div class="project-cover-container">
            <img src="${previewUrl}" alt="${projectTitleFromCover}" class="project-cover-image" 
                 loading="eager"
                 onerror="console.error('❌ Ошибка загрузки обложки:', '${previewUrl}'); this.style.display='none';"
                 onload="console.log('✅ Обложка загружена:', '${previewUrl}');">
            ${showTitle ? `
              <div class="project-cover-overlay">
                <h3 class="project-cover-title">${projectTitleFromCover}</h3>
              </div>
            ` : ''}
            </div>
        </div>
      `;
      
      projectsList.appendChild(projectCard);
    });
    
    // Ждём завершения предзагрузки в фоне (не блокируем отображение)
    Promise.all(preloadPromises).then(() => {
      console.log('✅ Все обложки предзагружены');
    });
  }catch(e){
    console.error('Ошибка загрузки проектов:', e);
    projectsList.innerHTML = '<div class="col-span-12 text-center text-gray-400">Ошибка загрузки проектов</div>';
  }
}

// Получаем список проектов
async function getProjectsList(){
  // Загружаем из JSON файла
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
    if(response.ok){
      const data = await response.json();
      return data.projects || [];
    }
  } catch(e) {
    console.error('Ошибка загрузки projects.json:', e);
  }
  
  // Последний fallback
  return [
    { name: 'Poool_Angry_Masseur', title: 'Poool Angry Masseur' }
  ];
}

// Получаем обложку проекта (изображение с "cover" в названии)
async function getCoverImageFromProject(projectName, category = null){
  // Создаём ключ для кэша
  const cacheKey = `${category || ''}_${projectName}`;
  
  // Проверяем кэш
  if (projectCoversCache.has(cacheKey)) {
    return projectCoversCache.get(cacheKey);
  }
  
  // Приводим категорию к правильному регистру (первая буква заглавная)
  const categoryCapitalized = category ? category.charAt(0).toUpperCase() + category.slice(1).toLowerCase() : '';
  const categoryPath = categoryCapitalized ? `${categoryCapitalized}/` : '';
  const basePath = `projects/${categoryPath}${projectName}/images`;
  
  // Проверяем files.json для получения обложки
  console.log(`🔍 Поиск обложки для проекта: ${projectName}, категория: ${category || 'нет'}`);
  console.log(`   Путь к files.json: ${basePath}/files.json`);
  
  try {
    // Используем кэш браузера для files.json (убрали cache-busting для ускорения)
    const filesResponse = await fetch(`${basePath}/files.json`, {
      cache: 'force-cache' // Используем кэш браузера
    });
    console.log(`   Статус ответа files.json: ${filesResponse.status} ${filesResponse.statusText}`);
    
    if(filesResponse.ok) {
      const filesData = await filesResponse.json();
      console.log(`   Данные files.json:`, filesData);
      
      // Используем поле cover из files.json, если оно есть
      if(filesData.cover) {
        // Правильно кодируем имя файла для URL (пробелы и специальные символы)
        const encodedCover = encodeURIComponent(filesData.cover).replace(/'/g, '%27');
        const coverUrl = `${basePath}/${encodedCover}`;
        console.log(`   📋 Найдена обложка в files.json: ${filesData.cover} -> ${coverUrl}`);
        const result = {
          url: coverUrl,
          filename: filesData.cover
        };
        // Сохраняем в кэш
        projectCoversCache.set(cacheKey, result);
        return result;
      }
      
      // Fallback: ищем в списке files (для обратной совместимости)
      // Ищем файл по паттерну Cover_ProjectName_image_00 или Cover_ProjectName_00
      // Также поддерживаем старые названия с "cover" в середине
      const files = filesData.files || [];
      // Экранируем специальные символы в имени проекта для regex
      const escapedProjectName = projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/_/g, '[\\s_]');
      const coverPattern = new RegExp(`^Cover_${escapedProjectName}_image_00|^Cover_${escapedProjectName}_00`, 'i');
      const coverFile = files.find(file => {
        const isImage = /\.(jpe?g|png|gif|webp)$/i.test(file);
        // Проверяем новый паттерн или fallback на старый (для обратной совместимости)
        return isImage && (coverPattern.test(file) || file.toLowerCase().includes('cover'));
      });
      
      if(coverFile) {
        // Правильно кодируем имя файла для URL
        const encodedCover = encodeURIComponent(coverFile).replace(/'/g, '%27');
        const result = {
          url: `${basePath}/${encodedCover}`,
          filename: coverFile
        };
        // Сохраняем в кэш
        projectCoversCache.set(cacheKey, result);
        return result;
      }
    }
  } catch(e) {
    // Если files.json не найден, возвращаем пустую строку
    console.error(`   ❌ Ошибка загрузки files.json для проекта ${projectName}:`, e);
  }
  
  const emptyResult = { url: '', filename: '' };
  // Сохраняем пустой результат в кэш, чтобы не запрашивать повторно
  projectCoversCache.set(cacheKey, emptyResult);
  return emptyResult;
}

// Получаем первое изображение из проекта (для обратной совместимости)
async function getFirstImageFromProject(projectName, category = null){
  const coverInfo = await getCoverImageFromProject(projectName, category);
  return coverInfo.url;
}

// =============== ДЕСКТОП: ПЛАВАЮЩИЕ НАЗВАНИЯ ПРОЕКТОВ НА ГЛАВНОЙ ===============
const DESKTOP_NAMES_PADDING = 24;
const DESKTOP_NAMES_SPEED_MIN = 0.3;
const DESKTOP_NAMES_SPEED_MAX = 0.8;
const DESKTOP_NAMES_HOVER_SLOW = 0.45;
const DESKTOP_NAMES_HOVER_CHANCE = 0.85;
const DESKTOP_NAMES_RUN_CHANCE = 0.25;
const DESKTOP_NAMES_RUN_MULT = 7.2;
const DESKTOP_NAMES_RUN_ZONE = 200; /* радиус зоны (px): внутри неё название плавно ускоряется от курсора */
const DESKTOP_NAMES_RUN_SMOOTH = 0.06; /* плавность подстройки скорости (0.05–0.15) */
let desktopHomeNamesAnimationId = null;
let desktopHomeItems = [];
let desktopHomeMouseX = -1e4;
let desktopHomeMouseY = -1e4;

function desktopHomeMouseMove(e) {
  desktopHomeMouseX = e.clientX;
  desktopHomeMouseY = e.clientY;
}

function getRandomInRange(min, max) {
  return min + Math.random() * (max - min);
}

function getRandomSign() {
  return Math.random() < 0.5 ? -1 : 1;
}

async function getProjectsForDesktopHome() {
  const projects = await getProjectsList();
  const filtered = projects.filter(p => p.category && ['mind', 'commerce'].includes(p.category.toLowerCase()));
  return filtered.map(p => {
    const title = p.title || p.name.replace(/_/g, ' ');
    const categoryParam = p.category ? `&category=${encodeURIComponent(p.category)}` : '';
    const href = `project.html?project=${encodeURIComponent(p.name)}${categoryParam}`;
    return { title, href };
  });
}

function createDesktopHomeNames() {
  if (!homeProjectNamesContainer) return;
  homeProjectNamesContainer.innerHTML = '';
  desktopHomeItems = [];
  const w = window.innerWidth;
  const h = window.innerHeight;
  getProjectsForDesktopHome().then(projects => {
    if (!homeProjectNamesContainer || !document.body.classList.contains('home-page')) return;
    projects.forEach(({ title, href }) => {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = title;
      a.className = 'home-project-name-link';
      a.dataset.href = href;
      const itemW = 120;
      const itemH = 24;
      const x = getRandomInRange(DESKTOP_NAMES_PADDING, Math.max(DESKTOP_NAMES_PADDING, w - itemW - DESKTOP_NAMES_PADDING));
      const y = getRandomInRange(DESKTOP_NAMES_PADDING, Math.max(DESKTOP_NAMES_PADDING, h - itemH - DESKTOP_NAMES_PADDING));
      const vx = getRandomInRange(DESKTOP_NAMES_SPEED_MIN, DESKTOP_NAMES_SPEED_MAX) * getRandomSign();
      const vy = getRandomInRange(DESKTOP_NAMES_SPEED_MIN, DESKTOP_NAMES_SPEED_MAX) * getRandomSign();
      const item = { el: a, x, y, vx, vy, w: itemW, h: itemH, slowDown: false };
      desktopHomeItems.push(item);
      a.style.left = x + 'px';
      a.style.top = y + 'px';
      a.addEventListener('mouseenter', () => {
        const r = Math.random();
        if (r < DESKTOP_NAMES_HOVER_CHANCE) {
          item.slowDown = true;
        }
      });
      a.addEventListener('mouseleave', () => { item.slowDown = false; });
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const url = a.dataset.href || a.getAttribute('href');
        // Плавно скрываем все названия одновременно
        desktopHomeItems.forEach(it => {
          it.el.style.transition = 'opacity 0.4s ease';
          it.el.style.opacity = '0';
        });
        setTimeout(() => {
          try { sessionStorage.setItem('fadeInProject', '1'); } catch (_) {}
          window.location.href = url;
        }, 420);
      });
      homeProjectNamesContainer.appendChild(a);
    });
    document.addEventListener('mousemove', desktopHomeMouseMove);
    requestAnimationFrame(measureAndAnimateDesktopNames);
  });
}

function measureAndAnimateDesktopNames() {
  desktopHomeItems.forEach(item => {
    const rect = item.el.getBoundingClientRect();
    item.w = rect.width;
    item.h = rect.height;
  });
  startDesktopHomeNamesAnimation();
}

function startDesktopHomeNamesAnimation() {
  if (desktopHomeNamesAnimationId != null) return;
  const padding = DESKTOP_NAMES_PADDING;
  function tick() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    for (let i = 0; i < desktopHomeItems.length; i++) {
      const it = desktopHomeItems[i];
      let vx = it.vx;
      let vy = it.vy;
      if (it.slowDown) {
        vx *= DESKTOP_NAMES_HOVER_SLOW;
        vy *= DESKTOP_NAMES_HOVER_SLOW;
      }
      /* Зона убегания: плавное ускорение от курсора в зависимости от близости */
      const cx = it.x + it.w / 2;
      const cy = it.y + it.h / 2;
      const dx = cx - desktopHomeMouseX;
      const dy = cy - desktopHomeMouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < DESKTOP_NAMES_RUN_ZONE && dist > 2) {
        const influence = 1 - dist / DESKTOP_NAMES_RUN_ZONE;
        const invLen = 1 / dist;
        const dirX = dx * invLen;
        const dirY = dy * invLen;
        const runSpeed = DESKTOP_NAMES_SPEED_MIN * DESKTOP_NAMES_RUN_MULT * influence;
        const blend = DESKTOP_NAMES_RUN_SMOOTH * influence;
        vx += (dirX * runSpeed - vx) * blend;
        vy += (dirY * runSpeed - vy) * blend;
      }
      it.vx = vx;
      it.vy = vy;
      it.x += vx;
      it.y += vy;
      if (it.x <= padding) { it.x = padding; it.vx = Math.abs(it.vx); }
      if (it.x + it.w >= W - padding) { it.x = W - padding - it.w; it.vx = -Math.abs(it.vx); }
      if (it.y <= padding) { it.y = padding; it.vy = Math.abs(it.vy); }
      if (it.y + it.h >= H - padding) { it.y = H - padding - it.h; it.vy = -Math.abs(it.vy); }
      it.el.style.left = it.x + 'px';
      it.el.style.top = it.y + 'px';
      for (let j = i + 1; j < desktopHomeItems.length; j++) {
        const jt = desktopHomeItems[j];
        const dx = (it.x + it.w / 2) - (jt.x + jt.w / 2);
        const dy = (it.y + it.h / 2) - (jt.y + jt.h / 2);
        const gapX = it.w / 2 + jt.w / 2 + 8;
        const gapY = it.h / 2 + jt.h / 2 + 4;
        if (Math.abs(dx) < gapX && Math.abs(dy) < gapY) {
          if (Math.abs(dx) > Math.abs(dy)) {
            it.vx = -it.vx;
            jt.vx = -jt.vx;
            const overlap = gapX - Math.abs(dx);
            it.x += (dx > 0 ? 1 : -1) * overlap / 2;
            jt.x -= (dx > 0 ? 1 : -1) * overlap / 2;
          } else {
            it.vy = -it.vy;
            jt.vy = -jt.vy;
            const overlap = gapY - Math.abs(dy);
            it.y += (dy > 0 ? 1 : -1) * overlap / 2;
            jt.y -= (dy > 0 ? 1 : -1) * overlap / 2;
          }
        }
      }
    }
    desktopHomeNamesAnimationId = requestAnimationFrame(tick);
  }
  tick();
}

function stopDesktopHomeNamesAnimation() {
  if (desktopHomeNamesAnimationId != null) {
    cancelAnimationFrame(desktopHomeNamesAnimationId);
    desktopHomeNamesAnimationId = null;
  }
  document.removeEventListener('mousemove', desktopHomeMouseMove);
}

// =============== HOME CONTENT ===============
let homeContentFiles = [];
let homeContentIndex = 0;
let homeContentInterval = null;
let currentVideoElement = null;
let currentVideoStopTimeout = null;
let preloadedImages = new Map(); // Кэш предзагруженных изображений
let preloadedVideos = new Map(); // Кэш предзагруженных видео

// Загрузка файлов из HomeContent
async function loadHomeContent() {
  try {
    const basePath = 'projects/HomeContent';
    
    // Загружаем files.json
    const cacheBuster = `?v=${Date.now()}`;
    const filesResponse = await fetch(`${basePath}/files.json${cacheBuster}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
    if (!filesResponse.ok) {
      console.warn('files.json не найден в HomeContent');
      homeContentContainer?.style && (homeContentContainer.style.display = 'none');
      return;
    }
    
    const filesData = await filesResponse.json();
    const files = filesData.files || [];
    
    if (files.length === 0) {
      console.warn('Нет файлов в files.json');
      homeContentContainer?.style && (homeContentContainer.style.display = 'none');
      return;
    }
    
    // Сортируем файлы по имени для правильного порядка
    files.sort();
    
    // Проверяем, мобильное ли устройство
    const isMobile = window.innerWidth <= 639;
    
    // Создаем список файлов с типами
    homeContentFiles = [];
    for (const file of files) {
      // Определяем тип файла
      let fileType;
      if (isImage(file)) {
        fileType = 'image';
      } else if (isVimeo(file)) {
        fileType = 'vimeo';
      } else if (isVideo(file)) {
        fileType = 'video';
      } else {
        continue; // Пропускаем неизвестные типы
      }
      
      homeContentFiles.push({
        path: isVimeo(file) ? file : `${basePath}/${file}`, // Для Vimeo используем URL напрямую
        type: fileType,
        name: file
      });
    }
    
    console.log(`Загружено ${homeContentFiles.length} файлов из HomeContent`);
    
    // Сначала предзагружаем все элементы для быстрой смены
    try {
      preloadAllHomeContent();
      
      // Ждем немного, чтобы началась предзагрузка, затем перемешиваем
      setTimeout(() => {
        // Перемешиваем файлы случайным образом (Fisher-Yates shuffle) ПОСЛЕ начала предзагрузки
        for (let i = homeContentFiles.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [homeContentFiles[i], homeContentFiles[j]] = [homeContentFiles[j], homeContentFiles[i]];
        }
        
        console.log(`Файлы перемешаны случайным образом`);
        
        // Запускаем ротацию после перемешивания
        startHomeContentRotation();
      }, 100); // Небольшая задержка для начала предзагрузки
    } catch (e) {
      console.error('Ошибка предзагрузки или запуска HomeContent:', e);
      homeContentContainer?.style && (homeContentContainer.style.display = 'none');
    }
  } catch (e) {
    console.error('Ошибка загрузки HomeContent:', e);
    homeContentContainer?.style && (homeContentContainer.style.display = 'none');
    // Не блокируем выполнение остального кода
  }
}

// Предзагрузка всех элементов HomeContent
function preloadAllHomeContent() {
  // Проверяем, мобильное ли устройство
  const isMobile = window.innerWidth <= 639;
  
  homeContentFiles.forEach((item, index) => {
    if (item.type === 'image') {
      // Предзагружаем изображение
      if (!preloadedImages.has(item.path)) {
        const img = new Image();
        img.src = item.path;
        preloadedImages.set(item.path, img);
      }
    } else if (item.type === 'vimeo') {
      // Предзагружаем Vimeo видео - создаем iframe заранее для быстрой загрузки
      const getVimeoId = (url) => {
        const match = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/|^vimeo:)(\d+)/i) || url.match(/^(\d+)$/);
        return match ? match[1] : null;
      };
      
      const vimeoId = getVimeoId(item.path);
      if (vimeoId) {
        // Создаем скрытый iframe для предзагрузки
        const preloadIframe = document.createElement('iframe');
        preloadIframe.src = `https://player.vimeo.com/video/${vimeoId}?autoplay=0&loop=1&muted=1&title=0&byline=0&portrait=0&autopause=0&controls=0&background=0&transparent=1&dnt=1&badge=0&quality=auto`;
        preloadIframe.style.cssText = 'position:absolute; width:1px; height:1px; opacity:0; pointer-events:none;';
        preloadIframe.style.display = 'none';
        document.body.appendChild(preloadIframe);
        
        console.log(`📥 Начата предзагрузка Vimeo видео: ${item.path} (ID: ${vimeoId})`);
        
        // Сохраняем информацию о предзагруженном Vimeo с флагом готовности
        if (!preloadedVideos.has(item.path)) {
          const vimeoData = { 
            type: 'vimeo', 
            iframe: preloadIframe, 
            id: vimeoId,
            ready: false // Флаг готовности видео
          };
          
          // Проверяем готовность видео через Vimeo Player API
          preloadIframe.addEventListener('load', () => {
            if (typeof Vimeo !== 'undefined' && Vimeo.Player) {
              const vimeoPlayer = new Vimeo.Player(preloadIframe);
              
              // Устанавливаем максимальное качество
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
              
              // Слушаем событие готовности видео к воспроизведению
              vimeoPlayer.on('play', () => {
                vimeoData.ready = true;
                console.log(`✅ Vimeo видео готово к воспроизведению: ${item.path}`);
              });
              
              // Также проверяем через loaded
              vimeoPlayer.on('loaded', () => {
                vimeoData.ready = true;
                console.log(`✅ Vimeo видео загружено: ${item.path}`);
              });
              
              // Проверяем готовность через canplay
              vimeoPlayer.on('playbackratechange', () => {
                if (!vimeoData.ready) {
                  vimeoData.ready = true;
                  console.log(`✅ Vimeo видео готово (playbackratechange): ${item.path}`);
                }
              });
              
              // Пытаемся получить длительность видео - это означает, что оно загружено
              vimeoPlayer.getDuration().then((duration) => {
                if (duration > 0 && !vimeoData.ready) {
                  vimeoData.ready = true;
                  console.log(`✅ Vimeo видео готово (getDuration): ${item.path}`);
                }
              }).catch(() => {
                // Если не удалось получить длительность сразу, пробуем через время
                setTimeout(() => {
                  vimeoPlayer.getDuration().then((duration) => {
                    if (duration > 0 && !vimeoData.ready) {
                      vimeoData.ready = true;
                      console.log(`✅ Vimeo видео готово (getDuration delayed): ${item.path}`);
                    }
                  }).catch(() => {});
                }, 2000);
              });
              
              // Пытаемся начать воспроизведение для проверки готовности (после небольшой задержки)
              setTimeout(() => {
                vimeoPlayer.play().then(() => {
                  if (!vimeoData.ready) {
                    vimeoData.ready = true;
                    console.log(`✅ Vimeo видео готово (play): ${item.path}`);
                  }
                  // Сразу останавливаем
                  vimeoPlayer.pause().catch(() => {});
                }).catch(() => {
                  // Если не удалось воспроизвести, это нормально - видео может быть еще не готово
                });
              }, 1000);
              
              // Устанавливаем volume = 0
              vimeoPlayer.setVolume(0).catch(() => {});
            }
          });
          
          preloadedVideos.set(item.path, vimeoData);
        }
      }
    } else if (item.type === 'video') {
      // Предзагружаем все видео полностью, особенно на мобильных
      if (!preloadedVideos.has(item.path)) {
        const video = document.createElement('video');
        video.src = item.path;
        // Всегда используем 'auto' для полной предзагрузки на всех устройствах
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.setAttribute('x5-playsinline', 'true');
        video.setAttribute('x5-video-player-type', 'h5');
        
        // Агрессивная предзагрузка через fetch для мобильных
        // Загружаем файл полностью для кэширования
        if (isMobile) {
          fetch(item.path, {
            method: 'GET',
            cache: 'force-cache',
            headers: {
              'Range': 'bytes=0-'
            }
          }).then(response => {
            if (response.ok) {
              console.log(`📥 Начата предзагрузка видео на мобильном: ${item.path}`);
            }
          }).catch(() => {
            // Игнорируем ошибки, это не критично
          });
        }
        
        // Начинаем загрузку сразу
        video.load();
        
        // Принудительно начинаем буферизацию
        video.addEventListener('loadedmetadata', () => {
          // Пытаемся загрузить больше данных
          if (video.readyState < 4) {
            video.currentTime = 0.1; // Небольшой сдвиг для начала буферизации
          }
          // На мобильных принудительно загружаем больше данных
          if (isMobile) {
            video.currentTime = 0.5;
            setTimeout(() => {
              video.currentTime = 0;
            }, 100);
          }
        }, { once: true });
        
        video.addEventListener('canplaythrough', () => {
          console.log(`✅ Видео предзагружено: ${item.path}`);
        }, { once: true });
        
        video.addEventListener('progress', () => {
          // На мобильных принудительно буферизуем больше данных
          if (isMobile && video.buffered.length > 0) {
            const bufferedEnd = video.buffered.end(video.buffered.length - 1);
            if (bufferedEnd < video.duration && bufferedEnd < 5) {
              // Продолжаем буферизацию
            }
          }
        });
        
        preloadedVideos.set(item.path, video);
      }
    }
  });
}

// Предзагрузка следующего элемента
function preloadNextHomeContentItem(currentIndex) {
  if (homeContentFiles.length === 0) return;
  
  const isMobile = window.innerWidth <= 639;
  const nextIndex = (currentIndex + 1) % homeContentFiles.length;
  const nextItem = homeContentFiles[nextIndex];
  
  if (nextItem.type === 'image') {
    // Предзагружаем следующее изображение, если еще не загружено
    if (!preloadedImages.has(nextItem.path)) {
      const img = new Image();
      img.src = nextItem.path;
      preloadedImages.set(nextItem.path, img);
    }
  } else if (nextItem.type === 'video') {
    // Предзагружаем следующее видео, если еще не загружено
    if (!preloadedVideos.has(nextItem.path)) {
      const video = document.createElement('video');
      video.src = nextItem.path;
      // Всегда используем 'auto' для следующего видео для быстрой смены
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.setAttribute('x5-playsinline', 'true');
      video.setAttribute('x5-video-player-type', 'h5');
      
      // Агрессивная предзагрузка через fetch для мобильных
      if (isMobile) {
        fetch(nextItem.path, {
          method: 'GET',
          cache: 'force-cache',
          headers: {
            'Range': 'bytes=0-'
          }
        }).then(response => {
          if (response.ok) {
            console.log(`📥 Начата предзагрузка следующего видео на мобильном: ${nextItem.path}`);
          }
        }).catch(() => {});
      }
      
      video.load();
      
      // Принудительно начинаем буферизацию
      video.addEventListener('loadedmetadata', () => {
        if (video.readyState < 4) {
          video.currentTime = 0.1;
        }
        // На мобильных принудительно загружаем больше данных
        if (isMobile) {
          video.currentTime = 0.5;
          setTimeout(() => {
            video.currentTime = 0;
          }, 100);
        }
      }, { once: true });
      
      // Начинаем буферизацию сразу
      video.addEventListener('canplaythrough', () => {
        console.log(`✅ Следующее видео готово: ${nextItem.path}`);
      }, { once: true });
      
      preloadedVideos.set(nextItem.path, video);
    } else {
      // Если видео уже в кэше, убеждаемся что оно загружено
      const cachedVideo = preloadedVideos.get(nextItem.path);
      if (cachedVideo) {
        if (cachedVideo.readyState < 3) {
          cachedVideo.preload = 'auto';
          cachedVideo.load();
        }
        // На мобильных принудительно продолжаем загрузку
        if (isMobile && cachedVideo.readyState < 4) {
          cachedVideo.currentTime = 0.1;
          setTimeout(() => {
            cachedVideo.currentTime = 0;
          }, 100);
        }
      }
    }
  }
}

// Отображение текущего элемента HomeContent
function showHomeContentItem(index) {
  try {
    if (!homeContentItem || homeContentFiles.length === 0) return;
    const item = homeContentFiles[index % homeContentFiles.length];
    if (!item) {
      console.error('Элемент не найден по индексу:', index);
      return;
    }
    // Очищаем предыдущие таймеры
    if (currentVideoStopTimeout) {
      clearTimeout(currentVideoStopTimeout);
      currentVideoStopTimeout = null;
    }
    if (currentVideoElement) {
      currentVideoElement.pause();
      currentVideoElement.currentTime = 0;
      // Просто останавливаем видео без эффектов
      currentVideoElement = null;
    }
    
    // Очищаем контейнер
    homeContentItem.innerHTML = '';
    
    if (item.type === 'image') {
    // Используем предзагруженное изображение, если оно есть
    let img;
    if (preloadedImages.has(item.path)) {
      const preloadedImg = preloadedImages.get(item.path);
      img = document.createElement('img');
      img.src = preloadedImg.src; // Используем уже загруженное изображение
      // Если изображение уже загружено, оно отобразится мгновенно
      if (preloadedImg.complete) {
        img.onload = null; // Изображение уже загружено
      }
    } else {
      img = document.createElement('img');
      img.src = item.path;
      // Сохраняем в кэш
      const preloadImg = new Image();
      preloadImg.src = item.path;
      preloadedImages.set(item.path, preloadImg);
    }
    img.loading = 'eager'; // Приоритетная загрузка
    homeContentItem.appendChild(img);
  } else if (item.type === 'vimeo') {
    // Обработка Vimeo видео
    const getVimeoId = (url) => {
      const match = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/|^vimeo:)(\d+)/i) || url.match(/^(\d+)$/);
      return match ? match[1] : null;
    };
    
    const vimeoId = getVimeoId(item.path);
    if (!vimeoId) {
      console.error('Не удалось извлечь ID из Vimeo URL:', item.path);
      // Пропускаем это видео и переходим к следующему элементу
      preloadNextHomeContentItem(index);
      return;
    }
    
    // Проверяем, есть ли предзагруженный iframe и готов ли он
    let preloadedVimeo = null;
    let isVimeoReady = false;
    if (preloadedVideos.has(item.path)) {
      preloadedVimeo = preloadedVideos.get(item.path);
      isVimeoReady = preloadedVimeo.ready || false;
    }
    
    // Если видео не готово, не показываем его, остаемся на текущем элементе
    if (!isVimeoReady) {
      console.log(`⏳ Vimeo видео еще не готово, остаемся на текущем элементе: ${item.path}`);
      // Не очищаем контейнер, остаемся на предыдущем элементе
      // Запускаем проверку готовности через setTimeout
      setTimeout(() => {
        const preloadedVimeo = preloadedVideos.get(item.path);
        if (preloadedVimeo && preloadedVimeo.ready) {
          // Видео готово, показываем его
          showHomeContentItem(index);
        } else {
          // Видео все еще не готово, проверяем еще раз через секунду
          setTimeout(() => showHomeContentItem(index), 1000);
        }
      }, 1000);
      return;
    }
    
    // Видео готово, показываем его
    // Создаем контейнер для Vimeo видео
    const vimeoContainer = document.createElement('div');
    vimeoContainer.className = 'relative w-full flex items-center justify-center';
    vimeoContainer.setAttribute('data-vimeo-id', vimeoId);
    vimeoContainer.style.cssText = 'width:100%; height:100%; position:relative;';
    
    // Создаем невидимый overlay поверх iframe для перехвата событий мыши
    const mouseOverlay = document.createElement('div');
    mouseOverlay.style.cssText = 'position:absolute; inset:0; z-index:1; cursor:none !important; pointer-events:auto;';
    mouseOverlay.style.cursor = 'none';
    
    // Используем предзагруженный iframe или создаем новый
    let iframe;
    if (preloadedVimeo && preloadedVimeo.iframe) {
      // Используем предзагруженный iframe
      iframe = preloadedVimeo.iframe;
      // Обновляем src для автоплея
      iframe.src = `https://player.vimeo.com/video/${vimeoId}?autoplay=1&loop=1&muted=1&title=0&byline=0&portrait=0&autopause=0&controls=0&background=0&transparent=1&dnt=1&badge=0&quality=auto`;
      iframe.style.cssText = 'width:100%; height:auto; aspect-ratio:16/9; border:none; display:block; cursor:none !important; pointer-events:none;';
      iframe.style.cursor = 'none';
      iframe.style.pointerEvents = 'none';
      // Перемещаем iframe из body в контейнер, если он там
      if (iframe.parentElement && iframe.parentElement !== vimeoContainer) {
        iframe.parentElement.removeChild(iframe);
      }
    } else {
      // Создаем новый iframe
      iframe = document.createElement('iframe');
      iframe.src = `https://player.vimeo.com/video/${vimeoId}?autoplay=1&loop=1&muted=1&title=0&byline=0&portrait=0&autopause=0&controls=0&background=0&transparent=1&dnt=1&badge=0&quality=auto`;
      iframe.setAttribute('allow', 'autoplay');
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('frameborder', '0');
      iframe.id = `vimeo-player-${vimeoId}`;
      iframe.style.cssText = 'width:100%; height:auto; aspect-ratio:16/9; border:none; display:block; cursor:none !important; pointer-events:none;';
      iframe.style.cursor = 'none';
      iframe.style.pointerEvents = 'none';
    }
    
    // Инициализация Vimeo Player API для установки максимального качества
    iframe.addEventListener('load', () => {
      if (typeof Vimeo !== 'undefined' && Vimeo.Player) {
        const vimeoPlayer = new Vimeo.Player(iframe);
        
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
        
        // Явно устанавливаем volume = 0 при инициализации
        vimeoPlayer.setVolume(0).catch(() => {});
      }
    });
    
    // Размещаем элементы
    vimeoContainer.appendChild(iframe);
    vimeoContainer.appendChild(mouseOverlay);
    homeContentItem.appendChild(vimeoContainer);
    
    // Добавляем обработчики для обновления кастомного курсора
    const customCursor = document.getElementById('custom-cursor');
    if (customCursor) {
      const updateCursor = (e) => {
        if (customCursor) {
          customCursor.style.left = e.clientX + 'px';
          customCursor.style.top = e.clientY + 'px';
          customCursor.style.opacity = '1';
        }
      };
      
      mouseOverlay.addEventListener('mousemove', updateCursor);
      mouseOverlay.addEventListener('mouseenter', () => {
        if (customCursor) {
          customCursor.style.opacity = '1';
        }
      });
    }
    
    // Устанавливаем таймер для смены видео (5-10 секунд)
    const MIN_VIDEO_DURATION = 5000;
    const MAX_VIDEO_DURATION = 10000;
    const stopTime = MIN_VIDEO_DURATION + Math.random() * (MAX_VIDEO_DURATION - MIN_VIDEO_DURATION);
    
    currentVideoStopTimeout = setTimeout(() => {
      // Видео будет заменено автоматически через ротацию
    }, stopTime);
    
  } else if (item.type === 'video') {
    // Используем предзагруженное видео, если оно есть
    let video;
    if (preloadedVideos.has(item.path)) {
      const preloadedVideo = preloadedVideos.get(item.path);
      // Используем предзагруженное видео напрямую для максимальной скорости
      video = preloadedVideo;
      video.currentTime = 0; // Сбрасываем время воспроизведения
      // Если видео уже загружено, оно начнет воспроизведение мгновенно
    } else {
      video = document.createElement('video');
      video.src = item.path;
      // Всегда используем 'auto' для быстрой загрузки
      video.preload = 'auto';
      // Сохраняем в кэш
      const preloadVideo = document.createElement('video');
      preloadVideo.src = item.path;
      preloadVideo.preload = 'auto';
      preloadVideo.muted = true;
      preloadVideo.playsInline = true;
      preloadVideo.setAttribute('playsinline', 'true');
      preloadVideo.setAttribute('webkit-playsinline', 'true');
      preloadVideo.load();
      preloadedVideos.set(item.path, preloadVideo);
    }
    
    // Настройки видео
    video.autoplay = true;
    video.loop = false;
    video.muted = true;
    video.controls = false; // Отключаем нативные элементы управления
    video.disablePictureInPicture = true; // Отключаем Picture-in-Picture
    video.playsInline = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('x5-playsinline', 'true'); // Для Android
    video.setAttribute('x5-video-player-type', 'h5'); // Для Android
    video.setAttribute('x5-video-player-fullscreen', 'false'); // Запрещаем полноэкранный режим на Android
    
    // Предотвращаем полноэкранный режим через обработчики событий
    video.addEventListener('webkitbeginfullscreen', (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }, { passive: false });
    
    video.addEventListener('webkitendfullscreen', (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }, { passive: false });
    
    // Блокируем попытки открыть полноэкранный режим программно
    const originalRequestFullscreen = video.requestFullscreen;
    const originalWebkitRequestFullscreen = video.webkitRequestFullscreen;
    const originalWebkitEnterFullscreen = video.webkitEnterFullscreen;
    
    video.requestFullscreen = () => {};
    video.webkitRequestFullscreen = () => {};
    video.webkitEnterFullscreen = () => {};
    
    // Устанавливаем минимальное время воспроизведения 5 секунд
    const MIN_VIDEO_DURATION = 5000; // 5 секунд
    
    // Когда видео загрузится, проверяем его длительность
    const handleLoadedMetadata = () => {
      const videoDuration = video.duration * 1000; // в миллисекундах
      // Используем максимум из длительности видео и минимума 5 секунд
      const playDuration = Math.max(videoDuration, MIN_VIDEO_DURATION);
      
      // Генерируем случайное время остановки от playDuration до playDuration + 5 секунд
      const stopTime = playDuration + Math.random() * 5000;
      
      // Останавливаем видео через вычисленное время
      currentVideoStopTimeout = setTimeout(() => {
        if (video && !video.paused) {
          video.pause();
          // Просто останавливаем видео без эффектов
        }
      }, stopTime);
    };
    
    // Обработчик для начала воспроизведения
    const handlePlay = () => {
      // Убеждаемся, что видео воспроизводится
      if (video.paused) {
        video.play().catch(err => {
          console.warn('Ошибка воспроизведения видео:', err);
        });
      }
      
      // На мобильных устройствах начинаем предзагрузку следующего видео
      // во время воспроизведения текущего
      const isMobile = window.innerWidth <= 639;
      if (isMobile && item.type === 'video') {
        const nextIndex = (index + 1) % homeContentFiles.length;
        const nextItem = homeContentFiles[nextIndex];
        
        // Если следующий элемент - видео, начинаем его предзагрузку
        if (nextItem && nextItem.type === 'video') {
          // Проверяем, не загружено ли уже следующее видео
          if (!preloadedVideos.has(nextItem.path)) {
            console.log('📱 Начинаем предзагрузку следующего видео на мобильном:', nextItem.path);
            const nextVideo = document.createElement('video');
            nextVideo.src = nextItem.path;
            nextVideo.preload = 'auto'; // Полная предзагрузка
            nextVideo.muted = true;
            nextVideo.playsInline = true;
            nextVideo.setAttribute('playsinline', 'true');
            nextVideo.setAttribute('webkit-playsinline', 'true');
            nextVideo.load();
            
            // Начинаем буферизацию
            nextVideo.addEventListener('canplaythrough', () => {
              console.log('✅ Следующее видео готово к воспроизведению:', nextItem.path);
            }, { once: true });
            
            preloadedVideos.set(nextItem.path, nextVideo);
          } else {
            // Если видео уже в кэше, убеждаемся что оно загружено
            const cachedVideo = preloadedVideos.get(nextItem.path);
            if (cachedVideo && cachedVideo.readyState < 3) {
              cachedVideo.preload = 'auto';
              cachedVideo.load();
            }
          }
        }
      }
    };
    
    video.addEventListener('play', handlePlay, { once: true });
    
    // Если метаданные уже загружены (из предзагрузки), используем их сразу
    if (video.readyState >= 2) {
      handleLoadedMetadata();
      // Пытаемся начать воспроизведение
      video.play().catch(err => {
        console.warn('Ошибка автовоспроизведения видео:', err);
        // На мобильных может потребоваться взаимодействие пользователя
        // В этом случае видео начнет воспроизводиться при следующей попытке
      });
    } else {
      video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
      // Пытаемся начать воспроизведение после загрузки метаданных
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(err => {
          console.warn('Ошибка автовоспроизведения видео после загрузки:', err);
        });
      }, { once: true });
    }
    
    // Если метаданные не загрузились, используем минимум 5 секунд
    const fallbackTimeout = setTimeout(() => {
      if (!currentVideoStopTimeout) {
        const stopTime = MIN_VIDEO_DURATION + Math.random() * 5000;
        currentVideoStopTimeout = setTimeout(() => {
          if (video && !video.paused) {
            video.pause();
            // Просто останавливаем видео без эффектов
          }
        }, stopTime);
      }
      // Пытаемся начать воспроизведение даже если метаданные не загрузились
      if (video.paused) {
        video.play().catch(err => {
          console.warn('Ошибка воспроизведения видео (fallback):', err);
        });
      }
    }, 1000);
    
    video.addEventListener('loadedmetadata', () => {
      clearTimeout(fallbackTimeout);
    }, { once: true });
    
    // Видео появляется сразу без эффектов прозрачности
    currentVideoElement = video;
    homeContentItem.appendChild(video);
    }
    
    // Предзагружаем следующий элемент
    preloadNextHomeContentItem(index);
  } catch (error) {
    console.error('Ошибка в showHomeContentItem:', error);
    // Пытаемся показать следующий элемент
    const nextIndex = (index + 1) % homeContentFiles.length;
    if (nextIndex !== index && homeContentFiles.length > 0) {
      setTimeout(() => showHomeContentItem(nextIndex), 1000);
    }
  }
}

// Запуск ротации HomeContent (не используется: главная показывает только обложки)
function startHomeContentRotation() {
  if (!homeContentContainer || !homeContentItem) return;
  stopHomeContentRotation();
  homeContentContainer.style.display = 'flex';
  homeContentIndex = 0;
  showHomeContentItem(homeContentIndex);
  
  // Функция для перехода к следующему элементу
  function moveToNext() {
    const currentItem = homeContentFiles[homeContentIndex % homeContentFiles.length];
    const nextIndex = (homeContentIndex + 1) % homeContentFiles.length;
    const nextItem = homeContentFiles[nextIndex];
    
    // Проверяем готовность следующего элемента, если это Vimeo видео
    if (nextItem && nextItem.type === 'vimeo') {
      const nextVimeo = preloadedVideos.get(nextItem.path);
      if (nextVimeo && !nextVimeo.ready) {
        // Видео еще не готово, ждем еще немного
        console.log('⏳ Следующее Vimeo видео еще не готово, ждем...');
        return 1000; // Проверяем каждую секунду
      }
    }
    
    if (currentItem.type === 'image') {
      // Для изображений - 3 секунды
      return 3000;
    } else if (currentItem.type === 'vimeo') {
      // Для Vimeo видео - минимум 5 секунд, максимум 10 секунд
      return 5000 + Math.random() * 5000;
    } else if (currentItem.type === 'video') {
      // Для видео - минимум 5 секунд, но проверяем длительность видео
      if (currentVideoElement && currentVideoElement.readyState >= 2) {
        const videoDuration = currentVideoElement.duration * 1000;
        return Math.max(videoDuration, 5000) + Math.random() * 5000; // минимум 5 сек + до 5 сек случайно
      }
      // Если видео еще не загрузилось, используем минимум 5 секунд
      return 5000 + Math.random() * 5000;
    }
    return 3000; // По умолчанию 3 секунды
  }
  
  // Функция для планирования следующего перехода
  function scheduleNext() {
    const delay = moveToNext();
    homeContentInterval = setTimeout(() => {
      homeContentIndex = (homeContentIndex + 1) % homeContentFiles.length;
      showHomeContentItem(homeContentIndex);
      scheduleNext();
    }, delay);
  }
  
  // Предзагружаем следующий элемент сразу после показа первого
  preloadNextHomeContentItem(0);
  
  // Запускаем первую ротацию
  scheduleNext();
}

// Остановка ротации HomeContent
function stopHomeContentRotation() {
  if (homeContentInterval) {
    clearTimeout(homeContentInterval);
    homeContentInterval = null;
  }
  
  // Очищаем таймер остановки видео
  if (currentVideoStopTimeout) {
    clearTimeout(currentVideoStopTimeout);
    currentVideoStopTimeout = null;
  }
  
  // Останавливаем текущее видео, если оно есть
  if (currentVideoElement) {
    if (typeof currentVideoElement.pause === 'function') {
      currentVideoElement.pause();
      if (typeof currentVideoElement.currentTime !== 'undefined') {
        currentVideoElement.currentTime = 0;
      }
    }
    currentVideoElement = null;
  }
  
  // Останавливаем все предзагруженные видео
  preloadedVideos.forEach(video => {
    if (video) {
      // Проверяем, это обычное видео или объект Vimeo
      if (video.type === 'vimeo') {
        // Для Vimeo ничего не делаем, просто пропускаем
        return;
      }
      // Для обычных видео проверяем наличие метода pause
      if (typeof video.pause === 'function') {
        video.pause();
        if (typeof video.currentTime !== 'undefined') {
          video.currentTime = 0;
        }
      }
    }
  });
  
  // Скрываем контейнер
  if (homeContentContainer) homeContentContainer.style.display = 'none';
  if (homeContentItem) homeContentItem.innerHTML = '';
}

// Функция для обновления URL без перезагрузки страницы
function updateURL(section) {
  const url = new URL(window.location);
  if (section === 'home') {
    // Для главной страницы убираем все параметры
    url.search = '';
  } else {
    // Для других страниц устанавливаем параметр section
    url.searchParams.set('section', section);
    // Также сохраняем category для обратной совместимости
    if (section === 'commerce' || section === 'mind') {
      url.searchParams.set('category', section);
    } else {
      url.searchParams.delete('category');
    }
  }
  window.history.pushState({ section }, '', url);
}

// =============== ГЛАВНАЯ СТРАНИЦА (HOME) ===============
function showHome(){
  // На главной показываем только обложки проектов (Mind + Commerce)
  // Останавливаем и скрываем старый HomeContent (картинки и анимации)
  stopHomeContentRotation();
  if (homeContentContainer) {
    homeContentContainer.style.display = 'none';
  }
  if (homeContentItem) {
    homeContentItem.innerHTML = '';
  }

  grid.style.display='none';
  projectsList.style.display='grid';
  breadcrumb.style.display='none';
  const bioEl = document.getElementById('bio');
  if(bioEl) bioEl.style.display='none';
  const bioContainer = document.getElementById('bio-container');
  if(bioContainer) bioContainer.style.display='none';
  const navCommerce = document.getElementById('nav-commerce');
  const navMind = document.getElementById('nav-mind');
  const navAbout = document.getElementById('nav-about');
  if(navCommerce) {
    navCommerce.style.display='none';
  }
  if(navMind) {
    navMind.style.display='none';
  }
  if(navAbout) {
    navAbout.style.display='inline';
    // На главной About me "неактивна"
    navAbout.style.opacity='0.35';
  }
  document.body.classList.add('home-page');
  document.documentElement.classList.add('home-page');
  document.body.classList.remove('about-page');
  document.documentElement.classList.remove('about-page');
  if (currentSection !== 'home') stopBackgroundAnimation();
  disableDrawing();
  const isDesktop = window.innerWidth >= 640;
  if (isDesktop && homeProjectNamesContainer) {
    projectsList.style.display = 'none';
    createDesktopHomeNames();
  } else {
    stopDesktopHomeNamesAnimation();
    projectsList.style.display = 'grid';
    loadProjects(null);
  }
  currentSection = 'home';
  updateURL('home');
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


// Инициализация
document.addEventListener('DOMContentLoaded', ()=>{
  // Добавляем класс для главной страницы (для блокировки скролла на мобильных)
  document.body.classList.add('home-page');
  document.documentElement.classList.add('home-page');
  
  // Проверяем параметры в URL
  const urlParams = new URLSearchParams(window.location.search);
  const sectionFromUrl = urlParams.get('section');
  const categoryFromUrl = urlParams.get('category'); // Для обратной совместимости
  
  const logo=document.getElementById('logo');
  if(logo){ 
    logo.addEventListener('click',()=>{ 
      currentSection='home'; 
      showHome();
    });
    
    // Обработчики для анимации фона
    logo.addEventListener('mouseenter', startBackgroundAnimation);
    logo.addEventListener('mouseleave', stopBackgroundAnimation);
  }
  
  const navCommerce = document.getElementById('nav-commerce');
  const navMind = document.getElementById('nav-mind');
  const navAbout = document.getElementById('nav-about');
  
  document.getElementById('nav-commerce')?.addEventListener('click',()=>{ 
    currentSection='commerce'; 
    stopBackgroundAnimation();
    stopHomeContentRotation();
    grid.style.display='none';
    projectsList.style.display='grid';
    breadcrumb.style.display='none';
    const bioEl = document.getElementById('bio');
    if(bioEl) bioEl.style.display='none';
    const bioContainer = document.getElementById('bio-container');
    if(bioContainer) bioContainer.style.display='none';
    // Убираем классы для разблокировки скролла
    document.body.classList.remove('home-page');
    document.documentElement.classList.remove('home-page');
    document.body.classList.remove('about-page');
    document.documentElement.classList.remove('about-page');
    // Отключаем рисование при переходе на Commerce
    disableDrawing();
    if(navCommerce) {
      navCommerce.style.display='inline';
      navCommerce.style.opacity='1';
    }
    if(navMind) {
      navMind.style.display='inline';
      navMind.style.opacity='0.35';
    }
    if(navAbout) {
      navAbout.style.display='inline';
      navAbout.style.opacity='0.35';
    }
    loadProjects('commerce');
    // Обновляем URL без перезагрузки страницы
    updateURL('commerce');
  });
  
  document.getElementById('nav-mind')?.addEventListener('click',()=>{ 
    currentSection='mind'; 
    stopBackgroundAnimation();
    stopHomeContentRotation();
    grid.style.display='none';
    projectsList.style.display='grid';
    breadcrumb.style.display='none';
    const bioEl = document.getElementById('bio');
    if(bioEl) bioEl.style.display='none';
    const bioContainer = document.getElementById('bio-container');
    if(bioContainer) bioContainer.style.display='none';
    // Убираем классы для разблокировки скролла
    document.body.classList.remove('home-page');
    document.documentElement.classList.remove('home-page');
    document.body.classList.remove('about-page');
    document.documentElement.classList.remove('about-page');
    // Отключаем рисование при переходе на Mind
    disableDrawing();
    if(navCommerce) {
      navCommerce.style.display='inline';
      navCommerce.style.opacity='0.35';
    }
    if(navMind) {
      navMind.style.display='inline';
      navMind.style.opacity='1';
    }
    if(navAbout) {
      navAbout.style.display='inline';
      navAbout.style.opacity='0.35';
    }
    loadProjects('mind');
    // Обновляем URL без перезагрузки страницы
    updateURL('mind');
  });
  
  document.getElementById('nav-about')?.addEventListener('click',()=>{ 
    currentSection='about';
    window.currentSection = 'about';
    stopBackgroundAnimation();
    stopHomeContentRotation();
    stopDesktopHomeNamesAnimation();
    grid.style.display='none';
    projectsList.style.display='none';
    breadcrumb.style.display='none';
    const bioEl = document.getElementById('bio');
    if(bioEl) bioEl.style.display='block';
    const bioContainer = document.getElementById('bio-container');
    if(bioContainer) bioContainer.style.display='flex';
    // Добавляем класс для блокировки скролла на мобильных для страницы About me
    document.body.classList.remove('home-page');
    document.documentElement.classList.remove('home-page');
    document.body.classList.add('about-page');
    document.documentElement.classList.add('about-page');
    // Обновляем URL ПЕРЕД включением рисования, чтобы enableDrawing мог правильно определить секцию
    updateURL('about');
    // Включаем рисование на странице About me
    enableDrawing();
    if(navCommerce) {
      navCommerce.style.display='inline';
      navCommerce.style.opacity='0.35';
    }
    if(navMind) {
      navMind.style.display='inline';
      navMind.style.opacity='0.35';
    }
    if(navAbout) {
      navAbout.style.display='inline';
      navAbout.style.opacity='1';
    }
  });
  
  // Восстанавливаем состояние страницы из URL
  const section = sectionFromUrl || categoryFromUrl || 'home';
  
  if(section === 'about') {
    currentSection = 'about';
    stopHomeContentRotation();
    grid.style.display='none';
    projectsList.style.display='none';
    breadcrumb.style.display='none';
    const bioEl = document.getElementById('bio');
    if(bioEl) bioEl.style.display='block';
    const bioContainer = document.getElementById('bio-container');
    if(bioContainer) bioContainer.style.display='flex';
    // Добавляем класс для блокировки скролла на мобильных для страницы About me
    document.body.classList.remove('home-page');
    document.documentElement.classList.remove('home-page');
    document.body.classList.add('about-page');
    document.documentElement.classList.add('about-page');
    // Включаем рисование на странице About me
    enableDrawing();
    if(navCommerce) {
      navCommerce.style.display='inline';
      navCommerce.style.opacity='0.35';
    }
    if(navMind) {
      navMind.style.display='inline';
      navMind.style.opacity='0.35';
    }
      if(navAbout) {
        navAbout.style.display='inline';
        navAbout.style.opacity='1';
      }
  } else {
    // Любые другие секции (включая устаревшие commerce/mind) считаем главной
    showHome();
  }
  
  // Обработчик для кнопки "Назад" в браузере
  window.addEventListener('popstate', (event) => {
    const urlParams = new URLSearchParams(window.location.search);
    const section = urlParams.get('section') || urlParams.get('category') || 'home';
    
    if(section === 'about') {
      document.getElementById('nav-about')?.click();
    } else {
      // Для всех остальных секций (включая устаревшие commerce/mind) возвращаемся на главную
      document.getElementById('logo')?.click();
    }
  });
});

// =============== ФУНКЦИИ АНИМАЦИИ ФОНА ===============

// Генерация случайной скорости анимации (5 сек - 1 мин, редко до часа)
function getRandomAnimationDuration() {
  // 90% вероятность: от 5 секунд до 1 минуты
  // 10% вероятность: от 1 минуты до 1 часа
  const isRare = Math.random() < 0.1;
  
  if (isRare) {
    // Редкий случай: от 1 минуты (60000ms) до 1 часа (3600000ms)
    return 60000 + Math.random() * (3600000 - 60000);
  } else {
    // Обычный случай: от 5 секунд (5000ms) до 1 минуты (60000ms)
    return 5000 + Math.random() * (60000 - 5000);
  }
}

// Конвертация RGB в hex
function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}

// Интерполяция между двумя цветами
function interpolateColor(color1, color2, factor) {
  return {
    r: color1.r + (color2.r - color1.r) * factor,
    g: color1.g + (color2.g - color1.g) * factor,
    b: color1.b + (color2.b - color1.b) * factor
  };
}

// Генерация случайного цвета в диапазоне от белого до чёрного
function getRandomColorInRange() {
  // Генерируем случайное значение яркости от 15 до 250
  const brightness = 15 + Math.random() * (250 - 15);
  return {
    r: Math.round(brightness),
    g: Math.round(brightness),
    b: Math.round(brightness)
  };
}

// Анимация фона (от текущего цвета к случайному)
function animateBackground(currentTime) {
  if (!backgroundAnimationStartTime) {
    backgroundAnimationStartTime = currentTime;
  }
  
  const elapsed = currentTime - backgroundAnimationStartTime;
  const progress = Math.min(elapsed / backgroundAnimationDuration, 1);
  
  // Используем ease-in-out для плавности
  const easedProgress = progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
  
  // Интерполируем цвет от начального к конечному
  const currentColor = interpolateColor(
    currentAnimationStartColor,
    currentAnimationEndColor,
    easedProgress
  );
  
  // Применяем цвет к фону
  document.body.style.backgroundColor = rgbToHex(currentColor.r, currentColor.g, currentColor.b);
  
  if (progress < 1) {
    backgroundAnimationFrame = requestAnimationFrame(animateBackground);
  } else {
    // Анимация завершена - начинаем новую анимацию к случайной точке, если курсор все еще на логотипе
    if (isHovering && currentSection === 'home') {
      // Текущий цвет становится начальным для следующей анимации
      currentAnimationStartColor = currentAnimationEndColor;
      // Генерируем новый случайный конечный цвет
      currentAnimationEndColor = getRandomColorInRange();
      // Генерируем новую случайную скорость
      backgroundAnimationDuration = getRandomAnimationDuration();
      backgroundAnimationStartTime = null;
      // Продолжаем анимацию к новой точке
      backgroundAnimationFrame = requestAnimationFrame(animateBackground);
    } else {
      // Курсор убран или мы не на главной странице - останавливаем
      backgroundAnimationFrame = null;
      backgroundAnimationStartTime = null;
      isBackgroundAnimating = false;
    }
  }
}

// Анимация возврата фона к исходному цвету
function animateBackgroundReturn(currentTime) {
  if (!backgroundReturnStartTime) {
    backgroundReturnStartTime = currentTime;
  }
  
  const elapsed = currentTime - backgroundReturnStartTime;
  const progress = Math.min(elapsed / BACKGROUND_RETURN_DURATION, 1);
  
  // Используем ease-in-out для плавности
  const easedProgress = progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
  
  // Интерполируем цвет от текущего к исходному
  const currentColor = interpolateColor(
    backgroundReturnStartColor,
    BACKGROUND_COLOR_START,
    easedProgress
  );
  
  // Применяем цвет к фону
  document.body.style.backgroundColor = rgbToHex(currentColor.r, currentColor.g, currentColor.b);
  
  if (progress < 1) {
    backgroundAnimationFrame = requestAnimationFrame(animateBackgroundReturn);
  } else {
    // Возврат завершен
    backgroundAnimationFrame = null;
    backgroundReturnStartTime = null;
    isBackgroundReturning = false;
    document.body.style.backgroundColor = '#FAFAFA';
  }
}

// Запуск анимации фона (с задержкой 3 секунды)
function startBackgroundAnimation() {
  // Проверяем, что мы на главной странице
  if (currentSection !== 'home') {
    return;
  }
  
  // Устанавливаем флаг, что курсор на логотипе
  isHovering = true;
  
  // Если идет возврат фона, останавливаем его
  if (isBackgroundReturning && backgroundAnimationFrame) {
    cancelAnimationFrame(backgroundAnimationFrame);
    backgroundAnimationFrame = null;
    isBackgroundReturning = false;
    backgroundReturnStartTime = null;
  }
  
  // Очищаем предыдущий таймер, если есть
  if (backgroundHoverTimer) {
    clearTimeout(backgroundHoverTimer);
    backgroundHoverTimer = null;
  }
  
  // Запускаем таймер на 3 секунды
  backgroundHoverTimer = setTimeout(() => {
    // Проверяем еще раз, что мы на главной странице и курсор все еще на логотипе
    if (currentSection !== 'home' || !isHovering || isBackgroundAnimating) {
      return;
    }
    
    // Определяем начальный цвет на основе текущего цвета фона
    const currentBgColor = window.getComputedStyle(document.body).backgroundColor;
    const rgbMatch = currentBgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      currentAnimationStartColor = {
        r: parseInt(rgbMatch[1]),
        g: parseInt(rgbMatch[2]),
        b: parseInt(rgbMatch[3])
      };
    } else {
      // По умолчанию начинаем с белого
      currentAnimationStartColor = { ...BACKGROUND_COLOR_START };
    }
    
    // Генерируем случайный конечный цвет
    currentAnimationEndColor = getRandomColorInRange();
    
    // Генерируем случайную скорость
    backgroundAnimationDuration = getRandomAnimationDuration();
    backgroundAnimationStartTime = null;
    isBackgroundAnimating = true;
    
    // Запускаем анимацию
    backgroundAnimationFrame = requestAnimationFrame(animateBackground);
  }, 3000);
}

// Остановка анимации фона
function stopBackgroundAnimation() {
  // Сбрасываем флаг, что курсор на логотипе
  isHovering = false;
  
  // Очищаем таймер задержки
  if (backgroundHoverTimer) {
    clearTimeout(backgroundHoverTimer);
    backgroundHoverTimer = null;
  }
  
  // Если идет возврат, ничего не делаем (возврат уже идет)
  if (isBackgroundReturning) {
    return;
  }
  
  // Если анимация была запущена, начинаем плавный возврат
  if (isBackgroundAnimating || backgroundAnimationFrame) {
    // Останавливаем анимацию
    if (backgroundAnimationFrame) {
      cancelAnimationFrame(backgroundAnimationFrame);
      backgroundAnimationFrame = null;
    }
    
    // Получаем текущий цвет фона
    const currentBgColor = window.getComputedStyle(document.body).backgroundColor;
    // Парсим RGB из строки "rgb(r, g, b)"
    const rgbMatch = currentBgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      backgroundReturnStartColor = {
        r: parseInt(rgbMatch[1]),
        g: parseInt(rgbMatch[2]),
        b: parseInt(rgbMatch[3])
      };
    } else {
      // Fallback на черный цвет, если не удалось распарсить
      backgroundReturnStartColor = BACKGROUND_COLOR_END;
    }
    
    // Сбрасываем состояние анимации
    backgroundAnimationStartTime = null;
    isBackgroundAnimating = false;
    
    // Запускаем анимацию возврата
    isBackgroundReturning = true;
    backgroundReturnStartTime = null;
    backgroundAnimationFrame = requestAnimationFrame(animateBackgroundReturn);
  } else {
    // Если анимация не была запущена, просто возвращаем исходный цвет
    document.body.style.backgroundColor = '#FAFAFA';
  }
}

// =============== КАСТОМНЫЙ КУРСОР ===============
const customCursor = document.getElementById('custom-cursor');
let cursorX = 0;
let cursorY = 0;
let cursorVisible = false;
let cursorAnimationFrame = null;

// Обновление позиции курсора
function updateCursor(e) {
  cursorX = e.clientX;
  cursorY = e.clientY;
  
  if (customCursor) {
    customCursor.style.left = cursorX + 'px';
    customCursor.style.top = cursorY + 'px';
    
    if (!cursorVisible) {
      customCursor.style.opacity = '1';
      cursorVisible = true;
    }
  }
}

// Анимация курсора через requestAnimationFrame для плавности
function animateCursor() {
  if (customCursor && cursorVisible) {
    customCursor.style.left = cursorX + 'px';
    customCursor.style.top = cursorY + 'px';
  }
  cursorAnimationFrame = requestAnimationFrame(animateCursor);
}

// Скрытие курсора при выходе за пределы окна
function hideCursor() {
  if (customCursor) {
    customCursor.style.opacity = '0';
    cursorVisible = false;
  }
}

// Показываем курсор только на десктопе
if (window.innerWidth >= 640) {
  document.addEventListener('mousemove', updateCursor);
  document.addEventListener('mouseenter', () => {
    if (customCursor) {
      customCursor.style.opacity = '1';
      cursorVisible = true;
    }
  });
  document.addEventListener('mouseleave', hideCursor);
  
  // Запускаем анимацию курсора
  animateCursor();
  
  // Добавляем обработчики на все iframe и их контейнеры для обновления курсора
  const observer = new MutationObserver(() => {
    // Находим все контейнеры Vimeo и добавляем обработчики
    document.querySelectorAll('[data-vimeo-id]').forEach(container => {
      container.addEventListener('mousemove', updateCursor);
      container.addEventListener('mouseenter', () => {
        if (customCursor) {
          customCursor.style.opacity = '1';
          cursorVisible = true;
        }
      });
      container.addEventListener('mouseleave', hideCursor);
    });
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}

