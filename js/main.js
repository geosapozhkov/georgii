// Главная страница - работа с локальными файлами
let currentSection = 'home';

const grid = document.getElementById('file-grid');
const loading = document.getElementById('loading');
const breadcrumb = document.getElementById('breadcrumb');
const viewerOverlay = document.getElementById('viewerOverlay');
const viewerContent = document.getElementById('viewerContent');
const projectsList = document.getElementById('projects-list');
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

// =============== НАСТРОЙКИ ОБЛОЖЕК ===============
// Доступные стили:
//   'minimal'     - Минималистичный: текст снизу слева на белом фоне, без оверлея
//   'classic'     - Классический: полупрозрачный черный оверлей, белый текст по центру
//   'gradient'    - Градиент: градиентный оверлей снизу, текст внизу слева
//   'image-only'  - Только изображение: без текста на обложке
const PROJECT_COVER_STYLE = 'image-only'; // Измените здесь стиль обложек

// Функция getRandomColor() удалена - больше не используем placeholder'ы с серыми обложками

// =============== ЗАГРУЗКА ПРОЕКТОВ ===============
async function loadProjects(category = null){
  try{
    projectsList.innerHTML = '';
    
    // Загружаем список проектов из папки projects/
    // В реальности это будет список папок из projects/
    // Для статического сайта используем конфигурацию
    
    let projects = await getProjectsList();
    
    // Фильтруем по категории, если указана
    if(category){
      projects = projects.filter(p => p.category && p.category.toLowerCase() === category.toLowerCase());
    }
    
    if(projects.length === 0){
      projectsList.innerHTML = '<div class="col-span-12 text-center text-gray-400">Проекты не найдены</div>';
      return;
    }

    for(const project of projects){
      const projectCard = document.createElement('a');
      // Передаем категорию в URL
      const categoryParam = project.category ? `&category=${encodeURIComponent(project.category)}` : '';
      projectCard.href = `project.html?project=${encodeURIComponent(project.name)}${categoryParam}`;
      projectCard.className = 'col-span-4 sm:col-span-4 md:col-span-4 cursor-pointer';
      
      // Пытаемся найти обложку (cover) для превью
      let previewUrl = '';
      let coverFileName = '';
      // Приводим категорию к правильному регистру (первая буква заглавная)
      const categoryCapitalized = project.category ? project.category.charAt(0).toUpperCase() + project.category.slice(1).toLowerCase() : '';
      const categoryPath = categoryCapitalized ? `${categoryCapitalized}/` : '';
      
      // Ищем файл с "cover" в названии
      const coverInfo = await getCoverImageFromProject(project.name, project.category);
      previewUrl = coverInfo.url;
      coverFileName = coverInfo.filename;
      
      // Логирование для отладки
      console.log(`🔍 Проект: ${project.name}, категория: ${project.category}`);
      console.log(`   Обложка URL: ${previewUrl}`);
      console.log(`   Имя файла обложки: ${coverFileName}`);
      
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
      
      // Пропускаем проекты без обложки - показываем только проекты с реальными файлами
      if(!previewUrl) {
        console.warn(`Пропущен проект ${project.name} - обложка не найдена`);
        continue;
      }
      
      // Определяем, показывать ли текст на обложке
      const showTitle = PROJECT_COVER_STYLE !== 'image-only';
      
      projectCard.innerHTML = `
        <div class="project-card project-cover-style-${PROJECT_COVER_STYLE}">
          <div class="project-cover-container">
            <img src="${previewUrl}" alt="${projectTitleFromCover}" class="project-cover-image" 
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
    }
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
  // Приводим категорию к правильному регистру (первая буква заглавная)
  const categoryCapitalized = category ? category.charAt(0).toUpperCase() + category.slice(1).toLowerCase() : '';
  const categoryPath = categoryCapitalized ? `${categoryCapitalized}/` : '';
  const basePath = `projects/${categoryPath}${projectName}/images`;
  
  // Проверяем files.json для получения обложки
  console.log(`🔍 Поиск обложки для проекта: ${projectName}, категория: ${category || 'нет'}`);
  console.log(`   Путь к files.json: ${basePath}/files.json`);
  
  try {
    // Добавляем cache-busting параметр и заголовки для предотвращения кэширования
    const cacheBuster = `?v=${Date.now()}`;
    const filesResponse = await fetch(`${basePath}/files.json${cacheBuster}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
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
        return {
          url: coverUrl,
          filename: filesData.cover
        };
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
        return {
          url: `${basePath}/${encodedCover}`,
          filename: coverFile
        };
      }
    }
  } catch(e) {
    // Если files.json не найден, возвращаем пустую строку
    console.error(`   ❌ Ошибка загрузки files.json для проекта ${projectName}:`, e);
  }
  
  return { url: '', filename: '' };
}

