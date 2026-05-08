/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  RefreshCw, 
  Info, 
  Sliders, 
  Zap, 
  Code,
  Droplets,
  Layers,
  ChevronDown,
  Scissors,
  Github,
  Heart,
  BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import * as IP from './lib/imageProcessing';

// --- Types & Constants ---
const SAMPLE_IMAGES = [
  { id: 'camera', name: 'Camera', url: 'https://picsum.photos/id/250/1000/750', desc: 'Standard test image for edges/textures' },
  { id: 'coins', name: 'Coins', url: 'https://picsum.photos/id/200/1000/750', desc: 'Ideal for segmentation/morphology' },
  { id: 'coffee', name: 'Coffee', url: 'https://picsum.photos/id/63/1000/750', desc: 'Complex textures and color gradients' },
  { id: 'astronaut', name: 'Astronaut', url: 'https://picsum.photos/id/65/1000/750', desc: 'Portrait for enhancement tests' },
  { id: 'chelsea', name: 'Chelsea Cat', url: 'https://picsum.photos/id/219/1000/750', desc: 'Fine detail (fur) for restoration' },
  { id: 'horse', name: 'Horse', url: 'https://picsum.photos/id/191/1000/750', desc: 'Clear silhouette for morphology' },
  { id: 'text', name: 'Book Text', url: 'https://picsum.photos/id/24/1000/750', desc: 'OCR and thresholding testing' },
  { id: 'nature', name: 'Rocks', url: 'https://picsum.photos/id/101/1000/750', desc: 'High frequency texture' }
];

const CATEGORIES = [
  {
    id: 'enhancement',
    name: 'Image enhancement',
    icon: Zap,
    subcategories: [
      {
        name: 'Histogram Operations',
        ops: [
          { id: 'hist_compute', name: 'Histogram computation', help: 'Visualizes the distribution of pixel intensities.' },
          { id: 'hist_stretch', name: 'Histogram Stretching', help: 'Increases contrast by mapping intensities to the full 0-255 range.' }
        ]
      },
      {
        name: 'Point operations',
        ops: [
          { id: 'add_sub', name: 'Add/sub (Brightness)', help: 'Directly adjusts luminosity by adding or subtracting a constant value.' },
          { id: 'solarization', name: 'Solarization', help: 'Inverts pixels above a certain threshold for a surreal effect.' }
        ]
      }
    ]
  },
  {
    id: 'restoration',
    name: 'Image restoration',
    icon: Droplets,
    subcategories: [
      {
        name: 'Restoration Sandbox',
        ops: [
          { id: 'restoration_sandbox', name: 'Noise & Filter Lab', help: 'Combined laboratory: Add synthetic noise and apply restoration filters to study signal recovery.' }
        ]
      }
    ]
  },
  {
    id: 'morphology',
    name: 'Morphological processing',
    icon: Layers,
    subcategories: [
      {
        name: 'Operations',
        ops: [
          { id: 'dilation', name: 'Dilation', help: 'Expands light areas by taking the local maximum.' },
          { id: 'erosion', name: 'Erosion', help: 'Shrinks light areas by taking the local minimum.' },
          { id: 'opening', name: 'Opening', help: 'Erosion followed by Dilation: removes small bright artifacts.' },
          { id: 'closing', name: 'Closing', help: 'Dilation followed by Erosion: fills small gaps in bright areas.' }
        ]
      }
    ]
  },
  {
    id: 'segmentation',
    name: 'Segmentation',
    icon: Scissors,
    subcategories: [
      {
        name: 'Thresholding',
        ops: [
          { id: 'threshold_global', name: 'Global Thresholding', help: 'Converts to binary using a static user-defined intensity.' },
          { id: 'threshold_otsu', name: 'Otsu method', help: 'Automatically calculates the optimal threshold to minimize intra-class variance.' }
        ]
      },
      {
        name: 'Dithering',
        ops: [
          { id: 'dithering_fs', name: 'Floyd–Steinberg dithering', help: 'A high-quality error-diffusion algorithm that preserves perceived detail.' }
        ]
      }
    ]
  }
];

