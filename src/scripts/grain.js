// Generates a small film-grain tile at runtime (no image files) and exposes it as
// --grain-url for the .grain overlay.
export function initGrain() {
  const root = document.documentElement;
  if (root.style.getPropertyValue('--grain-url')) return;
  const size = 180;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  root.style.setProperty('--grain-url', `url(${c.toDataURL('image/png')})`);
}
