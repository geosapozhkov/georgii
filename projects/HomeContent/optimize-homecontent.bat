@echo off
echo ========================================
echo Оптимизация видео для HomeContent
echo ========================================
echo.

for %%f in (video_*.mp4) do (
    echo [Обработка] %%f
    ffmpeg -i "%%f" -c:v libx264 -preset medium -crf 26 -an -movflags +faststart -vf "scale=1920:-2" "optimized_%%f" -y
    if errorlevel 1 (
        echo [ОШИБКА] Не удалось обработать %%f
    ) else (
        echo [Готово] optimized_%%f
        echo.
    )
)

echo ========================================
echo Все видео обработаны!
echo Проверьте файлы optimized_*.mp4
echo Если размеры устраивают, замените оригинальные файлы
echo ========================================
pause

