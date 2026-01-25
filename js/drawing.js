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
  console.log('🟡 createDrawingCanvas вызвана');
  // Если canvas уже существует и находится в DOM, просто показываем его и очищаем
  if (drawingCanvas && drawingCanvas.parentNode) {
    console.log('🟡 Canvas уже существует в DOM');
    // Убеждаемся, что canvas видим и активен
    drawingCanvas.style.display = 'block';
    drawingCanvas.style.visibility = 'visible';
    drawingCanvas.style.opacity = '1';
    drawingCanvas.style.pointerEvents = 'auto';
    drawingCanvas.style.touchAction = 'none';
    drawingCanvas.style.webkitTouchCallout = 'none';
    drawingCanvas.style.zIndex = '9998';
    
    // Очищаем canvas при каждом возврате на страницу About me
    if (drawingContext && drawingCanvas.width > 0 && drawingCanvas.height > 0) {
      drawingContext.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    }
    
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
    } else if (drawingCanvas.width > 0 && drawingCanvas.height > 0) {
      // Только если контекст действительно потерян - восстанавливаем его
      drawingContext = drawingCanvas.getContext('2d');
      // НЕ вызываем scale() повторно - масштаб уже был применен при создании canvas
      // Просто восстанавливаем настройки
      drawingContext.imageSmoothingEnabled = true;
      drawingContext.imageSmoothingQuality = 'high';
      drawingContext.lineCap = 'round';
      drawingContext.lineJoin = 'round';
      drawingContext.strokeStyle = DRAWING_COLOR;
      drawingContext.lineWidth = isMobileDevice() ? MOBILE_LINE_WIDTH : currentLineWidth;
      drawingContext.shadowBlur = 0.5;
      drawingContext.shadowColor = DRAWING_COLOR;
    }
    
    // Обновляем размер курсора
    updateCursorSize();
    return;
  }
  
  // Если canvas существует, но не в DOM, добавляем его обратно и очищаем
  if (drawingCanvas && !drawingCanvas.parentNode) {
    document.body.appendChild(drawingCanvas);
    drawingCanvas.style.display = 'block';
    drawingCanvas.style.visibility = 'visible';
    drawingCanvas.style.opacity = '1';
    drawingCanvas.style.pointerEvents = 'auto';
    drawingCanvas.style.touchAction = 'none';
    drawingCanvas.style.webkitTouchCallout = 'none';
    drawingCanvas.style.zIndex = '9998';
    
    // Восстанавливаем контекст, если он потерян (НЕ меняем размеры canvas!)
    if (!drawingContext && drawingCanvas.width > 0 && drawingCanvas.height > 0) {
      drawingContext = drawingCanvas.getContext('2d');
      // НЕ вызываем scale() повторно - масштаб уже был применен при создании canvas
    }
    
    // Очищаем canvas при каждом возврате на страницу About me
    if (drawingContext && drawingCanvas.width > 0 && drawingCanvas.height > 0) {
      drawingContext.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    }
    
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
  
  // НЕ вызываем setupDrawingHandlers() здесь - это будет сделано в enableDrawing()
  // Обновляем размер курсора
  updateCursorSize();
}

