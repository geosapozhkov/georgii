// =============== ФУНКЦИОНАЛЬНОСТЬ РИСОВАНИЯ ===============
let drawingCanvas = null;
let drawingContext = null;
let isDrawing = false;
let isErasing = false;
let currentLineWidth = 2;
const MIN_LINE_WIDTH = 1;
const MAX_LINE_WIDTH = 200;
const MOBILE_LINE_WIDTH = 3; // Фиксированная толщина линии для мобильных устройств
const DRAWING_COLOR = '#ACACAC'; // Серый цвет как у текстов

// Проверка, является ли устройство мобильным
function isMobileDevice() {
  return window.innerWidth <= 639 || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// Получение коэффициента масштабирования для высокого разрешения
function getDevicePixelRatio() {
  return window.devicePixelRatio || 1;
}

// Настройка canvas для высокого разрешения
function setupCanvasSize(canvas) {
  const dpr = getDevicePixelRatio();
  const rect = canvas.getBoundingClientRect();
  
  // Устанавливаем внутреннее разрешение canvas с учетом DPR
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  
  // Масштабируем контекст для правильного отображения
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  
  // Применяем настройки сглаживания
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  return ctx;
}

// Создание canvas для рисования
function createDrawingCanvas() {
  // Если canvas уже существует и находится в DOM, просто показываем его и пересоздаем обработчики
  if (drawingCanvas && drawingCanvas.parentNode) {
    // Убеждаемся, что canvas видим и активен
    drawingCanvas.style.display = 'block';
    drawingCanvas.style.pointerEvents = 'auto';
    drawingCanvas.style.touchAction = 'none';
    drawingCanvas.style.webkitTouchCallout = 'none';
    drawingCanvas.style.zIndex = '9998';
    drawingCanvas.style.visibility = 'visible';
    drawingCanvas.style.opacity = '1';
    
    // Восстанавливаем настройки контекста
    if (drawingContext) {
      drawingContext.imageSmoothingEnabled = true;
      drawingContext.imageSmoothingQuality = 'high';
      drawingContext.lineCap = 'round';
      drawingContext.lineJoin = 'round';
      drawingContext.strokeStyle = DRAWING_COLOR;
      drawingContext.lineWidth = isMobileDevice() ? MOBILE_LINE_WIDTH : currentLineWidth;
      drawingContext.shadowBlur = 0.5;
      drawingContext.shadowColor = DRAWING_COLOR;
    }
    
    // ВСЕГДА пересоздаем обработчики событий при восстановлении
    // Это критически важно для работы после переключения страниц
    setupDrawingHandlers();
    
    // Обновляем размер курсора
    updateCursorSize();
    return;
  }
  
  // Если canvas существует, но не в DOM, добавляем его обратно
  if (drawingCanvas && !drawingCanvas.parentNode) {
    document.body.appendChild(drawingCanvas);
    drawingCanvas.style.display = 'block';
    drawingCanvas.style.pointerEvents = 'auto';
    drawingCanvas.style.touchAction = 'none';
    drawingCanvas.style.webkitTouchCallout = 'none';
    drawingCanvas.style.zIndex = '9998';
    
    // Пересоздаем контекст с учетом DPR
    const dpr = getDevicePixelRatio();
    const rect = drawingCanvas.getBoundingClientRect();
    drawingCanvas.width = rect.width * dpr;
    drawingCanvas.height = rect.height * dpr;
    drawingContext = drawingCanvas.getContext('2d');
    drawingContext.scale(dpr, dpr);
    
    // Восстанавливаем настройки контекста
    drawingContext.imageSmoothingEnabled = true;
    drawingContext.imageSmoothingQuality = 'high';
    drawingContext.lineCap = 'round';
    drawingContext.lineJoin = 'round';
    drawingContext.strokeStyle = DRAWING_COLOR;
    drawingContext.lineWidth = isMobileDevice() ? MOBILE_LINE_WIDTH : currentLineWidth;
    drawingContext.shadowBlur = 0.5;
    drawingContext.shadowColor = DRAWING_COLOR;
    
    // ВСЕГДА пересоздаем обработчики событий
    setupDrawingHandlers();
    
    // Обновляем размер курсора
    updateCursorSize();
    return;
  }
  
  // Создаем новый canvas
  drawingCanvas = document.createElement('canvas');
  drawingCanvas.id = 'drawing-canvas';
  drawingCanvas.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: auto;
    z-index: 9998;
    cursor: none;
    image-rendering: auto;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    touch-action: none;
    -webkit-touch-callout: none;
  `;
  
  // Добавляем canvas в body сначала, чтобы получить правильные размеры
  document.body.appendChild(drawingCanvas);
  
  // Настраиваем размеры canvas с учетом DPR для высокого разрешения
  drawingContext = setupCanvasSize(drawingCanvas);
  
  // Настройки контекста для плавного рисования
  drawingContext.imageSmoothingEnabled = true;
  drawingContext.imageSmoothingQuality = 'high';
  drawingContext.lineCap = 'round';
  drawingContext.lineJoin = 'round';
  drawingContext.strokeStyle = DRAWING_COLOR;
  drawingContext.lineWidth = currentLineWidth;
  // Добавляем легкое размытие краев для более плавных линий
  drawingContext.shadowBlur = 0.5;
  drawingContext.shadowColor = DRAWING_COLOR;
  
  // Добавляем canvas в body
  document.body.appendChild(drawingCanvas);
  
  // Обработчики событий
  setupDrawingHandlers();
  
  // Обновляем размер курсора
  updateCursorSize();
}

// Скрытие canvas для рисования (сохраняем для восстановления)
function hideDrawingCanvas() {
  if (drawingCanvas) {
    // Скрываем canvas вместо удаления, чтобы сохранить рисунок
    drawingCanvas.style.display = 'none';
    drawingCanvas.style.pointerEvents = 'none';
    // Удаляем обработчики событий
    removeDrawingHandlers();
    // Сбрасываем флаги рисования
    isDrawing = false;
    isErasing = false;
  }
}

// Удаление canvas для рисования (полное удаление)
function removeDrawingCanvas() {
  if (drawingCanvas) {
    // Удаляем обработчики событий перед удалением canvas
    removeDrawingHandlers();
    drawingCanvas.remove();
    drawingCanvas = null;
    drawingContext = null;
  }
}

let drawingHandlers = {
  mousedown: null,
  mousemove: null,
  mouseup: null,
  mouseleave: null,
  wheel: null,
  contextmenu: null,
  documentWheel: null,
  resize: null,
  touchstart: null,
  touchmove: null,
  touchend: null,
  touchcancel: null
};

// Настройка обработчиков событий для рисования
function setupDrawingHandlers() {
  if (!drawingCanvas) return;
  
  // Сначала удаляем старые обработчики, если они есть
  removeDrawingHandlers();
  
  // Включаем pointer-events и touch-action
  drawingCanvas.style.pointerEvents = 'auto';
  drawingCanvas.style.touchAction = 'none';
  drawingCanvas.style.webkitTouchCallout = 'none';
  
  // Начало рисования
  drawingHandlers.mousedown = (e) => {
    // Проверяем, что мы на странице About me
    const urlParams = new URLSearchParams(window.location.search);
    const section = urlParams.get('section') || 'home';
    if (section !== 'about') {
      disableDrawing();
      return;
    }
    
    // Проверяем, не кликнул ли пользователь по интерактивному элементу
    // Временно отключаем pointer-events у canvas для проверки элемента под курсором
    if (drawingCanvas) {
      drawingCanvas.style.pointerEvents = 'none';
      const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
      drawingCanvas.style.pointerEvents = 'auto';
      
      if (elementBelow && elementBelow !== drawingCanvas && (
        elementBelow.tagName === 'BUTTON' ||
        elementBelow.tagName === 'A' ||
        elementBelow.closest('button') ||
        elementBelow.closest('a') ||
        elementBelow.closest('nav') ||
        elementBelow.closest('#logo') ||
        elementBelow.closest('#custom-cursor') ||
        elementBelow.closest('#viewerOverlay')
      )) {
        // Пропускаем событие дальше для интерактивных элементов
        // Программно вызываем клик на элементе
        setTimeout(() => {
          if (elementBelow) {
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: e.clientX,
              clientY: e.clientY,
              button: e.button
            });
            elementBelow.dispatchEvent(clickEvent);
          }
        }, 0);
        return;
      }
    }
    
    startDrawing(e);
  };
  drawingCanvas.addEventListener('mousedown', drawingHandlers.mousedown);
  
  // Рисование
  drawingHandlers.mousemove = draw;
  drawingCanvas.addEventListener('mousemove', drawingHandlers.mousemove);
  
  // Окончание рисования
  drawingHandlers.mouseup = stopDrawing;
  drawingHandlers.mouseleave = stopDrawing;
  drawingCanvas.addEventListener('mouseup', drawingHandlers.mouseup);
  drawingCanvas.addEventListener('mouseleave', drawingHandlers.mouseleave);
  
  // Touch-события для мобильных устройств
  drawingHandlers.touchstart = (e) => {
    // Проверяем, что мы на странице About me
    const urlParams = new URLSearchParams(window.location.search);
    const section = urlParams.get('section') || 'home';
    if (section !== 'about') {
      disableDrawing();
      return;
    }
    
    // Проверяем, не кликнул ли пользователь по интерактивному элементу
    if (drawingCanvas && e.touches && e.touches.length > 0) {
      drawingCanvas.style.pointerEvents = 'none';
      const elementBelow = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
      drawingCanvas.style.pointerEvents = 'auto';
      
      if (elementBelow && elementBelow !== drawingCanvas && (
        elementBelow.tagName === 'BUTTON' ||
        elementBelow.tagName === 'A' ||
        elementBelow.closest('button') ||
        elementBelow.closest('a') ||
        elementBelow.closest('nav') ||
        elementBelow.closest('#logo') ||
        elementBelow.closest('#custom-cursor') ||
        elementBelow.closest('#viewerOverlay')
      )) {
        return;
      }
    }
    
    startDrawing(e);
  };
  drawingCanvas.addEventListener('touchstart', drawingHandlers.touchstart, { passive: false });
  
  drawingHandlers.touchmove = (e) => {
    draw(e);
  };
  drawingCanvas.addEventListener('touchmove', drawingHandlers.touchmove, { passive: false });
  
  drawingHandlers.touchend = stopDrawing;
  drawingHandlers.touchcancel = stopDrawing;
  drawingCanvas.addEventListener('touchend', drawingHandlers.touchend, { passive: false });
  drawingCanvas.addEventListener('touchcancel', drawingHandlers.touchcancel, { passive: false });
  
  // Изменение размера линии через скролл (на всей странице About me)
  drawingHandlers.wheel = handleWheel;
  drawingCanvas.addEventListener('wheel', drawingHandlers.wheel, { passive: false });
  
  // Также добавляем обработчик скролла на document для страницы About me
  const documentWheelHandler = (e) => {
    // Проверяем, что мы на странице About me
    const urlParams = new URLSearchParams(window.location.search);
    const section = urlParams.get('section') || 'home';
    if (section === 'about') {
      handleWheel(e);
    }
  };
  document.addEventListener('wheel', documentWheelHandler, { passive: false });
  drawingHandlers.documentWheel = documentWheelHandler;
  
  // Обработка правой кнопки мыши для стирания
  drawingHandlers.contextmenu = (e) => {
    e.preventDefault();
  };
  drawingCanvas.addEventListener('contextmenu', drawingHandlers.contextmenu);
  
  // Обработка правой кнопки мыши для стирания
  const handleRightClick = (e) => {
    if (e.button === 2) { // Правая кнопка мыши
      // Проверяем, не кликнул ли пользователь по интерактивному элементу
      if (drawingCanvas) {
        drawingCanvas.style.pointerEvents = 'none';
        const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
        drawingCanvas.style.pointerEvents = 'auto';
        
        if (elementBelow && (
          elementBelow.tagName === 'BUTTON' ||
          elementBelow.tagName === 'A' ||
          elementBelow.closest('button') ||
          elementBelow.closest('a') ||
          elementBelow.closest('nav') ||
          elementBelow.closest('#logo') ||
          elementBelow.closest('#custom-cursor') ||
          elementBelow.closest('#viewerOverlay')
        )) {
          return;
        }
      }
      isErasing = true;
      startDrawing(e);
    }
  };
  drawingCanvas.addEventListener('mousedown', handleRightClick);
  drawingHandlers.mousedownRight = handleRightClick;
  
  // Обновление размеров canvas при изменении размера окна
  const handleResize = () => {
    if (drawingCanvas) {
      const urlParams = new URLSearchParams(window.location.search);
      const section = urlParams.get('section') || 'home';
      if (section === 'about') {
        // Пересоздаем canvas с учетом DPR
        const dpr = getDevicePixelRatio();
        const rect = drawingCanvas.getBoundingClientRect();
        drawingCanvas.width = rect.width * dpr;
        drawingCanvas.height = rect.height * dpr;
        drawingContext = drawingCanvas.getContext('2d');
        drawingContext.scale(dpr, dpr);
        
        // Восстанавливаем настройки контекста
        drawingContext.imageSmoothingEnabled = true;
        drawingContext.imageSmoothingQuality = 'high';
        drawingContext.lineCap = 'round';
        drawingContext.lineJoin = 'round';
        drawingContext.strokeStyle = DRAWING_COLOR;
        drawingContext.lineWidth = isMobileDevice() ? MOBILE_LINE_WIDTH : currentLineWidth;
        drawingContext.shadowBlur = 0.5;
        drawingContext.shadowColor = DRAWING_COLOR;
      }
    }
  };
  window.addEventListener('resize', handleResize);
  drawingHandlers.resize = handleResize;
}

// Удаление обработчиков событий
function removeDrawingHandlers() {
  if (!drawingCanvas) return;
  
  // Безопасно удаляем обработчики, проверяя их наличие
  try {
    if (drawingHandlers.mousedown) {
      drawingCanvas.removeEventListener('mousedown', drawingHandlers.mousedown);
      drawingHandlers.mousedown = null;
    }
    if (drawingHandlers.mousedownRight) {
      drawingCanvas.removeEventListener('mousedown', drawingHandlers.mousedownRight);
      drawingHandlers.mousedownRight = null;
    }
    if (drawingHandlers.mousemove) {
      drawingCanvas.removeEventListener('mousemove', drawingHandlers.mousemove);
      drawingHandlers.mousemove = null;
    }
    if (drawingHandlers.mouseup) {
      drawingCanvas.removeEventListener('mouseup', drawingHandlers.mouseup);
      drawingHandlers.mouseup = null;
    }
    if (drawingHandlers.mouseleave) {
      drawingCanvas.removeEventListener('mouseleave', drawingHandlers.mouseleave);
      drawingHandlers.mouseleave = null;
    }
    if (drawingHandlers.touchstart) {
      drawingCanvas.removeEventListener('touchstart', drawingHandlers.touchstart);
      drawingHandlers.touchstart = null;
    }
    if (drawingHandlers.touchmove) {
      drawingCanvas.removeEventListener('touchmove', drawingHandlers.touchmove);
      drawingHandlers.touchmove = null;
    }
    if (drawingHandlers.touchend) {
      drawingCanvas.removeEventListener('touchend', drawingHandlers.touchend);
      drawingHandlers.touchend = null;
    }
    if (drawingHandlers.touchcancel) {
      drawingCanvas.removeEventListener('touchcancel', drawingHandlers.touchcancel);
      drawingHandlers.touchcancel = null;
    }
    if (drawingHandlers.wheel) {
      drawingCanvas.removeEventListener('wheel', drawingHandlers.wheel);
      drawingHandlers.wheel = null;
    }
    if (drawingHandlers.contextmenu) {
      drawingCanvas.removeEventListener('contextmenu', drawingHandlers.contextmenu);
      drawingHandlers.contextmenu = null;
    }
    if (drawingHandlers.resize) {
      window.removeEventListener('resize', drawingHandlers.resize);
      drawingHandlers.resize = null;
    }
    if (drawingHandlers.documentWheel) {
      document.removeEventListener('wheel', drawingHandlers.documentWheel);
      drawingHandlers.documentWheel = null;
    }
  } catch (e) {
    // Игнорируем ошибки при удалении обработчиков
    console.warn('Ошибка при удалении обработчиков:', e);
  }
}

// Получение координат из события (поддержка mouse и touch)
function getEventCoordinates(e) {
  if (e.touches && e.touches.length > 0) {
    return {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  }
  return {
    x: e.clientX,
    y: e.clientY
  };
}

// Начало рисования
function startDrawing(e) {
  if (!drawingContext) return;
  
  // Предотвращаем стандартное поведение для touch-событий
  if (e.preventDefault) {
    e.preventDefault();
  }
  
  const coords = getEventCoordinates(e);
  
  // Проверяем, не кликнул ли пользователь по интерактивному элементу (только для mouse-событий)
  if (e.type === 'mousedown' && drawingCanvas) {
    drawingCanvas.style.pointerEvents = 'none';
    const elementBelow = document.elementFromPoint(coords.x, coords.y);
    drawingCanvas.style.pointerEvents = 'auto';
    
    if (elementBelow && (
      elementBelow.tagName === 'BUTTON' ||
      elementBelow.tagName === 'A' ||
      elementBelow.closest('button') ||
      elementBelow.closest('a') ||
      elementBelow.closest('nav') ||
      elementBelow.closest('#logo') ||
      elementBelow.closest('#custom-cursor') ||
      elementBelow.closest('#viewerOverlay')
    )) {
      // Пропускаем событие дальше для интерактивных элементов
      setTimeout(() => {
        if (elementBelow) {
          const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: coords.x,
            clientY: coords.y,
            button: e.button || 0
          });
          elementBelow.dispatchEvent(clickEvent);
        }
      }, 0);
      return;
    }
  }
  
  // Предотвращаем стандартное поведение только для правой кнопки мыши
  if (e.button === 2) {
    if (e.preventDefault) {
      e.preventDefault();
    }
  }
  
  isDrawing = true;
  
  drawingContext.beginPath();
  drawingContext.moveTo(coords.x, coords.y);
  
  // Если стирание, используем режим destination-out
  if (isErasing) {
    drawingContext.globalCompositeOperation = 'destination-out';
    const lineWidth = isMobileDevice() ? MOBILE_LINE_WIDTH : currentLineWidth;
    drawingContext.lineWidth = lineWidth * 2; // Стирание чуть больше
    drawingContext.shadowBlur = 0; // Убираем тень при стирании
  } else {
    drawingContext.globalCompositeOperation = 'source-over';
    drawingContext.lineWidth = isMobileDevice() ? MOBILE_LINE_WIDTH : currentLineWidth;
    drawingContext.shadowBlur = 0.5; // Восстанавливаем тень для плавных краев
    drawingContext.shadowColor = DRAWING_COLOR;
  }
}

// Рисование
function draw(e) {
  if (!isDrawing || !drawingContext) return;
  
  // Предотвращаем стандартное поведение для touch-событий
  if (e.preventDefault) {
    e.preventDefault();
  }
  
  const coords = getEventCoordinates(e);
  
  drawingContext.lineTo(coords.x, coords.y);
  drawingContext.stroke();
}

// Остановка рисования
function stopDrawing(e) {
  if (isDrawing) {
    isDrawing = false;
    isErasing = false;
    if (drawingContext) {
      drawingContext.globalCompositeOperation = 'source-over';
    }
  }
}

// Обновление размера курсора в зависимости от размера линии
function updateCursorSize() {
  const customCursor = document.getElementById('custom-cursor');
  if (customCursor) {
    // На мобильных устройствах используем фиксированный размер курсора
    const lineWidth = isMobileDevice() ? MOBILE_LINE_WIDTH : currentLineWidth;
    const cursorSize = Math.max(8, lineWidth);
    customCursor.style.width = cursorSize + 'px';
    customCursor.style.height = cursorSize + 'px';
  }
}

// Обработка скролла для изменения размера линии
function handleWheel(e) {
  // На мобильных устройствах не изменяем размер линии
  if (isMobileDevice()) {
    return;
  }
  
  // Изменяем размер линии в зависимости от направления скролла
  if (e.deltaY > 0) {
    // Скролл вниз - уменьшаем размер
    currentLineWidth = Math.max(MIN_LINE_WIDTH, currentLineWidth - 0.5);
  } else {
    // Скролл вверх - увеличиваем размер
    currentLineWidth = Math.min(MAX_LINE_WIDTH, currentLineWidth + 0.5);
  }
  
  // Обновляем размер линии в контексте
  if (drawingContext) {
    drawingContext.lineWidth = currentLineWidth;
    drawingContext.shadowBlur = 0.5; // Восстанавливаем тень для плавных краев
    drawingContext.shadowColor = DRAWING_COLOR;
  }
  
  // Обновляем размер курсора
  updateCursorSize();
  
  // Не блокируем скролл страницы - позволяем прокрутку
  // e.preventDefault() убран, чтобы не мешать прокрутке страницы
}

// Включение рисования (только на странице About me)
function enableDrawing() {
  // Проверяем текущую секцию через URL
  const urlParams = new URLSearchParams(window.location.search);
  const section = urlParams.get('section') || 'home';
  
  if (section === 'about') {
    // Принудительно пересоздаем canvas и обработчики
    createDrawingCanvas();
    
    // Убеждаемся, что canvas видим и активен
    if (drawingCanvas) {
      drawingCanvas.style.display = 'block';
      drawingCanvas.style.pointerEvents = 'auto';
      drawingCanvas.style.touchAction = 'none';
      drawingCanvas.style.webkitTouchCallout = 'none';
      drawingCanvas.style.zIndex = '9998';
      drawingCanvas.style.visibility = 'visible';
      drawingCanvas.style.opacity = '1';
      
      // Принудительно пересоздаем обработчики с небольшой задержкой
      // чтобы убедиться, что DOM обновился
      setTimeout(() => {
        if (drawingCanvas && drawingCanvas.parentNode) {
          setupDrawingHandlers();
        }
      }, 0);
    }
  }
}

// Отключение рисования (скрываем canvas вместо удаления)
function disableDrawing() {
  hideDrawingCanvas();
  isDrawing = false;
  isErasing = false;
  // Возвращаем размер курсора к стандартному
  const customCursor = document.getElementById('custom-cursor');
  if (customCursor) {
    customCursor.style.width = '8px';
    customCursor.style.height = '8px';
  }
}
