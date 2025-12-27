#!/usr/bin/env node

// Скрипт для автоматической генерации files.json для проектов
// Использование: node generate-files-list.js [project-name]
// Для проектов с категориями: node generate-files-list.js Commerce/ProjectName

const fs = require('fs');
const path = require('path');

const projectPath = process.argv[2] || 'Commerce/Angry_Masseur';
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

// Находим обложку (изображение с "cover" в названии)
const coverFile = allFiles.find(file => {
  const ext = path.extname(file).toLowerCase();
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const isImage = imageExts.includes(ext);
  const hasCover = file.toLowerCase().includes('cover');
  return isImage && hasCover;
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
const getNumber = (filename) => {
  const match = filename.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 999999;
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

