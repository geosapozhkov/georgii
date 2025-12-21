// Главная страница - работа с локальными файлами
let currentSection = 'home';
let galleryImages = [];

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

// =============== ЗАГРУЗКА ПРОЕКТОВ ===============
async function loadProjects(){
  try{
    loading.style.display='block';
    projectsList.innerHTML = '';
    
    // Загружаем список проектов из папки projects/
    // В реальности это будет список папок из projects/
    // Для статического сайта используем конфигурацию
    
    const projects = await getProjectsList();
    
    if(projects.length === 0){
      projectsList.innerHTML = '<div class="col-span-full text-center text-gray-400">Проекты не найдены</div>';
      loading.style.display='none';
      return;
    }

    for(const project of projects){
      const projectCard = document.createElement('a');
      projectCard.href = `project.html?project=${encodeURIComponent(project.name)}`;
      projectCard.className = 'cursor-pointer hover:opacity-75 transition-opacity';
      
      // Пытаемся найти первое изображение для превью
      let previewUrl = '';
      if(project.images && project.images.length > 0){
        previewUrl = `projects/${project.name}/images/${project.images[0]}`;
      } else {
        // Пытаемся загрузить первое изображение из папки
        previewUrl = await getFirstImageFromProject(project.name);
      }
      
      projectCard.innerHTML = `
        <div class="border border-gray-200 rounded-lg overflow-hidden bg-white">
          ${previewUrl ? `<img src="${previewUrl}" alt="${project.title || project.name}" class="w-full h-48 object-cover" onerror="this.parentElement.innerHTML='<div class=\\'w-full h-48 bg-gray-100 flex items-center justify-center text-gray-400\\'>Нет превью</div>'">` : '<div class="w-full h-48 bg-gray-100 flex items-center justify-center text-gray-400">Нет превью</div>'}
          <div class="p-4">
            <h3 class="text-xl font-bold">${project.title || project.name}</h3>
            ${project.description ? `<p class="text-gray-600 text-sm mt-2">${project.description}</p>` : ''}
          </div>
        </div>
      `;
      
      projectsList.appendChild(projectCard);
    }
    
    loading.style.display='none';
  }catch(e){
    console.error('Ошибка загрузки проектов:', e);
    projectsList.innerHTML = '<div class="col-span-full text-center text-gray-400">Ошибка загрузки проектов</div>';
    loading.style.display='none';
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

// Получаем первое изображение из проекта
async function getFirstImageFromProject(projectName){
  // Пытаемся загрузить список изображений
  // Для статического сайта это сложно без сервера
  // Поэтому используем известные имена файлов или конфигурацию
  const commonNames = ['01.jpg', '01.png', 'cover.jpg', 'cover.png', 'preview.jpg', 'preview.png'];
  
  for(const name of commonNames){
    const url = `projects/${projectName}/images/${name}`;
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if(response.ok){
        return url;
      }
    } catch(e) {
      continue;
    }
  }
  return '';
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

// =============== АНИМАЦИЯ ЛОГО ===============
let logoOverlay=null, logoAnimRAF=null, logoInterval=null;

function startLogoAnimation(){
  if(logoOverlay || currentSection!=='home') {
    console.log('Анимация не запущена:', { logoOverlay: !!logoOverlay, currentSection });
    return;
  }
  
  if(galleryImages.length===0){ 
    console.log('Изображения не загружены, загружаем...');
    // Загружаем изображения для анимации лого
    loadLogoGallery().then(() => {
      console.log('Изображения загружены:', galleryImages.length);
      // После загрузки изображений запускаем анимацию, если курсор все еще на лого
      if(galleryImages.length > 0 && currentSection === 'home' && !logoOverlay){
        console.log('Запускаем анимацию после загрузки');
        startLogoAnimation();
      } else {
        console.log('Анимация не запущена после загрузки:', { 
          imagesCount: galleryImages.length, 
          currentSection, 
          logoOverlay: !!logoOverlay 
        });
      }
    });
    return; 
  }
  
  console.log('Запускаем анимацию с', galleryImages.length, 'изображениями');

  logoOverlay=document.createElement('div');
  logoOverlay.style.position='fixed';
  let headerBottom=0;
  const h=document.querySelector('header');
  if(h){ headerBottom=h.getBoundingClientRect().bottom; logoOverlay.style.top=`${headerBottom}px`; } else { logoOverlay.style.top='0px'; }
  const styles=getComputedStyle(document.body);
  logoOverlay.style.left=styles.paddingLeft; logoOverlay.style.right=styles.paddingRight;
  const footer=document.querySelector('footer'); const fh=footer?footer.getBoundingClientRect().height:0;
  const avail=innerHeight-headerBottom-fh; logoOverlay.style.height= (avail>0? `${avail}px` : '40vh');
  logoOverlay.style.pointerEvents='none'; logoOverlay.style.zIndex='9999'; logoOverlay.style.overflow='hidden';
  document.body.appendChild(logoOverlay);

  const img=document.createElement('img'); img.style.position='absolute'; logoOverlay.appendChild(img);
  const bounce={x:0,y:0,w:0,h:0,dx:(Math.random()*2+1)*0.25*(Math.random()<.5?-1:1),dy:(Math.random()*2+1)*0.25*(Math.random()<.5?-1:1)};
  let idx=0;
  function loadNext(){
    const src=galleryImages[idx]; idx=(idx+1)%galleryImages.length;
    img.onload=()=>{ const mw=logoOverlay.clientWidth*.4, mh=logoOverlay.clientHeight*.4;
      let w=img.naturalWidth*2, h=img.naturalHeight*2; const s=Math.min(mw/w,mh/h,1); w*=s; h*=s;
      bounce.w=w; bounce.h=h; img.style.width=w+'px'; img.style.height=h+'px';
      const maxX=logoOverlay.clientWidth-bounce.w, maxY=logoOverlay.clientHeight-bounce.h;
      if(bounce.x>maxX) bounce.x=maxX; if(bounce.y>maxY) bounce.y=maxY;
      img.style.transform=`translate(${bounce.x}px,${bounce.y}px)`;
    };
    img.src=src;
  }
  loadNext(); logoInterval=setInterval(loadNext, 4000);
  (function anim(){ const w=logoOverlay.clientWidth, h=logoOverlay.clientHeight;
    bounce.x+=bounce.dx; bounce.y+=bounce.dy;
    if(bounce.x<=0||bounce.x+bounce.w>=w) bounce.dx*=-1;
    if(bounce.y<=0||bounce.y+bounce.h>=h) bounce.dy*=-1;
    if(bounce.x<0) bounce.x=0; if(bounce.y<0) bounce.y=0;
    if(bounce.x+bounce.w>w) bounce.x=w-bounce.w; if(bounce.y+bounce.h>h) bounce.y=h-bounce.h;
    img.style.transform=`translate(${bounce.x}px,${bounce.y}px)`;
    logoAnimRAF=requestAnimationFrame(anim);
  })();
}

function stopLogoAnimation(){
  if(logoInterval){ clearInterval(logoInterval); logoInterval=null; }
  if(logoAnimRAF){ cancelAnimationFrame(logoAnimRAF); logoAnimRAF=null; }
  if(logoOverlay){ document.body.removeChild(logoOverlay); logoOverlay=null; }
}

async function loadLogoGallery(){
  // Если изображения уже загружены, не загружаем снова
  if(galleryImages.length > 0) {
    return Promise.resolve();
  }
  
  // Загружаем изображения для анимации лого из папки images/logo-gallery/
  try {
    const response = await fetch('images/logo-gallery/files.json');
    if(response.ok){
      const data = await response.json();
      galleryImages = data.files.map(file => `images/logo-gallery/${file}`);
      console.log('Загружено изображений для лого:', galleryImages.length);
      return;
    }
  } catch(e) {
    console.error('Ошибка загрузки logo-gallery/files.json:', e);
  }
  
  // Fallback: пробуем загрузить стандартные имена файлов
  const commonNames = [];
  for(let i = 1; i <= 50; i++){
    commonNames.push(`0${i}`.slice(-2) + '.jpg');
    commonNames.push(`0${i}`.slice(-2) + '.png');
  }
  
  // Проверяем какие файлы существуют
  galleryImages = [];
  for(const name of commonNames){
    try {
      const response = await fetch(`images/logo-gallery/${name}`, { method: 'HEAD' });
      if(response.ok){
        galleryImages.push(`images/logo-gallery/${name}`);
        if(galleryImages.length >= 50) break; // Ограничиваем до 50 изображений
      }
    } catch(e) {
      continue;
    }
  }
  
  console.log('Найдено изображений для лого (fallback):', galleryImages.length);
}

// Инициализация
document.addEventListener('DOMContentLoaded', ()=>{
  const logo=document.getElementById('logo');
  if(logo){ 
    logo.style.cursor='pointer'; 
    logo.addEventListener('mouseenter',startLogoAnimation); 
    logo.addEventListener('mouseleave',stopLogoAnimation);
    logo.addEventListener('click',()=>{ 
      currentSection='home'; 
      showHome(); 
    });
  }
  
  document.getElementById('nav-projects')?.addEventListener('click',()=>{ 
    currentSection='projects'; 
    grid.style.display='none';
    projectsList.style.display='grid';
    breadcrumb.style.display='none';
    loadProjects();
  });
  
  document.getElementById('nav-about')?.addEventListener('click',()=>{ 
    currentSection='about'; 
    grid.style.display='none';
    projectsList.style.display='none';
    breadcrumb.style.display='none';
    const bioEl = document.getElementById('bio');
    if(bioEl) bioEl.style.display='block';
  });
  
  showHome();
  
  // Предзагружаем изображения для анимации лого
  loadLogoGallery();
});
