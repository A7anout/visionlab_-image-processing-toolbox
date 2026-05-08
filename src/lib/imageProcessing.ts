/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Global utility to get pixel data from URL
export const getPixels = async (url: string): Promise<ImageData> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    // Only apply CORS for external URLs
    if (!url.startsWith('data:')) {
      img.crossOrigin = "anonymous";
    }

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No context');
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, img.width, img.height));
      } catch (err) {
        console.error('getPixels error:', err);
        reject('Security Error: Image source does not allow pixel access (CORS).');
      }
    };
    img.onerror = (e) => {
      console.error('Image load failed:', url, e);
      reject('Load failed: The image could not be retrieved.');
    };
    img.src = url;
  });
};

export const toDataURL = (imageData: ImageData): string => {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
};

export const grayscale = (data: ImageData) => {
  const pixels = data.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const avg = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
    pixels[i] = avg;
    pixels[i + 1] = avg;
    pixels[i + 2] = avg;
  }
  return data;
};

// --- Point Operations ---
export const applyNegative = (data: ImageData) => {
  const pixels = data.data;
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 255 - pixels[i];
    pixels[i + 1] = 255 - pixels[i + 1];
    pixels[i + 2] = 255 - pixels[i + 2];
  }
  return data;
};

export const applySolarize = (data: ImageData, threshold: number = 128) => {
  const pixels = data.data;
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = pixels[i] > threshold ? 255 - pixels[i] : pixels[i];
    pixels[i + 1] = pixels[i + 1] > threshold ? 255 - pixels[i + 1] : pixels[i + 1];
    pixels[i + 2] = pixels[i + 2] > threshold ? 255 - pixels[i + 2] : pixels[i + 2];
  }
  return data;
};

export const applyBrightnessContrast = (data: ImageData, brightness: number, contrast: number) => {
  const pixels = data.data;
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = factor * (pixels[i] - 128) + 128 + brightness;
    pixels[i + 1] = factor * (pixels[i + 1] - 128) + 128 + brightness;
    pixels[i + 2] = factor * (pixels[i + 2] - 128) + 128 + brightness;
  }
  return data;
};

// --- Noise & Restoration ---
export const addSaltAndPepper = (data: ImageData, amount: number) => {
  const pixels = data.data;
  for (let i = 0; i < pixels.length; i += 4) {
    if (Math.random() < amount) {
      const val = Math.random() < 0.5 ? 0 : 255;
      pixels[i] = val;
      pixels[i + 1] = val;
      pixels[i + 2] = val;
    }
  }
  return data;
};

export const applyMedianFilter = (data: ImageData, size: number) => {
  const width = data.width;
  const height = data.height;
  const input = new Uint8ClampedArray(data.data);
  const output = data.data;
  const radius = Math.floor(size / 2);

  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      const valuesR = [];
      const valuesG = [];
      const valuesB = [];
      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          valuesR.push(input[idx]);
          valuesG.push(input[idx + 1]);
          valuesB.push(input[idx + 2]);
        }
      }
      valuesR.sort((a, b) => a - b);
      valuesG.sort((a, b) => a - b);
      valuesB.sort((a, b) => a - b);
      const mid = Math.floor(valuesR.length / 2);
      const idx = (y * width + x) * 4;
      output[idx] = valuesR[mid];
      output[idx + 1] = valuesG[mid];
      output[idx + 2] = valuesB[mid];
    }
  }
  return data;
};

export const calculateSNR = (original: ImageData, noisy: ImageData) => {
  let signal = 0;
  let noise = 0;
  for (let i = 0; i < original.data.length; i += 4) {
    const s = original.data[i];
    const n = noisy.data[i] - s;
    signal += s * s;
    noise += n * n;
  }
  if (noise === 0) return 999;
  return 10 * Math.log10(signal / noise);
};

// --- Histogram Operations ---
export const computeHistogram = (data: ImageData) => {
  const histogram = new Array(256).fill(0);
  const pixels = data.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const avg = Math.round((pixels[i] + pixels[i+1] + pixels[i+2]) / 3);
    histogram[avg]++;
  }
  return histogram;
};

export const applyHistogramStretching = (data: ImageData) => {
  const pixels = data.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const avg = (pixels[i] + pixels[i+1] + pixels[i+2]) / 3;
    if (avg < min) min = avg;
    if (avg > max) max = avg;
  }

  if (max === min) return data;

  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = ((pixels[i] - min) / (max - min)) * 255;
    pixels[i+1] = ((pixels[i+1] - min) / (max - min)) * 255;
    pixels[i+2] = ((pixels[i+2] - min) / (max - min)) * 255;
  }
  return data;
};

