// Страница проекта - работа с локальными файлами
const urlParams = new URLSearchParams(window.location.search);
const projectName = urlParams.get('project') || '';

const grid = document.getElementById('file-grid');
const loading = document.getElementById('loading');
const breadcrumb = document.getElementById('breadcrumb');
const viewerOverlay = document.getElementById('viewerOverlay');
const viewerContent = document.getElementById('viewerContent');
const projectTitle = document.getElementById('project-title');

let currentItems = [];
let currentIndex = 0;

// =============== ВСПОМОГАТЕЛЬНОЕ ===============
const isImage = (name) => /\.(jpe?g|png|gif|webp)$/i.test(name);
const isVideo = (name) => /\.(mp4|mov|avi|mkv|webm)$/i.test(name);

function renderBreadcrumb(projectName, subfolder = ''){
  breadcrumb.innerHTML = '';
  const crumbs = [
    { name:'Home', on: () => window.location.href='index.html' },
    { name:'Projects', on: () => window.location.href='index.html#projects' }
  ];
  
  crumbs.push({ name: projectName, on: () => loadProject(projectName, '') });
  
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
    b.className='hover:underline'; 
    b.textContent=c.name; 
    b.onclick=c.on;
    breadcrumb.appendChild(b); 
    if(i<crumbs.length-1) breadcrumb.append(' / ');
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

  const projectPath = subfolder 
    ? `projects/${projectName}${subfolder}` 
    : `projects/${projectName}`;
  
  const imagesPath = `${projectPath}/images`;
  
  try{
    // Загружаем список файлов из папки images
    console.log(`Загрузка проекта: ${projectName}, подпапка: ${subfolder || 'корневая'}`);
    const images = await getProjectImages(projectName, subfolder);
    console.log(`Загружено файлов: ${images.length}`);
    
    renderBreadcrumb(projectName, subfolder);
    breadcrumb.style.display = 'flex';
    grid.style.display = 'grid';

    if(!images || images.length === 0){
      grid.innerHTML='<div class="col-span-full text-center text-gray-400 border border-dashed rounded-lg p-6">Папка пуста или изображения не найдены.<br>Добавьте файлы с нумерацией (01.jpg, 02.png, image_01.jpg и т.д.) в папку images/</div>';
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
      
      // Проверяем, есть ли "fullwidth" в имени файла
      const isFullwidth = image.name.toLowerCase().includes('fullwidth');
      
      // Если fullwidth, элемент занимает все колонки на всех размерах экрана
      if(isFullwidth){
        wrap.className = 'cursor-pointer col-span-full w-full';
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
        const itemIdx = currentItems.push({ 
          src: image.src, 
          type: 'image', 
          name: image.name 
        }) - 1;
        wrap.onclick = (e)=>{ e.stopPropagation(); openViewer(itemIdx); };
      } else if(isVideo(image.name)){
        // Для fullwidth используем большую высоту
        const maxHeight = isFullwidth ? '24rem' : '12rem';
        // Пытаемся показать превью видео, если доступно
        wrap.innerHTML = `
          <div class="relative bg-gray-200 w-full flex items-center justify-center" style="max-height:${maxHeight};">
            <video class="w-full h-full object-contain" style="max-height:${maxHeight};" preload="metadata" muted>
              <source src="${image.src}" type="video/mp4">
            </video>
            <div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>`;
        const itemIdx = currentItems.push({ 
          src: image.src, 
          type: 'video', 
          name: image.name 
        }) - 1;
        wrap.onclick = (e)=>{ e.stopPropagation(); openViewer(itemIdx); };
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
// Структура: ProjectName_type_width_number.ext
function extractNumber(filename){
  // Ищем паттерны в конце имени файла перед расширением
  // Поддерживаем структуру: ProjectName_type_width_01.ext или ProjectName_type_01.ext
  const patterns = [
    /_(\d+)\.(jpg|jpeg|png|gif|webp|mp4|mov|avi|mkv|webm)$/i,  // _01.jpg, _01.png (основной паттерн)
    /^(\d+)\.(jpg|jpeg|png|gif|webp|mp4|mov|avi|mkv|webm)$/i,  // 01.jpg (без префикса)
    /(\d+)\.(jpg|jpeg|png|gif|webp|mp4|mov|avi|mkv|webm)$/i    // любое число перед расширением
  ];
  
  for(const pattern of patterns){
    const match = filename.match(pattern);
    if(match && match[1]){
      return parseInt(match[1], 10);
    }
  }
  
  // Если номер не найден, возвращаем большое число для сортировки в конец
  return 999999;
}

// Получаем список изображений проекта - оптимизированный поиск по структуре названий
// Структура: ProjectName_type_width_number.ext
// Например: Poool_Angry_Masseur_image_01.png или Poool_Angry_Masseur_image_fullwidth_01.png
async function getProjectImages(projectName, subfolder = ''){
  const basePath = subfolder 
    ? `projects/${projectName}${subfolder}/images` 
    : `projects/${projectName}/images`;
  
  // Всегда делаем автоматический поиск, files.json - опциональное дополнение
  // Это позволяет находить новые файлы автоматически
  
  // Оптимизированный поиск по известной структуре
  const foundFiles = [];
  // Только нужные расширения
  const imageExtensions = ['png', 'webp'];
  const videoExtensions = ['mp4'];
  const types = ['image', 'video'];
  const widths = ['', 'fullwidth']; // пустая строка для обычной ширины
  
  let consecutiveNotFound = 0;
  const maxConsecutiveNotFound = 2; // Останавливаемся после 2 пропусков подряд
  
  // Проверяем файлы по номерам: 1, 2, 3, ... (максимум до 100)
  for(let num = 1; num <= 100; num++){
    let foundAny = false;
    const numStr2 = String(num).padStart(2, '0');
    
    // Проверяем только нужные комбинации по структуре: ProjectName_type_width_number.ext
    for(const type of types){
      const extensions = type === 'image' ? imageExtensions : videoExtensions;
      
      for(const width of widths){
        for(const ext of extensions){
          // Формируем имя файла по структуре
          // Проверяем оба варианта: с одним и двумя подчеркиваниями перед fullwidth
          const filenamesToCheck = [];
          
          if(width){
            // С шириной: ProjectName_type_fullwidth_01.ext или ProjectName_type__fullwidth_01.ext
            filenamesToCheck.push(`${projectName}_${type}_${width}_${numStr2}.${ext}`);
            filenamesToCheck.push(`${projectName}_${type}__${width}_${numStr2}.${ext}`); // двойное подчеркивание
          } else {
            // Без ширины: ProjectName_type_01.ext
            filenamesToCheck.push(`${projectName}_${type}_${numStr2}.${ext}`);
          }
          
          // Проверяем все варианты имени файла
          for(const filename of filenamesToCheck){
            try {
              const response = await fetch(`${basePath}/${filename}`, { method: 'HEAD' });
              if(response.ok){
                foundFiles.push({
                  name: filename,
                  src: `${basePath}/${filename}`,
                  number: num
                });
                foundAny = true;
                consecutiveNotFound = 0;
                console.log(`Найден файл: ${filename}`);
                break; // Нашли файл, переходим к следующему типу/расширению
              }
            } catch(e) {
              // Игнорируем ошибки
            }
          }
          
          if(foundAny) break; // Нашли файл, переходим к следующему типу
        }
        if(foundAny) break; // Нашли файл, переходим к следующему номеру
      }
      if(foundAny) break; // Нашли файл, переходим к следующему номеру
    }
    
    // Если не нашли файл с этим номером
    if(!foundAny){
      consecutiveNotFound++;
      if(consecutiveNotFound >= maxConsecutiveNotFound && foundFiles.length > 0){
        console.log(`Остановка поиска: не найдено файлов за последние ${maxConsecutiveNotFound} номеров`);
        break;
      }
    }
  }
  
  // Если есть files.json, добавляем файлы из него (если их еще нет)
  try {
    const response = await fetch(`${basePath}/files.json`);
    if(response.ok){
      const data = await response.json();
      const jsonFiles = data.files || [];
      console.log(`📋 Найдено ${jsonFiles.length} файлов в files.json`);
      
      for(const jsonFile of jsonFiles){
        const alreadyExists = foundFiles.find(f => f.name === jsonFile);
        if(!alreadyExists){
          // Проверяем, существует ли файл
          try {
            const fileResponse = await fetch(`${basePath}/${jsonFile}`, { method: 'HEAD' });
            if(fileResponse.ok){
              foundFiles.push({
                name: jsonFile,
                src: `${basePath}/${jsonFile}`,
                number: extractNumber(jsonFile)
              });
            }
          } catch(e) {
            // Файл не существует, пропускаем
          }
        }
      }
    }
  } catch(e) {
    // files.json не найден - это нормально
  }
  
  // Сортируем по номеру
  foundFiles.sort((a, b) => a.number - b.number);
  
  console.log(`✅ Найдено ${foundFiles.length} файлов для проекта ${projectName}:`, foundFiles.map(f => f.name));
  
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

// Инициализация
document.addEventListener('DOMContentLoaded', ()=>{
  if(!projectName){
    loading.textContent='Проект не указан. Вернитесь на главную страницу.';
    return;
  }
  
  // Устанавливаем заголовок
  projectTitle.textContent = projectName.replace(/_/g, ' ');
  document.title = projectName.replace(/_/g, ' ');
  
  // Загружаем контент проекта
  loadProject(projectName);
});
