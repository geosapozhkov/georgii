// Главная страница - работа с локальными файлами
let currentSection = 'home';

const grid = document.getElementById('file-grid');
const loading = document.getElementById('loading');
const breadcrumb = document.getElementById('breadcrumb');
const viewerOverlay = document.getElementById('viewerOverlay');
const viewerContent = document.getElementById('viewerContent');
const projectsList = document.getElementById('projects-list');

// Текущие элементы
let currentItems = [];
let currentIndex = 0;

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
      const categoryPath = project.category ? `${project.category}/` : '';
      
      // Ищем файл с "cover" в названии
      const coverInfo = await getCoverImageFromProject(project.name, project.category);
      previewUrl = coverInfo.url;
      coverFileName = coverInfo.filename;
      
      // Извлекаем название проекта из имени файла cover_ProjectName_00 или Cover_Project Name_01
      let projectTitleFromCover = project.title || project.name.replace(/_/g, ' ');
      if(coverFileName) {
        // Парсим название из различных форматов:
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
          ${previewUrl ? `
            <div class="project-cover-container">
              <img src="${previewUrl}" alt="${projectTitleFromCover}" class="project-cover-image" onerror="this.parentElement.parentElement.innerHTML='<div class=\\'project-cover-placeholder\\'>Нет превью</div>'">
              ${showTitle ? `
                <div class="project-cover-overlay">
                  <h3 class="project-cover-title">${projectTitleFromCover}</h3>
                </div>
              ` : ''}
            </div>
          ` : `
            <div class="project-cover-placeholder">
              ${showTitle ? `
                <div class="project-cover-overlay">
                  <h3 class="project-cover-title">${projectTitleFromCover}</h3>
                </div>
              ` : `<span>Нет превью</span>`}
            </div>
          `}
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
    const response = await fetch('js/projects.json');
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
  const categoryPath = category ? `${category}/` : '';
  const basePath = `projects/${categoryPath}${projectName}/images`;
  
  // Сначала проверяем files.json для списка файлов
  try {
    const filesResponse = await fetch(`${basePath}/files.json`);
    if(filesResponse.ok) {
      const filesData = await filesResponse.json();
      const files = filesData.files || [];
      
      // Ищем файл с "cover" в названии (приоритет) - ТОЛЬКО изображения (не видео)
      const coverFile = files.find(file => {
        const isImage = /\.(jpe?g|png|gif|webp)$/i.test(file);
        const hasCover = file.toLowerCase().includes('cover');
        return isImage && hasCover;
      });
      
      if(coverFile) {
        return {
          url: `${basePath}/${coverFile}`,
          filename: coverFile
        };
      }
    }
  } catch(e) {
    // Если files.json не найден, продолжаем поиск по стандартным именам
  }
  
  // Fallback 1: Пробуем найти обложку через directory listing
  try {
    const dirResponse = await fetch(`${basePath}/`);
    if(dirResponse.ok) {
      const html = await dirResponse.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const links = doc.querySelectorAll('a');
      
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      
      for(const link of links) {
        let href = link.getAttribute('href');
        if(!href || href === '../' || href === './' || href.includes('?')) continue;
        
        try {
          href = decodeURIComponent(href);
        } catch(e) {
          // Если декодирование не удалось, используем исходное значение
        }
        
        let filename = href.replace(/\/$/, '');
        if(!filename || filename === '..' || filename === '.' || filename === 'files.json') continue;
        
        // Проверяем, что это изображение с "cover" в названии
        const lastDot = filename.lastIndexOf('.');
        if(lastDot === -1) continue;
        
        const ext = filename.substring(lastDot).toLowerCase();
        if(!imageExtensions.includes(ext)) continue;
        
        if(filename.toLowerCase().includes('cover')) {
          const originalHref = link.getAttribute('href');
          return {
            url: `${basePath}/${originalHref}`,
            filename: filename
          };
        }
      }
    }
  } catch(e) {
    // Если directory listing не работает, продолжаем с паттернами
  }
  
  // Fallback 2: ищем файлы с "cover" в названии по стандартным паттернам (с разными вариантами)
  // Пробуем разные варианты: с заглавной буквы, с пробелами в названии проекта, с подчеркиваниями
  const projectNameVariants = [
    projectName, // Angry_Masseur
    projectName.replace(/_/g, ' '), // Angry Masseur
    projectName.replace(/_/g, ''), // AngryMasseur
  ];
  
  const coverPatterns = [];
  // Генерируем паттерны только для изображений (jpg, png, gif, webp)
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  for(const variant of projectNameVariants) {
    for(const ext of imageExtensions) {
      coverPatterns.push(
        `cover_${variant}_00.${ext}`, `cover_${variant}_01.${ext}`,
        `Cover_${variant}_00.${ext}`, `Cover_${variant}_01.${ext}`,
        `Cover_${variant}_cover_00.${ext}`, `Cover_${variant}_cover_01.${ext}`
      );
    }
  }
  for(const ext of imageExtensions) {
    coverPatterns.push(
      `cover_00.${ext}`, `cover_01.${ext}`,
      `Cover_00.${ext}`, `Cover_01.${ext}`,
      `cover.${ext}`, `Cover.${ext}`
    );
  }
  
  for(const name of coverPatterns){
    const url = `${basePath}/${name}`;
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if(response.ok){
        return {
          url: url,
          filename: name
        };
      }
    } catch(e) {
      continue;
    }
  }
  
  return { url: '', filename: '' };
}

// Получаем первое изображение из проекта (для обратной совместимости)
async function getFirstImageFromProject(projectName, category = null){
  const coverInfo = await getCoverImageFromProject(projectName, category);
  return coverInfo.url;
}

// =============== ГЛАВНАЯ СТРАНИЦА (HOME) ===============
function showHome(){
  grid.style.display='none';
  projectsList.style.display='none';
  breadcrumb.style.display='none';
  const bioEl = document.getElementById('bio');
  if(bioEl) bioEl.style.display='none';
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
  }
  
  document.getElementById('nav-commerce')?.addEventListener('click',()=>{ 
    currentSection='commerce'; 
    grid.style.display='none';
    projectsList.style.display='grid';
    breadcrumb.style.display='none';
    const bioEl = document.getElementById('bio');
    if(bioEl) bioEl.style.display='none';
    loadProjects('commerce');
  });
  
  document.getElementById('nav-mind')?.addEventListener('click',()=>{ 
    currentSection='mind'; 
    grid.style.display='none';
    projectsList.style.display='grid';
    breadcrumb.style.display='none';
    const bioEl = document.getElementById('bio');
    if(bioEl) bioEl.style.display='none';
    loadProjects('mind');
  });
  
  document.getElementById('nav-about')?.addEventListener('click',()=>{ 
    currentSection='about'; 
    grid.style.display='none';
    projectsList.style.display='none';
    breadcrumb.style.display='none';
    const bioEl = document.getElementById('bio');
    if(bioEl) bioEl.style.display='block';
  });
  
  // Если есть параметр category, автоматически загружаем проекты этой категории
  if(categoryFromUrl) {
    const category = categoryFromUrl.toLowerCase();
    if(category === 'commerce' || category === 'mind') {
      currentSection = category;
      grid.style.display='none';
      projectsList.style.display='grid';
      breadcrumb.style.display='none';
      const bioEl = document.getElementById('bio');
      if(bioEl) bioEl.style.display='none';
      loadProjects(category);
    } else {
      showHome();
    }
  } else {
    showHome();
  }
});