// --- Morphology ---
export const applyMorphology = (data: ImageData, op: 'dilation' | 'erosion' | 'opening' | 'closing', size: number) => {
  const width = data.width;
  const height = data.height;
  const radius = Math.floor(size / 2);

  const filter = (inputData: Uint8ClampedArray, operation: 'dilation' | 'erosion') => {
    const result = new Uint8ClampedArray(inputData.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let limit = operation === 'dilation' ? 0 : 255;
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const ny = y + ky;
            const nx = x + kx;
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              const idx = (ny * width + nx) * 4;
              const val = inputData[idx];
              limit = operation === 'dilation' ? Math.max(limit, val) : Math.min(limit, val);
            }
          }
        }
        const idx = (y * width + x) * 4;
        result[idx] = result[idx+1] = result[idx+2] = limit;
        result[idx+3] = inputData[idx+3];
      }
    }
    return result;
  };

  const input = new Uint8ClampedArray(data.data);
  let finalBuffer: Uint8ClampedArray;

  if (op === 'opening') {
    const eroded = filter(input, 'erosion');
    finalBuffer = filter(eroded, 'dilation');
  } else if (op === 'closing') {
    const dilated = filter(input, 'dilation');
    finalBuffer = filter(dilated, 'erosion');
  } else {
    finalBuffer = filter(input, op);
  }

  data.data.set(finalBuffer);
  return data;
};

// --- Segmentation ---
export const applyOtsu = (data: ImageData) => {
  const pixels = data.data;
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < pixels.length; i += 4) {
    histogram[Math.round(pixels[i])]++;
  }

  const total = pixels.length / 4;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxVar = 0;
  let threshold = 0;

  for (let i = 0; i < 256; i++) {
    wB += histogram[i];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;

    sumB += i * histogram[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const betweenVar = wB * wF * (mB - mF) * (mB - mF);

    if (betweenVar > maxVar) {
      maxVar = betweenVar;
      threshold = i;
    }
  }

  for (let i = 0; i < pixels.length; i += 4) {
    const val = pixels[i] > threshold ? 255 : 0;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = val;
  }
  return data;
};

export const addGaussianNoise = (data: ImageData, amount: number) => {
  const pixels = data.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const noise = (Math.random() - 0.5) * 255 * amount;
    pixels[i] = Math.min(255, Math.max(0, pixels[i] + noise));
    pixels[i + 1] = Math.min(255, Math.max(0, pixels[i + 1] + noise));
    pixels[i + 2] = Math.min(255, Math.max(0, pixels[i + 2] + noise));
  }
  return data;
};

export const applyGaussianBlur = (data: ImageData) => {
  const kernel = [
    [1, 2, 1],
    [2, 4, 2],
    [1, 2, 1]
  ];
  const weight = 16;
  const width = data.width;
  const height = data.height;
  const input = new Uint8ClampedArray(data.data);
  const output = data.data;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let r = 0, g = 0, b = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const kVal = kernel[ky + 1][kx + 1];
          r += input[idx] * kVal;
          g += input[idx + 1] * kVal;
          b += input[idx + 2] * kVal;
        }
      }
      const idx = (y * width + x) * 4;
      output[idx] = r / weight;
      output[idx + 1] = g / weight;
      output[idx + 2] = b / weight;
    }
  }
  return data;
};

export const applyDithering = (data: ImageData) => {
  const width = data.width;
  const height = data.height;
  const pixels = data.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const oldPixel = pixels[i];
      const newPixel = oldPixel > 128 ? 255 : 0;
      pixels[i] = pixels[i + 1] = pixels[i + 2] = newPixel;
      const error = oldPixel - newPixel;

      // Distribute error to neighbors
      const neighbors = [
        [x + 1, y, 7 / 16],
        [x - 1, y + 1, 3 / 16],
        [x, y + 1, 5 / 16],
        [x + 1, y + 1, 1 / 16]
      ];

      for (const [nx, ny, weight] of neighbors) {
        if (nx >= 0 && nx < width && ny < height) {
          const ni = (ny * width + nx) * 4;
          pixels[ni] += error * (weight as number);
          pixels[ni + 1] += error * (weight as number);
          pixels[ni + 2] += error * (weight as number);
        }
      }
    }
  }
  return data;
};
