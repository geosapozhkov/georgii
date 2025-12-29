# Оптимизация видео для быстрой загрузки

## Программные оптимизации (уже реализованы)
- ✅ Агрессивная предзагрузка видео
- ✅ Использование предзагруженных видео напрямую
- ✅ Предзагрузка следующего видео заранее

## Оптимизация самих видео файлов

### 1. Сжатие видео с помощью FFmpeg (РЕКОМЕНДУЕТСЯ)

**Установите FFmpeg:** https://ffmpeg.org/download.html

#### Для HomeContent (короткие видео 5-10 секунд) - ОПТИМАЛЬНЫЙ БАЛАНС:
```bash
ffmpeg -i input.mp4 -c:v libx264 -preset medium -crf 26 -c:a aac -b:a 96k -movflags +faststart -vf "scale=1920:-2" -an output.mp4
```

**Если видео без звука (рекомендуется для HomeContent):**
```bash
ffmpeg -i input.mp4 -c:v libx264 -preset medium -crf 26 -an -movflags +faststart -vf "scale=1920:-2" output.mp4
```

#### Для максимального сжатия (если качество не критично):
```bash
ffmpeg -i input.mp4 -c:v libx264 -preset slow -crf 28 -an -movflags +faststart -vf "scale=1280:-2" output.mp4
```

#### Для высокого качества (если размер не критичен):
```bash
ffmpeg -i input.mp4 -c:v libx264 -preset slow -crf 23 -an -movflags +faststart -vf "scale=1920:-2" output.mp4
```

**Параметры:**
- `-crf 26` - оптимальный баланс качества/размера (18-28, чем больше - тем меньше размер)
  - 23 = высокое качество, большой размер
  - 26 = хороший баланс (рекомендуется)
  - 28 = меньше размер, немного хуже качество
- `-preset medium` - баланс между скоростью кодирования и размером (slow лучше, но дольше)
- `-an` - удаляет аудио (экономит место, для HomeContent обычно не нужен звук)
- `-movflags +faststart` - оптимизация для веб (начинает воспроизведение до полной загрузки) - ОБЯЗАТЕЛЬНО!
- `-vf "scale=1920:-2"` - уменьшение разрешения (1920px ширина, высота автоматически, кратная 2)
  - Для HomeContent: 1920px (Full HD) или 1280px (HD) достаточно

### 2. Онлайн инструменты (если нет FFmpeg)

#### Бесплатные с GUI:
- **HandBrake**: https://handbrake.fr/ (лучший выбор, бесплатно, кроссплатформенный)
  - Настройки: H.264, CRF 26, разрешение 1920x1080, без аудио
- **Shutter Encoder**: https://www.shutterencoder.com/ (бесплатно, много опций)

#### Онлайн (удобно, но ограничения):
- **CloudConvert**: https://cloudconvert.com/ (до 25 файлов бесплатно)
- **Clideo**: https://clideo.com/compress-video (бесплатно, до 500MB)
- **FreeConvert**: https://www.freeconvert.com/video-compressor

### 3. Рекомендации для HomeContent

**Целевые размеры файлов:**
- **5 секунд**: 500KB - 2MB
- **10 секунд**: 1MB - 4MB
- **15 секунд**: 1.5MB - 6MB

**Разрешение:**
- **1920x1080 (Full HD)** - оптимально для десктопа и планшета
- **1280x720 (HD)** - если нужно еще меньше размер

**Битрейт:**
- **1-3 Mbps** для видео без звука
- Разрешение важнее битрейта для визуального качества

### 4. Формат
- **MP4 с H.264** кодеком (лучшая совместимость со всеми браузерами)
- **Без аудио** (`-an`) - экономит 20-30% размера, для HomeContent обычно не нужен
- **WebM** тоже хорош, но MP4 более универсален

### 5. Проверка результата
После оптимизации проверьте:
1. Размер файла уменьшился минимум в 2-3 раза
2. Видео воспроизводится без задержек
3. Качество приемлемое (CRF 26 обычно дает отличный результат)

### Пример скрипта для пакетной обработки HomeContent (Windows):
Создайте файл `optimize-homecontent.bat` в папке `projects/HomeContent`:
```batch
@echo off
echo Оптимизация видео для HomeContent...
for %%f in (video_*.mp4) do (
    echo Обработка: %%f
    ffmpeg -i "%%f" -c:v libx264 -preset medium -crf 26 -an -movflags +faststart -vf "scale=1920:-2" "optimized_%%f"
    echo Готово: optimized_%%f
)
echo Все видео обработаны!
pause
```

### Пример скрипта для пакетной обработки HomeContent (Mac/Linux):
Создайте файл `optimize-homecontent.sh` в папке `projects/HomeContent`:
```bash
#!/bin/bash
echo "Оптимизация видео для HomeContent..."
for file in video_*.mp4; do
    echo "Обработка: $file"
    ffmpeg -i "$file" -c:v libx264 -preset medium -crf 26 -an -movflags +faststart -vf "scale=1920:-2" "optimized_$file"
    echo "Готово: optimized_$file"
done
echo "Все видео обработаны!"
```

**Использование:**
1. Откройте терминал/командную строку
2. Перейдите в папку `projects/HomeContent`
3. Запустите скрипт
4. Проверьте размеры файлов `optimized_*.mp4`
5. Если размеры устраивают, замените оригинальные файлы

### Быстрая команда для одного файла:
```bash
# Перейдите в папку projects/HomeContent
cd projects/HomeContent

# Оптимизируйте одно видео
ffmpeg -i video_000.mp4 -c:v libx264 -preset medium -crf 26 -an -movflags +faststart -vf "scale=1920:-2" video_000_optimized.mp4
```

## Проверка результата
После оптимизации проверьте:
1. Размер файла уменьшился минимум в 2-3 раза
2. Видео воспроизводится без задержек
3. Качество приемлемое для ваших целей