// Получаем первое изображение из проекта (для обратной совместимости)
async function getFirstImageFromProject(projectName, category = null){
  const coverInfo = await getCoverImageFromProject(projectName, category);
  return coverInfo.url;
}

// =============== HOME CONTENT ===============
let homeContentFiles = [];
let homeContentIndex = 0;
let homeContentInterval = null;
let currentVideoElement = null;
let currentVideoStopTimeout = null;

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
      homeContentContainer.style.display = 'none';
      return;
    }
    
    const filesData = await filesResponse.json();
    const files = filesData.files || [];
    
    if (files.length === 0) {
      console.warn('Нет файлов в files.json');
      homeContentContainer.style.display = 'none';
      return;
    }
    
    // Сортируем файлы по имени для правильного порядка
    files.sort();
    
    // Создаем список файлов с типами
    homeContentFiles = [];
    for (const file of files) {
      homeContentFiles.push({
        path: `${basePath}/${file}`,
        type: isImage(file) ? 'image' : 'video',
        name: file
      });
    }
    
    console.log(`Загружено ${homeContentFiles.length} файлов из HomeContent`);
    startHomeContentRotation();
  } catch (e) {
    console.error('Ошибка загрузки HomeContent:', e);
    homeContentContainer.style.display = 'none';
  }
}

// Отображение текущего элемента HomeContent
function showHomeContentItem(index) {
  if (homeContentFiles.length === 0) return;
  
  const item = homeContentFiles[index % homeContentFiles.length];
  homeContentItem.innerHTML = '';
  
  // Очищаем предыдущие таймеры
  if (currentVideoStopTimeout) {
    clearTimeout(currentVideoStopTimeout);
    currentVideoStopTimeout = null;
  }
  if (currentVideoElement) {
    currentVideoElement.pause();
    currentVideoElement.currentTime = 0;
    currentVideoElement = null;
  }
  
  if (item.type === 'image') {
    const img = document.createElement('img');
    img.src = item.path;
    homeContentItem.appendChild(img);
  } else if (item.type === 'video') {
    const video = document.createElement('video');
    video.src = item.path;
    video.autoplay = true;
    video.loop = false;
    video.muted = true;
    
    // Устанавливаем минимальное время воспроизведения 5 секунд
    const MIN_VIDEO_DURATION = 5000; // 5 секунд
    
    // Когда видео загрузится, проверяем его длительность
    video.addEventListener('loadedmetadata', () => {
      const videoDuration = video.duration * 1000; // в миллисекундах
      // Используем максимум из длительности видео и минимума 5 секунд
      const playDuration = Math.max(videoDuration, MIN_VIDEO_DURATION);
      
      // Генерируем случайное время остановки от playDuration до playDuration + 5 секунд
      const stopTime = playDuration + Math.random() * 5000;
      
      // Останавливаем видео через вычисленное время
      currentVideoStopTimeout = setTimeout(() => {
        if (video && !video.paused) {
          video.pause();
        }
      }, stopTime);
    });
    
    // Если метаданные не загрузились, используем минимум 5 секунд
    const fallbackTimeout = setTimeout(() => {
      if (!currentVideoStopTimeout) {
        const stopTime = MIN_VIDEO_DURATION + Math.random() * 5000;
        currentVideoStopTimeout = setTimeout(() => {
          if (video && !video.paused) {
            video.pause();
          }
        }, stopTime);
      }
    }, 1000);
    
    video.addEventListener('loadedmetadata', () => {
      clearTimeout(fallbackTimeout);
    });
    
    currentVideoElement = video;
    homeContentItem.appendChild(video);
  }
}