export default function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(SAMPLE_IMAGES[0].url);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [activeOpId, setActiveOpId] = useState<string>('hist_compute');
  const [isGrayscaleInfo, setIsGrayscaleInfo] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snr, setSnr] = useState<number | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [histogramDataBefore, setHistogramDataBefore] = useState<{name: string, value: number}[]>([]);
  const [histogramDataAfter, setHistogramDataAfter] = useState<{name: string, value: number}[]>([]);

  const [controls, setControls] = useState({
    brightness: 0,
    solarizeThreshold: 128,
    noiseAmount: 0.1,
    restorationNoiseType: 'gaussian' as 'gaussian' | 'salt_and_pepper' | 'none',
    restoreFilterEnabled: true,
    morphKernelSize: 3,
    threshold: 128
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeOp = useMemo(() => {
    for (const cat of CATEGORIES) {
      for (const sub of cat.subcategories) {
        const found = sub.ops.find(op => op.id === activeOpId);
        if (found) return found;
      }
    }
    return CATEGORIES[0].subcategories[0].ops[0];
  }, [activeOpId]);

  const activeCategory = useMemo(() => {
    return CATEGORIES.find(cat => cat.subcategories.some(sub => sub.ops.find(op => op.id === activeOpId)));
  }, [activeOpId]);

  const processImage = useCallback(async () => {
    if (!originalImage) return;
    setProcessing(true);
    setSnr(null);
    setHistogramDataBefore([]);
    setHistogramDataAfter([]);

    try {
      setError(null);
      const imgData = await IP.getPixels(originalImage);
      
      // Before histogram for specific operations
      if (activeOpId === 'hist_compute' || activeOpId === 'hist_stretch') {
        const hBefore = IP.computeHistogram(imgData);
        setHistogramDataBefore(hBefore.map((v, i) => ({ name: i.toString(), value: v })));
      }

      // Create a copy for processing
      const outputBuffer = new Uint8ClampedArray(imgData.data);
      let output: ImageData = new ImageData(outputBuffer, imgData.width, imgData.height);
      
      const morphOps = ['dilation', 'erosion', 'opening', 'closing'];
      const needsGrayscale = morphOps.includes(activeOpId) || activeOpId === 'threshold_otsu' || activeOpId === 'threshold_global';
      
      if (needsGrayscale) {
        output = IP.grayscale(output);
        setIsGrayscaleInfo(true);
      } else {
        setIsGrayscaleInfo(false);
      }

      switch (activeOpId) {
        // Enhancement
        case 'hist_compute':
          // Already computed hBefore, we'll just use it
          break;
        case 'hist_stretch':
          output = IP.applyHistogramStretching(output);
          const hAfter = IP.computeHistogram(output);
          setHistogramDataAfter(hAfter.map((v, i) => ({ name: i.toString(), value: v })));
          break;
        case 'add_sub':
          output = IP.applyBrightnessContrast(output, controls.brightness, 0);
          break;
        case 'solarization':
          output = IP.applySolarize(output, controls.solarizeThreshold);
          break;

        // Restoration Sandbox
        case 'restoration_sandbox':
          // 1. Add noise
          if (controls.restorationNoiseType === 'salt_and_pepper') {
            output = IP.addSaltAndPepper(output, controls.noiseAmount);
          } else if (controls.restorationNoiseType === 'gaussian') {
            output = IP.addGaussianNoise(output, controls.noiseAmount);
          }
          
          // Calculate SNR after noise (optional, but requested context implies showing recovery)
          setSnr(IP.calculateSNR(imgData, output));

          // 2. Apply filter
          if (controls.restoreFilterEnabled) {
            output = IP.applyGaussianBlur(output);
          }
          break;

        // Morphology
        case 'dilation':
        case 'erosion':
        case 'opening':
        case 'closing':
          output = IP.applyMorphology(output, activeOpId as any, controls.morphKernelSize);
          break;

        // Segmentation
        case 'threshold_global':
          const pixels = output.data;
          for (let i = 0; i < pixels.length; i += 4) {
             const val = pixels[i] > controls.threshold ? 255 : 0;
             pixels[i] = pixels[i+1] = pixels[i+2] = val;
          }
          break;
        case 'threshold_otsu':
          output = IP.applyOtsu(output);
          break;
        case 'dithering_fs':
          output = IP.applyDithering(output);
          break;
      }

      setProcessedImage(IP.toDataURL(output));
    } catch (err) {
      console.error(err);
      setError(typeof err === 'string' ? err : 'Processing failed. Check console for details.');
    } finally {
      setProcessing(false);
    }
  }, [originalImage, activeOpId, controls]);

  useEffect(() => {
    const timer = setTimeout(() => {
      processImage();
    }, 300);
    return () => clearTimeout(timer);
  }, [processImage]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setOriginalImage(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const getCodeSnippet = () => {
    switch (activeOpId) {
      case 'hist_compute': return `def compute_histogram(image):\n    hist, bins = np.histogram(image.flatten(), 256, [0,256])\n    return hist`;
      case 'hist_stretch': return `def stretching(img):\n    imin, imax = img.min(), img.max()\n    return (img - imin) * (255 / (imax - imin))`;
      case 'add_sub': return `def brightness(img, val):\n    return np.clip(img.astype(np.int16) + val, 0, 255).astype(np.uint8)`;
      case 'solarization': return `def solarize(img, T):\n    return np.where(img > T, 255 - img, img)`;
      case 'restoration_sandbox': return `import numpy as np\nfrom scipy.ndimage import gaussian_filter\n\n# 1. Noise Injection\ndef add_noise(image, mode='gaussian', amount=0.1):\n    if mode == 'gaussian':\n        return image + np.random.normal(0, amount, image.shape)\n    return image # ... logic\n\n# 2. Restoration\nrestored = gaussian_filter(noisy_image, sigma=1)`;
      case 'dilation': return `from skimage.morphology import dilation, disk\nresult = dilation(image, disk(radius=3))`;
      case 'threshold_otsu': return `from skimage.filters import threshold_otsu\nbinary = image > threshold_otsu(image)`;
      default: return `# Operation Logic for ${activeOp?.name}\n# Implementation details are available in lib/imageProcessing.ts`;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden text-sm bg-[#0e1117] text-[#fafafa] font-sans">
      {/* Sidebar */}
      <aside className="w-[320px] bg-[#262730] border-r border-[#ffffff1a] flex flex-col shrink-0">
        <div className="p-6 flex-1 overflow-y-auto space-y-8 scrollbar-hide">
          <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#ff4b4b] to-[#ff8e8e] bg-clip-text text-transparent">
              VisionLab
            </h1>
            <p className="text-[#ffffff99] text-[10px] uppercase tracking-widest mt-1 font-bold">Image Processing Studio</p>
          </motion.div>

          <section className="space-y-4">
            <h3 className="text-xs font-bold text-[#ffffff4d] uppercase flex items-center gap-2">
              <ImageIcon size={14} /> Acquisition
            </h3>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#ff4b4b] hover:bg-[#ff4b4bdf] transition-colors rounded-xl text-white font-bold shadow-lg shadow-[#ff4b4b26]"
            >
              <Upload size={14} /> Upload Image
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
            
            <div className="relative group">
              <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide snap-x">
                {SAMPLE_IMAGES.map(img => (
                  <button 
                    key={img.id} 
                    onClick={() => setOriginalImage(img.url)} 
                    className={`shrink-0 w-20 aspect-square bg-[#0e1117] rounded-lg border transition-all overflow-hidden snap-start ${originalImage === img.url ? 'border-[#ff4b4b] scale-95 ring-4 ring-[#ff4b4b1a]' : 'border-[#ffffff1a] hover:border-[#ffffff33]'}`}
                    title={img.desc}
                  >
                    <img src={img.url} className={`w-full h-full object-cover transition-opacity ${originalImage === img.url ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`} />
                  </button>
                ))}
              </div>
              <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-[#262730] to-transparent pointer-events-none" />
            </div>
          </section>

          <section className="space-y-6">
             <h3 className="text-xs font-bold text-[#ffffff4d] uppercase flex items-center gap-2">
              <BarChart3 size={14} /> Processing Toolbox
            </h3>
            {CATEGORIES.map(cat => (
              <div key={cat.id} className="space-y-4">
                 <div className="flex items-center gap-2 text-[#ffffffb3] px-2">
                    <cat.icon size={14} className="text-[#ff4b4b]" />
                    <span className="text-xs font-bold">{cat.name}</span>
                 </div>
                 <div className="space-y-4 pl-4 border-l border-[#ffffff0a]">
                    {cat.subcategories.map(sub => (
                      <div key={sub.name} className="space-y-2">
                         <p className="text-[10px] text-[#ffffff33] font-bold uppercase tracking-wider pl-2">{sub.name}</p>
                         <div className="space-y-1">
                            {sub.ops.map(op => (
                              <button
                                key={op.id}
                                onClick={() => setActiveOpId(op.id)}
                                className={`w-full text-left px-3 py-1.5 rounded-lg transition-all text-[13px] ${
                                  activeOpId === op.id ? 'bg-[#ff4b4b1a] text-[#ff4b4b] font-medium' : 'text-[#ffffff66] hover:bg-[#ffffff05] hover:text-[#fafafa]'
                                }`}
                              >
                                {op.name}
                              </button>
                            ))}
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            ))}
          </section>
        </div>

        {/* About Section Footer */}
        <section className="p-6 border-t border-[#ffffff1a] bg-[#0e1117]/30">
          <div className="space-y-4">
             <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-[#ff4b4b]">
                   <Heart size={14} fill="currentColor" />
                   <p className="text-[11px] font-bold text-[#fafafa]">About the Project</p>
                </div>
                <p className="text-[10px] text-[#ffffff66] leading-tight mt-1">
                  Made with ❤️ by <strong>Ahmed Hanout</strong><br/>
                  for <strong>Dr. Arwa</strong> & <strong>Eng. Ahmed Essam</strong>
                </p>
             </div>
             <a 
              href="https://github.com" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-2 text-[10px] text-[#ffffff33] hover:text-[#fafafa] transition-colors mt-2"
            >
               <Github size={12} />
               <span>View code on github</span>
             </a>
          </div>
        </section>
      </aside>

      {/* Main Area */}
      <main className="flex-1 overflow-y-auto bg-[#0e1117] relative scroll-smooth">
        <div className="max-w-6xl mx-auto p-12 space-y-12">
          
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center justify-between gap-4 text-red-500 backdrop-blur-sm">
                <div className="flex items-center gap-4"><Info size={18} /><p className="text-sm font-medium">{error}</p></div>
                <button onClick={() => processImage()} className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors">Retry</button>
              </motion.div>
            )}
            {isGrayscaleInfo && !error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-[#ff4b4b0d] border border-[#ff4b4b26] p-4 rounded-xl flex items-center gap-4 text-[#ff4b4b] backdrop-blur-sm">
                <Info size={18} /><p className="text-sm font-medium">Auto-Grayscale: This algorithm requires luminosity data.</p>
              </motion.div>
            )}
          </AnimatePresence>

          <header className="space-y-4">
            <div className="flex items-center gap-3">
               <div className="p-3 bg-[#ff4b4b1a] rounded-2xl text-[#ff4b4b]">
                 {activeCategory && <activeCategory.icon size={26} />}
               </div>
               <div>
                  <h2 className="text-3xl font-bold tracking-tight text-[#fafafa]">{activeOp?.name}</h2>
                  <p className="text-[#ffffff66]">{activeCategory?.name}</p>
               </div>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-12">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#ffffff33]">Input Stream</span>
              </div>
              <div className="aspect-[4/3] bg-[#161b22] rounded-3xl border border-[#ffffff0d] overflow-hidden flex items-center justify-center group relative shadow-2xl">
                {originalImage ? <img src={originalImage} className="w-full h-full object-contain" /> : <div className="text-center opacity-20"><ImageIcon size={64} /><p className="text-xs mt-4">Offline</p></div>}
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#ff4b4b99]">Result Pipeline</span>
                {snr !== null && <span className="text-[10px] text-[#ff4b4b66] font-mono tracking-widest">SNR: {snr.toFixed(2)} dB</span>}
              </div>
              <div className="aspect-[4/3] bg-[#161b22] rounded-3xl border border-[#ff4b4b26] overflow-hidden flex items-center justify-center relative shadow-2xl shadow-[#ff4b4b05]">
                {processedImage ? <img src={processedImage} className="w-full h-full object-contain" /> : <div className="text-center opacity-20 animate-pulse"><RefreshCw size={64} /><p className="text-xs mt-4">Synthesizing...</p></div>}
                <AnimatePresence>
                  {processing && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-[4px] flex items-center justify-center">
                      <motion.div animate={{ scale: [1, 1.1, 1], rotate: 360 }} transition={{ repeat: Infinity, duration: 2 }}>
                         <RefreshCw size={48} className="text-[#ff4b4b]" />
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {activeOpId === 'hist_compute' && histogramDataBefore.length > 0 && (
            <section className="bg-[#161b22] p-8 rounded-3xl border border-[#ffffff0d] shadow-xl">
               <h3 className="text-xs font-bold text-[#ffffff4d] uppercase mb-8 tracking-widest">Intensity Distribution</h3>
               <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={histogramDataBefore}>
                      <XAxis dataKey="name" hide />
                      <XAxis dataKey="name" axisLine={{ stroke: '#ffffff1a' }} tickLine={false} label={{ value: 'Intensity (0-255)', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#ffffff33' }} />
                      <YAxis width={40} axisLine={{ stroke: '#ffffff1a' }} tickLine={false} tick={{ fontSize: 10, fill: '#ffffff33' }} label={{ value: 'Frequency', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#ffffff33' }} />
                      <Bar dataKey="value" fill="#ff4b4b" radius={[1, 1, 0, 0]} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#262730', border: 'none', borderRadius: '8px', fontSize: '10px' }} 
                        itemStyle={{ color: '#ff4b4b' }}
                        cursor={{ fill: 'rgba(255, 75, 75, 0.05)' }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
               </div>
            </section>
          )}

          {activeOpId === 'hist_stretch' && histogramDataBefore.length > 0 && (
            <section className="grid grid-cols-2 gap-8">
              <div className="bg-[#161b22] p-6 rounded-3xl border border-[#ffffff0d] shadow-xl space-y-4">
                 <h3 className="text-xs font-bold text-[#ffffff4d] uppercase tracking-widest">Before Stretching</h3>
                 <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={histogramDataBefore}>
                        <Bar dataKey="value" fill="#ffffff1a" radius={[1, 1, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
              <div className="bg-[#161b22] p-6 rounded-3xl border border-[#ffffff0d] shadow-xl space-y-4">
                 <h3 className="text-xs font-bold text-[#ff4b4b99] uppercase tracking-widest">After Stretching</h3>
                 <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={histogramDataAfter}>
                        <Bar dataKey="value" fill="#ff4b4b" radius={[1, 1, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
            </section>
          )}

          {/* Operation specific controls */}
          <section className="bg-[#161b22] p-10 rounded-3xl border border-[#ffffff0d] shadow-xl space-y-12">
            <div className="space-y-4">
               <div className="flex items-center gap-3">
                  <Sliders size={18} className="text-[#ff4b4b]" />
                  <h3 className="text-xl font-bold">Operation Parameters</h3>
               </div>
               <p className="text-sm text-[#ffffff33] leading-relaxed max-w-2xl">{activeOp?.help}</p>
            </div>

            <div className="max-w-xl">
              {activeOpId === 'restoration_sandbox' && (
                <div className="space-y-12">
                  <div className="grid grid-cols-2 gap-10">
                    <ControlItem label="Step 1: Inject Noise" help="Corrupt the signal with artificial noise to simulate real-world transmission Errors.">
                       <div className="space-y-4">
                          <select 
                            value={controls.restorationNoiseType} 
                            onChange={e => setControls({...controls, restorationNoiseType: e.target.value as any})}
                            className="w-full bg-[#0e1117] border border-[#ffffff0d] rounded-xl p-3 text-sm focus:outline-none focus:border-[#ff4b4b] transition-colors"
                          >
                             <option value="none">No Noise (Clean)</option>
                             <option value="salt_and_pepper">Salt & Pepper</option>
                             <option value="gaussian">Gaussian (Electronic)</option>
                          </select>
                          {controls.restorationNoiseType !== 'none' && (
                            <div className="flex items-center gap-6 px-2">
                              <input type="range" min="0.01" max="0.5" step="0.01" value={controls.noiseAmount} onChange={e => setControls({...controls, noiseAmount: +e.target.value})} className="w-full h-1.5 bg-[#ffffff0d] rounded-lg appearance-none cursor-pointer accent-[#ff4b4b]" />
                              <span className="w-16 text-center text-xs font-mono py-1 px-2 border border-[#ffffff0d] rounded bg-[#0e1117] text-[#ff4b4b]">{(controls.noiseAmount * 100).toFixed(0)}%</span>
                            </div>
                          )}
                       </div>
                    </ControlItem>

                    <ControlItem label="Step 2: Signal Recovery" help="The Gaussian filter (Low-pass) attempts to suppress high-frequency noise by averaging neighboring pixels.">
                       <div className="flex items-center gap-4 py-2">
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-14 h-6 rounded-full transition-colors relative ${controls.restoreFilterEnabled ? 'bg-[#ff4b4b]' : 'bg-[#ffffff0d]'}`}>
                               <input type="checkbox" checked={controls.restoreFilterEnabled} onChange={e => setControls({...controls, restoreFilterEnabled: e.target.checked})} className="hidden" />
                               <motion.div animate={{ x: controls.restoreFilterEnabled ? 14+18 : 2 }} className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm" />
                            </div>
                            <span className="text-sm font-medium text-[#ffffff66] group-hover:text-[#fafafa]">Apply Gaussian Filter</span>
                          </label>
                       </div>
                    </ControlItem>
                  </div>
                  
                  {controls.restorationNoiseType !== 'none' && (
                    <div className="p-6 bg-[#ff4b4b05] border border-[#ff4b4b1a] rounded-2xl flex items-start gap-4">
                       <div className="p-2 bg-[#ff4b4b1a] rounded-lg text-[#ff4b4b]">
                         <Info size={16} />
                       </div>
                       <div className="space-y-1">
                          <p className="text-xs font-bold text-[#fafafa]">Restoration Note</p>
                          <p className="text-[11px] text-[#ffffff66] leading-relaxed">
                            The SNR (Signal-to-Noise Ratio) above indicates how much of the original image signal remains visible after noise injection. 
                            Filters aim to increase perceived quality, though they may introduce slight blurring.
                          </p>
                       </div>
                    </div>
                  )}
                </div>
              )}

              {activeOpId === 'add_sub' && (
                <ControlItem label="Add/Sub Amount" help="Shift pixel intensity. Total range is -255 to 255.">
                  <div className="flex items-center gap-6">
                    <input type="range" min="-128" max="128" value={controls.brightness} onChange={e => setControls({...controls, brightness: +e.target.value})} className="w-full h-1.5 bg-[#ffffff0d] rounded-lg appearance-none cursor-pointer accent-[#ff4b4b]" />
                    <span className="w-16 text-center text-xs font-mono py-1 px-2 border border-[#ffffff0d] rounded bg-[#0e1117] text-[#ff4b4b]">{controls.brightness > 0 ? `+${controls.brightness}` : controls.brightness}</span>
                  </div>
                </ControlItem>
              )}

              {activeOpId === 'solarization' && (
                <ControlItem label="Inversion Threshold" help="Pixels above this value will be inverted.">
                   <div className="flex items-center gap-6">
                    <input type="range" min="0" max="255" value={controls.solarizeThreshold} onChange={e => setControls({...controls, solarizeThreshold: +e.target.value})} className="w-full h-1.5 bg-[#ffffff0d] rounded-lg appearance-none cursor-pointer accent-[#ff4b4b]" />
                    <span className="w-16 text-center text-xs font-mono py-1 px-2 border border-[#ffffff0d] rounded bg-[#0e1117] text-[#ff4b4b]">{controls.solarizeThreshold}</span>
                  </div>
                </ControlItem>
              )}



              {['dilation', 'erosion', 'opening', 'closing'].includes(activeOpId) && (
                <ControlItem label="Filter Radius" help="Size of the neighborhood mask used for the pixel window.">
                   <div className="flex items-center gap-6">
                    <input type="range" min="3" max="15" step="2" value={controls.morphKernelSize} onChange={e => setControls({...controls, morphKernelSize: +e.target.value})} className="w-full h-1.5 bg-[#ffffff0d] rounded-lg appearance-none cursor-pointer accent-[#ff4b4b]" />
                    <span className="w-16 text-center text-xs font-mono py-1 px-2 border border-[#ffffff0d] rounded bg-[#0e1117] text-[#ff4b4b]">{controls.morphKernelSize}x{controls.morphKernelSize}</span>
                  </div>
                </ControlItem>
              )}

              {activeOpId === 'threshold_global' && (
                <ControlItem label="Binary Threshold" help="Pivot point for the black/white categorization.">
                  <div className="flex items-center gap-6">
                    <input type="range" min="0" max="255" value={controls.threshold} onChange={e => setControls({...controls, threshold: +e.target.value})} className="w-full h-1.5 bg-[#ffffff0d] rounded-lg appearance-none cursor-pointer accent-[#ff4b4b]" />
                    <span className="w-16 text-center text-xs font-mono py-1 px-2 border border-[#ffffff0d] rounded bg-[#0e1117] text-[#ff4b4b]">{controls.threshold}</span>
                  </div>
                </ControlItem>
              )}



              {['hist_compute', 'hist_stretch', 'threshold_otsu', 'dithering_fs'].includes(activeOpId) && (
                <div className="flex items-center gap-3 p-6 bg-[#ff4b4b05] border border-[#ff4b4b1a] rounded-2xl text-[#ff4b4b66]">
                   <Info size={16} />
                   <p className="text-xs italic font-medium">Automatic execution: No additional parameters required for this process.</p>
                </div>
              )}
            </div>

            <div className="pt-10 border-t border-[#ffffff0a]">
              <button onClick={() => setShowCode(!showCode)} className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all ${showCode ? 'bg-[#ff4b4b0d] text-[#ff4b4b]' : 'text-[#ffffff26] hover:text-[#ffffff4d]'}`}>
                <Code size={16} /> 
                <span className="text-[10px] font-black uppercase tracking-wider">Logic Debugger</span> 
                <ChevronDown className={`transition-transform duration-300 ${showCode ? 'rotate-180' : ''}`} size={14} />
              </button>
              <AnimatePresence>
                {showCode && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-[#0e1117] mt-8 rounded-3xl border border-[#ffffff05] shadow-inner">
                    <div className="bg-[#ffffff05] flex justify-between px-6 py-2 border-b border-[#ffffff05]">
                       <span className="text-[9px] text-[#ffffff1a] font-mono uppercase tracking-widest font-bold">src/vision_module.py</span>
                    </div>
                    <pre className="p-8 text-[11px] font-mono leading-[2] text-[#ff4b4b]/70 overflow-x-auto whitespace-pre">
                      {getCodeSnippet()}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function ControlItem({ label, children, help }: { label: string, children: React.ReactNode, help?: string }) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <label className="text-[10px] font-black text-[#ffffff26] uppercase tracking-[0.2em]">{label}</label>
        {help && <p className="text-[11px] text-[#ffffff4d] leading-relaxed">{help}</p>}
      </div>
      <div className="bg-[#ffffff03] p-1 rounded-2xl">
        {children}
      </div>
    </div>
  );
}


