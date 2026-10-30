#!/usr/bin/env node

// Скрипт для автоматической генерации files.json для проектов
// Использование: node generate-files-list.js [project-name]

const fs = require('fs');
const path = require('path');

const projectPath = process.argv[2] || 'Angry_Masseur';
const imagesPath = path.join(__dirname, 'projects', projectPath, 'images');

if (!fs.existsSync(imagesPath)) {
  console.error(`Папка не найдена: ${imagesPath}`);
  process.exit(1);
}

// Получаем список всех файлов в папке
const allFiles = fs.readdirSync(imagesPath)
  .filter(file => {
    // Игнорируем files.json и другие служебные файлы
    if (file === 'files.json' || file.startsWith('.')) {
      return false;
    }
    // Проверяем, что это изображение или видео
    const ext = path.extname(file).toLowerCase();
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    return imageExts.includes(ext) || videoExts.includes(ext);
  });

// Находим обложку по новому паттерну: Cover_ProjectName_image_00 или Cover_ProjectName_00
// Извлекаем имя проекта из пути
const projectName = path.basename(projectPath);
// Экранируем специальные символы в имени проекта для regex
const escapedProjectName = projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/_/g, '[\\s_]');
const coverPattern = new RegExp(`^Cover_${escapedProjectName}_image_00|^Cover_${escapedProjectName}_00`, 'i');

const coverFile = allFiles.find(file => {
  const ext = path.extname(file).toLowerCase();
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const isImage = imageExts.includes(ext);
  // Проверяем новый паттерн или fallback на старый (для обратной совместимости)
  const matchesPattern = coverPattern.test(file);
  const hasCover = file.toLowerCase().includes('cover');
  return isImage && (matchesPattern || hasCover);
});

// Разделяем файлы на обычные и fullwidth (исключаем обложку из основного списка)
const regularFiles = [];
const fullwidthFiles = [];

allFiles.forEach(file => {
  // Пропускаем обложку - она будет в отдельном поле
  if (file === coverFile) {
    return;
  }
  const isFullwidth = file.toLowerCase().includes('fullwidth');
  if (isFullwidth) {
    fullwidthFiles.push(file);
  } else {
    regularFiles.push(file);
  }
});

// Функция для извлечения числа из имени файла
// Новая система: ProjectName_image_01, ProjectName_video_01, ProjectName_image_fullwidth_01, ProjectName_video_fullwidthRepeat_01
const getNumber = (filename) => {
  // Ищем паттерны для новой системы названий
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
};

// Сортируем оба списка по номерам
regularFiles.sort((a, b) => getNumber(a) - getNumber(b));
fullwidthFiles.sort((a, b) => getNumber(a) - getNumber(b));

// Объединяем файлы: сначала обычные, потом fullwidth
const files = [...regularFiles, ...fullwidthFiles];

// Создаем объект для JSON
const filesList = {
  files: files,
  cover: coverFile || null
};

// Записываем в файл
const outputPath = path.join(imagesPath, 'files.json');
fs.writeFileSync(outputPath, JSON.stringify(filesList, null, 2), 'utf8');

console.log(`✅ Создан файл: ${outputPath}`);
console.log(`📁 Найдено файлов: ${files.length}`);
console.log(`   - Обычных: ${regularFiles.length}`);
console.log(`   - Fullwidth: ${fullwidthFiles.length}`);
if (coverFile) {
  console.log(`   - Обложка: ${coverFile}`);
} else {
  console.log(`   - Обложка: не найдена`);
}
console.log(`📋 Список файлов:`);
files.forEach((file, index) => {
  const type = file.toLowerCase().includes('fullwidth') ? ' [FULLWIDTH]' : '';
  console.log(`   ${index + 1}. ${file}${type}`);
});