// Скрытие canvas для рисования (очищаем содержимое)
function hideDrawingCanvas() {
  if (drawingCanvas) {
    // Очищаем содержимое canvas при переходе на другую страницу
    if (drawingContext && drawingCanvas.width > 0 && drawingCanvas.height > 0) {
      drawingContext.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    }
    
    // Скрываем canvas
    drawingCanvas.style.opacity = '0';
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
  console.log('🟢 setupDrawingHandlers вызвана');
  if (!drawingCanvas) {
    console.error('🟢 setupDrawingHandlers: drawingCanvas не существует');
    return;
  }
  
  if (!drawingCanvas.parentNode) {
    console.log('🟢 setupDrawingHandlers: canvas не в DOM, добавляем...');
    // Если canvas не в DOM, добавляем его
    document.body.appendChild(drawingCanvas);
  }
  
  // Сначала удаляем старые обработчики, если они есть
  console.log('🟢 setupDrawingHandlers: удаляем старые обработчики...');
  removeDrawingHandlers();
  
  // Включаем pointer-events и touch-action
  drawingCanvas.style.pointerEvents = 'auto';
  drawingCanvas.style.touchAction = 'none';
  drawingCanvas.style.webkitTouchCallout = 'none';
  drawingCanvas.style.zIndex = '9998';
  
  console.log('🟢 setupDrawingHandlers: создаем новые обработчики...');
  
  // Начало рисования
  drawingHandlers.mousedown = (e) => {
    console.log('🟣 mousedown обработчик вызван!', e);
    // Проверяем, что мы на странице About me
    const urlParams = new URLSearchParams(window.location.search);
    const section = urlParams.get('section') || 'home';
    console.log('🟣 Текущая секция в mousedown:', section);
    if (section !== 'about') {
      console.log('🟣 Секция не about, отключаем рисование');
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
    
    console.log('🟣 Проверка интерактивных элементов пройдена, вызываем startDrawing...');
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
  
  console.log('🟢 setupDrawingHandlers: все обработчики успешно прикреплены');
  console.log('🟢 drawingCanvas:', drawingCanvas);
  console.log('🟢 drawingContext:', drawingContext);
  console.log('🟢 drawingCanvas.parentNode:', drawingCanvas.parentNode);
  console.log('🟢 drawingCanvas.style.pointerEvents:', drawingCanvas.style.pointerEvents);
}

// Удаление обработчиков событий
function removeDrawingHandlers() {
  // Удаляем обработчики даже если canvas скрыт или не существует
  // Это важно для полной очистки всех обработчиков
  
  // Безопасно удаляем обработчики с canvas, если он существует
  if (drawingCanvas) {
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
    } catch (e) {
      // Игнорируем ошибки при удалении обработчиков с canvas
    }
  }
  
  // ВСЕГДА удаляем обработчики с window и document, даже если canvas не существует
  try {
    if (drawingHandlers.resize) {
      window.removeEventListener('resize', drawingHandlers.resize);
      drawingHandlers.resize = null;
    }
    if (drawingHandlers.documentWheel) {
      document.removeEventListener('wheel', drawingHandlers.documentWheel);
      drawingHandlers.documentWheel = null;
    }
  } catch (e) {
    // Игнорируем ошибки при удалении обработчиков с window/document
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
  console.log('🟠 startDrawing вызвана', e);
  if (!drawingContext) {
    console.error('🟠 startDrawing: drawingContext не существует!');
    return;
  }
  
  console.log('🟠 startDrawing: drawingContext существует');
  
  // Предотвращаем стандартное поведение для touch-событий
  if (e.preventDefault) {
    e.preventDefault();
  }
  
  const coords = getEventCoordinates(e);
  console.log('🟠 startDrawing: координаты', coords);
  
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
  console.log('🟠 startDrawing: isDrawing установлен в true');
  
  drawingContext.beginPath();
  drawingContext.moveTo(coords.x, coords.y);
  console.log('🟠 startDrawing: начата линия в', coords.x, coords.y);
  
  // Если стирание, используем режим destination-out
  if (isErasing) {
    console.log('🟠 startDrawing: режим стирания');
    drawingContext.globalCompositeOperation = 'destination-out';
    const lineWidth = isMobileDevice() ? MOBILE_LINE_WIDTH : currentLineWidth;
    drawingContext.lineWidth = lineWidth * 2; // Стирание чуть больше
    drawingContext.shadowBlur = 0; // Убираем тень при стирании
  } else {
    console.log('🟠 startDrawing: режим рисования');
    drawingContext.globalCompositeOperation = 'source-over';
    drawingContext.lineWidth = isMobileDevice() ? MOBILE_LINE_WIDTH : currentLineWidth;
    drawingContext.shadowBlur = 0.5; // Восстанавливаем тень для плавных краев
    drawingContext.shadowColor = DRAWING_COLOR;
  }
  console.log('🟠 startDrawing завершена');
}

// Рисование
function draw(e) {
  if (!isDrawing || !drawingContext) {
    if (!isDrawing) console.log('🟡 draw: isDrawing = false, пропускаем');
    if (!drawingContext) console.log('🟡 draw: drawingContext отсутствует, пропускаем');
    return;
  }
  
  // Предотвращаем стандартное поведение для touch-событий
  if (e.preventDefault) {
    e.preventDefault();
  }
  
  const coords = getEventCoordinates(e);
  
  drawingContext.lineTo(coords.x, coords.y);
  drawingContext.stroke();
  console.log('🟡 draw: линия нарисована в', coords.x, coords.y);
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
  // Увеличена скорость изменения в 1.5 раза (с 0.5 до 0.75)
  if (e.deltaY > 0) {
    // Скролл вниз - уменьшаем размер
    currentLineWidth = Math.max(MIN_LINE_WIDTH, currentLineWidth - 0.75);
  } else {
    // Скролл вверх - увеличиваем размер
    currentLineWidth = Math.min(MAX_LINE_WIDTH, currentLineWidth + 0.75);
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
  console.log('🔵 enableDrawing вызвана');
  // Проверяем текущую секцию через URL
  const urlParams = new URLSearchParams(window.location.search);
  let section = urlParams.get('section') || 'home';
  
  // Если секция из URL не 'about', но мы знаем что должны быть на about (через window.currentSection),
  // используем это как запасной вариант
  if (section !== 'about' && typeof window !== 'undefined' && window.currentSection === 'about') {
    console.log('🔵 URL еще не обновлен, используем window.currentSection:', window.currentSection);
    section = 'about';
  }
  
  console.log('🔵 Текущая секция:', section);
  
  if (section === 'about') {
    console.log('🔵 Секция about, создаем canvas...');
    // Сначала удаляем все старые обработчики, чтобы избежать конфликтов
    removeDrawingHandlers();
    
    // Принудительно пересоздаем canvas (он будет очищен)
    createDrawingCanvas();
    
    // Убеждаемся, что canvas видим и активен
    if (drawingCanvas) {
      console.log('🔵 Canvas существует, настраиваем стили и обработчики...');
      drawingCanvas.style.display = 'block';
      drawingCanvas.style.visibility = 'visible';
      drawingCanvas.style.opacity = '1';
      drawingCanvas.style.pointerEvents = 'auto';
      drawingCanvas.style.touchAction = 'none';
      drawingCanvas.style.webkitTouchCallout = 'none';
      drawingCanvas.style.zIndex = '9998';
      
      // Убеждаемся, что canvas находится в DOM
      if (!drawingCanvas.parentNode) {
        console.log('🔵 Canvas не в DOM, добавляем...');
        document.body.appendChild(drawingCanvas);
      }
      
      // КРИТИЧЕСКИ ВАЖНО: Пересоздаем обработчики СРАЗУ и СИНХРОННО
      // Убеждаемся, что canvas и контекст готовы перед прикреплением обработчиков
      console.log('🔵 Вызываем setupDrawingHandlers() синхронно...');
      if (drawingCanvas && drawingCanvas.parentNode && drawingContext) {
        setupDrawingHandlers();
        console.log('🔵 enableDrawing завершена');
      } else {
        console.error('🔴 Canvas или контекст не готовы!');
        console.error('🔴 drawingCanvas:', drawingCanvas);
        console.error('🔴 drawingCanvas.parentNode:', drawingCanvas?.parentNode);
        console.error('🔴 drawingContext:', drawingContext);
      }
    } else {
      console.error('🔴 Canvas не создан!');
    }
  } else {
    console.log('🔵 Секция не about, рисование не включается');
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
