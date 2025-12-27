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

// =============== ВСПОМОГАТЕЛЬНОЕ ===============
const isImage = (name) => /\.(jpe?g|png|gif|webp)$/i.test(name);
const isVideo = (name) => /\.(mp4|mov|avi|mkv|webm)$/i.test(name);

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
    // Отслеживаем текущую позицию в grid (для десктопа - 12 колонок)
    let currentColumn = 1; // Начинаем с первой колонки
    const columnsPerImage = 4; // Обычное изображение занимает 4 колонки
    const gapColumns = 1; // Пропускаем 1 колонку между картинками
    
    images.forEach((image, idx) => {
      const wrap = document.createElement('div');
      
      // Проверяем, есть ли "fullwidth" в имени файла (включая fullwidthRepeat)
      const isFullwidth = image.name.toLowerCase().includes('fullwidth');
      const isFullwidthRepeat = image.name.toLowerCase().includes('fullwidthrepeat');
      
      // Если fullwidth, элемент занимает все колонки на всех размерах экрана
      if(isFullwidth){
        wrap.className = 'cursor-pointer col-span-12 w-full';
        wrap.style.width = '100%';
        wrap.style.maxWidth = '100%';
        // Fullwidth сбрасывает позицию - начинаем новую строку
        currentColumn = 1;
      } else {
        // Проверяем, поместится ли изображение с отступом в текущей строке
        // Изображение занимает columnsPerImage колонок, плюс нужен gapColumns отступ после него
        const totalNeeded = columnsPerImage + gapColumns;
        const endColumn = currentColumn + columnsPerImage - 1; // Последняя колонка изображения
        const remainingColumns = 12 - endColumn; // Колонки после изображения
        
        // Если не помещается (не хватает места для картинки + отступа), переносим на новую строку
        if(remainingColumns < gapColumns && currentColumn > 1){
          currentColumn = 1;
        }
        
        // Устанавливаем позицию для десктопа (md+)
        wrap.className = 'cursor-pointer col-span-4 md:col-span-4 flex items-center justify-center';
        // Сохраняем позицию в data-атрибуте для использования в CSS
        wrap.setAttribute('data-grid-start', currentColumn);
        
        // Обновляем позицию для следующего элемента: текущая позиция + ширина картинки + отступ
        currentColumn += columnsPerImage + gapColumns;
        // Если вышли за пределы, начинаем новую строку
        if(currentColumn > 12) {
          currentColumn = 1;
        }
      }

      if(isImage(image.name)){
        // Для fullwidth используем полную ширину без ограничения по высоте
        if(isFullwidth){
          wrap.innerHTML = `<img src="${image.src}" alt="${image.name}" style="width:100%; max-width:100%; height:auto; display:block;">`;
        } else {
          // Обычные изображения: ширина 100%, высота автоматическая, центрированы
          wrap.innerHTML = `<img src="${image.src}" alt="${image.name}" style="width:100%; height:auto; display:block;">`;
        }
        // Изображения не кликабельны - убрали открытие в viewer
      } else if(isVideo(image.name)){
        const video = document.createElement('video');
        const source = document.createElement('source');
        source.src = image.src;
        source.type = 'video/mp4';
        video.appendChild(source);
        
        // Если fullwidthRepeat - простое зацикленное видео на всю ширину без плеера
        if(isFullwidthRepeat) {
          video.className = 'w-full h-auto object-contain';
          video.style.cssText = 'width:100%; max-width:100%; height:auto; display:block;';
          video.autoplay = true;
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          
          // Простой контейнер без контролов
          const videoContainer = document.createElement('div');
          videoContainer.className = 'relative w-full';
          videoContainer.appendChild(video);
          wrap.appendChild(videoContainer);
        }
        // Если fullwidth (но не fullwidthRepeat) - создаём простой видеоплеер с минималистичным интерфейсом
        else if(isFullwidth) {
          // Создаём контейнер для видео
          const videoContainer = document.createElement('div');
          videoContainer.className = 'relative w-full flex items-center justify-center';
          
          video.className = 'w-full h-auto object-contain';
          video.style.cssText = 'width:100%; max-width:100%; height:auto; display:block;';
          video.preload = 'auto';
          video.muted = true;
          video.controls = false; // Отключаем стандартные контролы
          video.playsInline = true;
          
          // Линия прогресса внизу (высота увеличена в 10 раз: 2px -> 20px)
          const progressBar = document.createElement('div');
          progressBar.className = 'video-progress-bar';
          progressBar.style.cssText = 'position:absolute; bottom:0; left:0; right:0; height:20px; background:rgba(172,172,172,0.3); cursor:pointer; opacity:0; transition:opacity 0.3s;';
          
          const progressFill = document.createElement('div');
          progressFill.className = 'video-progress-fill';
          progressFill.style.cssText = 'height:100%; background:#ACACAC; width:0%; transition:width 0.1s linear;';
          progressBar.appendChild(progressFill);
          
          // Иконка Play/Pause (по центру)
          const playPauseBtn = document.createElement('div');
          playPauseBtn.className = 'video-play-pause';
          playPauseBtn.style.cssText = 'position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; transition:opacity 0.3s;';
          playPauseBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" style="width:48px; height:48px; fill:#ACACAC;" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
          
          // Иконка звука (правый нижний угол)
          const volumeBtn = document.createElement('div');
          volumeBtn.className = 'video-volume-btn';
          volumeBtn.style.cssText = 'position:absolute; bottom:24px; right:48px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; cursor:pointer; pointer-events:auto; z-index:10; opacity:0; transition:opacity 0.3s;';
          volumeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" style="width:20px; height:20px; fill:#ACACAC;" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
          
          // Иконка полноэкранного режима (правый нижний угол, рядом со звуком)
          const fullscreenBtn = document.createElement('div');
          fullscreenBtn.className = 'video-fullscreen-btn';
          fullscreenBtn.style.cssText = 'position:absolute; bottom:24px; right:12px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; cursor:pointer; pointer-events:auto; z-index:10; opacity:0; transition:opacity 0.3s;';
          fullscreenBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" style="width:20px; height:20px; fill:#ACACAC;" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
          
          // Обновление иконки звука
          const updateVolumeIcon = () => {
            if(video.muted || video.volume === 0) {
              volumeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" style="width:20px; height:20px; fill:#ACACAC;" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
            } else if(video.volume < 0.5) {
              volumeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" style="width:20px; height:20px; fill:#ACACAC;" viewBox="0 0 24 24"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>';
            } else {
              volumeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" style="width:20px; height:20px; fill:#ACACAC;" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
            }
          };
          
          // Обновление иконки Play/Pause
          const updatePlayPauseIcon = () => {
            if(video.paused) {
              playPauseBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" style="width:48px; height:48px; fill:#ACACAC;" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
            } else {
              playPauseBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" style="width:48px; height:48px; fill:#ACACAC;" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>';
            }
          };
          
          // Обновление иконки полноэкранного режима
          const updateFullscreenIcon = () => {
            if(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
              fullscreenBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" style="width:20px; height:20px; fill:#ACACAC;" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>';
            } else {
              fullscreenBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" style="width:20px; height:20px; fill:#ACACAC;" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
            }
          };
          
          // Показать/скрыть UI элементов
          let hideUITimeout = null;
          
          const showUI = () => {
            // Очищаем таймер скрытия
            if(hideUITimeout) {
              clearTimeout(hideUITimeout);
              hideUITimeout = null;
            }
            
            // Показываем элементы UI (только если видео на паузе - показываем playPauseBtn)
            if(video.paused) {
              playPauseBtn.style.opacity = '1';
            }
            progressBar.style.opacity = '1';
            volumeBtn.style.opacity = '1';
            fullscreenBtn.style.opacity = '1';
            
            // Устанавливаем таймер на скрытие через 1 секунду
            hideUITimeout = setTimeout(() => {
              hideUI();
              hideUITimeout = null;
            }, 1000);
          };
          
          const hideUI = () => {
            playPauseBtn.style.opacity = '0';
            progressBar.style.opacity = '0';
            volumeBtn.style.opacity = '0';
            fullscreenBtn.style.opacity = '0';
            
            if(hideUITimeout) {
              clearTimeout(hideUITimeout);
              hideUITimeout = null;
            }
          };
          
          // Переключение полноэкранного режима
          const toggleFullscreen = () => {
            if(!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
              // Войти в полноэкранный режим
              if(videoContainer.requestFullscreen) {
                videoContainer.requestFullscreen();
              } else if(videoContainer.webkitRequestFullscreen) {
                videoContainer.webkitRequestFullscreen();
              } else if(videoContainer.mozRequestFullScreen) {
                videoContainer.mozRequestFullScreen();
              } else if(videoContainer.msRequestFullscreen) {
                videoContainer.msRequestFullscreen();
              }
            } else {
              // Выйти из полноэкранного режима
              if(document.exitFullscreen) {
                document.exitFullscreen();
              } else if(document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
              } else if(document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
              } else if(document.msExitFullscreen) {
                document.msExitFullscreen();
              }
            }
          };
          
          // Обновление прогресса
          const updateProgress = () => {
            if(video.duration && video.duration > 0) {
              const percent = (video.currentTime / video.duration) * 100;
              progressFill.style.width = percent + '%';
            }
          };
          
          // Обновляем прогресс при воспроизведении
          let progressInterval = null;
          video.addEventListener('play', () => {
            updatePlayPauseIcon();
            progressInterval = setInterval(updateProgress, 100);
          });
          video.addEventListener('pause', () => {
            updatePlayPauseIcon();
            if(progressInterval) {
              clearInterval(progressInterval);
              progressInterval = null;
            }
            updateProgress();
          });
          video.addEventListener('loadedmetadata', updateProgress);
          video.addEventListener('volumechange', updateVolumeIcon);
          
          // События полноэкранного режима
          document.addEventListener('fullscreenchange', updateFullscreenIcon);
          document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);
          document.addEventListener('mozfullscreenchange', updateFullscreenIcon);
          document.addEventListener('MSFullscreenChange', updateFullscreenIcon);
          
          // Инициализация иконок
          updatePlayPauseIcon();
          updateVolumeIcon();
          updateFullscreenIcon();
          
          // UI показывается/скрывается при наведении
          videoContainer.addEventListener('mouseenter', () => {
            showUI();
          });
          
          videoContainer.addEventListener('mouseleave', () => {
            hideUI();
          });
          
          videoContainer.addEventListener('mousemove', () => {
            // При движении мыши показываем UI и сбрасываем таймер
            showUI();
          });
          
          // Клик на видео = play/pause
          videoContainer.addEventListener('click', (e) => {
            // Если клик был на progress bar или кнопках, не обрабатываем здесь
            if(e.target === progressBar || progressBar.contains(e.target) || 
               e.target === volumeBtn || volumeBtn.contains(e.target) ||
               e.target === fullscreenBtn || fullscreenBtn.contains(e.target)) {
              return;
            }
            if(video.paused) {
              video.play();
            } else {
              video.pause();
            }
            showUI(); // Показываем UI при клике
          });
          
          // Клик на progress bar = перемотка
          progressBar.addEventListener('click', (e) => {
            if(!video.duration || video.duration <= 0) return;
            const rect = progressBar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percent = Math.max(0, Math.min(1, clickX / rect.width));
            video.currentTime = percent * video.duration;
            updateProgress();
            showUI(); // Показываем UI при клике
          });
          
          // Клик на кнопку звука
          volumeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            video.muted = !video.muted;
            updateVolumeIcon();
            showUI(); // Показываем UI при клике
          });
          
          // Клик на кнопку полноэкранного режима
          fullscreenBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFullscreen();
            showUI(); // Показываем UI при клике
          });
          
          videoContainer.appendChild(video);
          videoContainer.appendChild(playPauseBtn);
          videoContainer.appendChild(progressBar);
          videoContainer.appendChild(volumeBtn);
          videoContainer.appendChild(fullscreenBtn);
          wrap.appendChild(videoContainer);
        
        } else {
          // Для обычных видео (не fullwidth) - простое автопроигрывание с зацикливанием
          // Без ограничений по высоте и без серого фона
          video.className = 'w-full h-auto object-contain';
          video.style.cssText = 'width:100%; height:auto; display:block;';
          video.autoplay = true;
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          
          // Простой контейнер без контролов и без ограничений
          const videoContainer = document.createElement('div');
          videoContainer.className = 'relative w-full';
          videoContainer.appendChild(video);
          wrap.appendChild(videoContainer);
        }
      } else {
        return; // Пропускаем неизвестные типы файлов
      }
      
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
  const basePath = subfolder 
    ? `projects/${categoryPath}${projectName}${subfolder}/images` 
    : `projects/${categoryPath}${projectName}/images`;
  
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
        
        for(const jsonFile of jsonFiles){
          // Пропускаем файлы с "cover" в названии или соответствующие паттерну обложки
          if(jsonFile.toLowerCase().includes('cover') || coverPattern.test(jsonFile)){
            console.log(`   ⏭️ Пропущен файл (обложка): ${jsonFile}`);
            continue;
          }
          // Правильно кодируем имя файла для URL
          const encodedFile = encodeURIComponent(jsonFile).replace(/'/g, '%27');
          const fileSrc = `${basePath}/${encodedFile}`;
          console.log(`   ✅ Добавлен файл: ${jsonFile} -> ${fileSrc}`);
          foundFiles.push({
            name: jsonFile,
            src: fileSrc,
            number: extractNumber(jsonFile)
          });
        }
        
        // Если нашли файлы через files.json, используем их
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
  if(!projectName){
    loading.textContent='Проект не указан. Вернитесь на главную страницу.';
    return;
  }
  
  // Устанавливаем заголовок
  projectTitle.textContent = projectName.replace(/_/g, ' ');
  document.title = projectName.replace(/_/g, ' ');
  
  // Ссылка "Back to Home" всегда ведет на главную страницу без параметров
  const backLink = document.querySelector('a[href="index.html"]');
  if(backLink) {
    backLink.href = 'index.html';
  }
  
  // Показываем breadcrumb сразу при загрузке страницы
  breadcrumb.style.display = 'flex';
  renderBreadcrumb(projectName, '');
  
  // Загружаем описание проекта
  loadProjectDescription();
  
  // Загружаем контент проекта
  loadProject(projectName);
});
