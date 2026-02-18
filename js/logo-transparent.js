// Делает чёрный фон логотипа прозрачным через canvas
(function() {
  const logoImg = document.getElementById('logo');
  if (!logoImg || logoImg.tagName !== 'IMG') return;

  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const threshold = 45;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r < threshold && g < threshold && b < threshold) {
        data[i + 3] = 0;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    logoImg.src = canvas.toDataURL('image/png');
  };
  img.src = logoImg.src;
})();