// Запуск ротации HomeContent
function startHomeContentRotation() {
  // Останавливаем предыдущую ротацию, если она была
  stopHomeContentRotation();
  
  // Показываем контейнер
  homeContentContainer.style.display = 'flex';
  
  // Показываем первый элемент
  homeContentIndex = 0;
  showHomeContentItem(homeContentIndex);
  
  // Функция для перехода к следующему элементу
  function moveToNext() {
    const currentItem = homeContentFiles[homeContentIndex % homeContentFiles.length];
    
    if (currentItem.type === 'image') {
      // Для изображений - 3 секунды
      return 3000;
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
    currentVideoElement.pause();
    currentVideoElement.currentTime = 0;
    currentVideoElement = null;
  }
  
  // Скрываем контейнер
  homeContentContainer.style.display = 'none';
  homeContentItem.innerHTML = '';
}

// =============== ГЛАВНАЯ СТРАНИЦА (HOME) ===============
function showHome(){
  grid.style.display='none';
  projectsList.style.display='none';
  breadcrumb.style.display='none';
  const bioEl = document.getElementById('bio');
  if(bioEl) bioEl.style.display='none';
  const bioContainer = document.getElementById('bio-container');
  if(bioContainer) bioContainer.style.display='none';
  const navCommerce = document.getElementById('nav-commerce');
  const navMind = document.getElementById('nav-mind');
  const navAbout = document.getElementById('nav-about');
  if(navCommerce) {
    navCommerce.style.display='inline';
    navCommerce.style.opacity='1';
  }
  if(navMind) {
    navMind.style.display='inline';
    navMind.style.opacity='1';
  }
  if(navAbout) {
    navAbout.style.display='inline';
    navAbout.style.opacity='1';
  }
  // Показываем HomeContent на главной странице
  if (homeContentFiles.length > 0) {
    startHomeContentRotation();
  } else {
    loadHomeContent();
  }
  // Останавливаем анимацию фона при переходе на главную (если она была запущена на другой странице)
  if (currentSection !== 'home') {
    stopBackgroundAnimation();
  }
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
  // Проверяем, есть ли параметр category в URL
  const urlParams = new URLSearchParams(window.location.search);
  const categoryFromUrl = urlParams.get('category');
  
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
  });
  
  document.getElementById('nav-about')?.addEventListener('click',()=>{ 
    currentSection='about'; 
    stopBackgroundAnimation();
    stopHomeContentRotation();
    grid.style.display='none';
    projectsList.style.display='none';
    breadcrumb.style.display='none';
    const bioEl = document.getElementById('bio');
    if(bioEl) bioEl.style.display='block';
    const bioContainer = document.getElementById('bio-container');
    if(bioContainer) bioContainer.style.display='flex';
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
  
  // Если есть параметр category, автоматически загружаем проекты этой категории
  if(categoryFromUrl) {
    const category = categoryFromUrl.toLowerCase();
    if(category === 'commerce' || category === 'mind') {
      currentSection = category;
      stopHomeContentRotation();
      grid.style.display='none';
      projectsList.style.display='grid';
      breadcrumb.style.display='none';
      const bioEl = document.getElementById('bio');
      if(bioEl) bioEl.style.display='none';
      const bioContainer = document.getElementById('bio-container');
      if(bioContainer) bioContainer.style.display='none';
      if(category === 'commerce') {
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
      } else if(category === 'mind') {
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
      }
      loadProjects(category);
    } else {
      showHome();
    }
  } else {
  showHome();
  }
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

