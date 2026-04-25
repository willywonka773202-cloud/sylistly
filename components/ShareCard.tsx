'use client';
import { useState, useRef } from 'react';
import { useReactToHtml2Canvas } from '@/lib/canvas';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Share2, Download, Instagram, Download, 
  ChevronRight, Sparkles, Palette, Layers 
} from 'lucide-react';
import type { Product, Category } from '@/lib/types';
import { useFit } from '@/store/fit';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface ShareTemplate {
  id: string;
  name: string;
  bg: string;
  accent: string;
}

const TEMPLATES: ShareTemplate[] = [
  { id: 'midnight', name: 'Midnight', bg: '#0f0f0e', accent: '#e8365d' },
  { id: 'cream', name: 'Cream', bg: '#f5f5dc', accent: '#1a1a1a' },
  { id: 'gradient', name: 'Glow', bg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', accent: '#e94560' },
  { id: 'editorial', name: 'Editorial', bg: '#ffffff', accent: '#000000' },
];

export function ShareCard({ open, onClose }: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState<ShareTemplate>(TEMPLATES[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const { items, totalCents, count } = useFit();

  const itemsList = Object.entries(items).filter(([, p]) => p) as [Category, Product][];
  const total = totalCents();

  async function downloadImage() {
    if (!canvasRef.current) return;
    
    setIsGenerating(true);
    try {
      const html2canvas = await useReactToHtml2Canvas();
      const canvas = await html2canvas(canvasRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
      });
      
      const link = document.createElement('a');
      link.download = `sylistly-fit-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to generate image:', error);
    } finally {
      setIsGenerating(false);
    }
  }

  async function shareToClipboard() {
    try {
      if (!canvasRef.current) return;
      
      const html2canvas = await useReactToHtml2Canvas();
      const canvas = await html2canvas(canvasRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
      });
      
      canvas.toBlob(async (blob) => {
        if (blob) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            alert('Image copied to clipboard!');
          } catch {
            alert('Copy failed. Try downloading instead.');
          }
        }
      });
    } catch (error) {
      console.error('Failed to share:', error);
    }
  }

  if (!open) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="absolute inset-x-0 bottom-0 z-50 max-h-[90%] rounded-t-3xl border-t border-hairline-2 bg-bg flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted">Share Your Fit</div>
            <h2 className="font-serif text-xl font-semibold mt-0.5">Create Card</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center">
            <X size={16} className="text-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <AnimatePresence mode="wait">
            {showTemplates ? (
              <motion.div
                key="templates"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2">
                  <Palette size={16} className="text-muted" />
                  <span className="text-xs uppercase tracking-widest text-muted">Choose Template</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => {
                        setSelectedTemplate(template);
                        setShowTemplates(false);
                      }}
                      className={`relative aspect-[4/5] rounded-xl overflow-hidden border-2 transition ${
                        selectedTemplate.id === template.id 
                          ? 'border-accent' 
                          : 'border-transparent hover:border-hairline'
                      }`}
                      style={{ background: template.bg }}
                    >
                      <div className="absolute inset-2 flex items-center justify-center">
                        <div 
                          className="w-8 h-8 rounded-full" 
                          style={{ backgroundColor: template.accent }} 
                        />
                      </div>
                      <div className="absolute bottom-2 left-2 right-2 text-center">
                        <span 
                          className="text-[10px] font-medium uppercase"
                          style={{ color: template.accent }}
                        >
                          {template.name}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="preview"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-accent" />
                    <span className="text-xs uppercase tracking-widest text-muted">Preview</span>
                  </div>
                  <button
                    onClick={() => setShowTemplates(true)}
                    className="flex items-center gap-1 text-xs text-accent"
                  >
                    {selectedTemplate.name} <ChevronRight size={12} />
                  </button>
                </div>

                <div 
                  ref={canvasRef}
                  className="aspect-[4/5] max-w-[280px] mx-auto rounded-2xl overflow-hidden relative"
                  style={{ background: selectedTemplate.bg }}
                >
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                    <span 
                      className="text-xs font-serif font-semibold"
                      style={{ color: selectedTemplate.accent }}
                    >
                      SYLISTLY
                    </span>
                    <span className="text-[10px] text-white/60">
                      {count()} items
                    </span>
                  </div>

                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="grid grid-cols-4 gap-1 p-4">
                      {itemsList.slice(0, 8).map(([, product]) => (
                        <div 
                          key={product.id}
                          className="aspect-square rounded-lg bg-white/10 overflow-hidden"
                        >
                          {product.imageUrl && (
                            <img
                              src={product.imageUrl}
                              alt=""
                              className="w-full h-full object-contain p-1"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="text-center">
                      <div className="font-serif text-2xl font-semibold text-white">
                        ${(total / 100).toFixed(0)}
                      </div>
                      <div className="text-[10px] text-white/60 mt-1">
                        {itemsList.map(([, p]) => p.brand).slice(0, 3).join(' · ')}
                      </div>
                    </div>
                  </div>

                  <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-white/30" />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={downloadImage}
                    disabled={isGenerating}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-white font-semibold text-sm"
                  >
                    {isGenerating ? (
                      <span className="animate-pulse">Generating...</span>
                    ) : (
                      <>
                        <Download size={16} />
                        Download
                      </>
                    )}
                  </button>
                  <button
                    onClick={shareToClipboard}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-hairline text-muted font-medium text-sm"
                  >
                    <Share2 size={16} />
                  </button>
                </div>

                <button
                  onClick={() => setShowTemplates(true)}
                  className="w-full py-2 rounded-xl border border-hairline text-xs text-muted"
                >
                  Change template
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}