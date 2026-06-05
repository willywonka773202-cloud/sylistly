'use client';

import {
  BringToFront,
  Copy,
  ExternalLink,
  ImageDown,
  LayoutGrid,
  LoaderCircle,
  Minus,
  Move,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  SendToBack,
  Share2,
  ShoppingBag,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent, type ReactNode } from 'react';
import { ProductImage } from '@/components/ProductImage';
import { isExactProductUrl } from '@/lib/checkout';
import { getProductOutboundUrl } from '@/lib/product-links';
import { getStylistCatalogProducts, isCleanStylistCatalogProduct } from '@/lib/client-catalog';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';

type CanvasElement = {
  id: string;
  product: Product;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  z: number;
};

type DragState = {
  id: string;
  pointerId: number;
  mode: 'move' | 'resize' | 'rotate';
  startX: number;
  startY: number;
  startAngle: number;
  originX: number;
  originY: number;
  originW: number;
  originH: number;
  originRotation: number;
  centerX: number;
  centerY: number;
};

type CatalogPointerDrag = {
  product: Product;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  hasMoved: boolean;
};

type LayoutPreset = 'editorial' | 'flatlay' | 'story';
type CanvasFormat = 'story' | 'post' | 'square';
type EditorPanel = 'catalog' | 'tools' | 'layout';
type CatalogCategory = Category | 'all';

const EDITORIAL_LAYOUTS: Record<Category, Omit<CanvasElement, 'id' | 'product'>> = {
  hat: { x: 41, y: 3, w: 22, h: 13, rotation: -4, z: 72 },
  eyewear: { x: 66, y: 12, w: 23, h: 10, rotation: 6, z: 74 },
  outer: { x: 10, y: 18, w: 39, h: 39, rotation: -4, z: 42 },
  top: { x: 34, y: 21, w: 34, h: 28, rotation: 1, z: 55 },
  bottom: { x: 30, y: 45, w: 39, h: 34, rotation: -1, z: 36 },
  bag: { x: 66, y: 49, w: 29, h: 26, rotation: 7, z: 66 },
  jewelry: { x: 11, y: 61, w: 19, h: 13, rotation: -10, z: 78 },
  shoes: { x: 27, y: 77, w: 49, h: 18, rotation: 2, z: 82 },
};

const FLATLAY_LAYOUTS: Record<Category, Omit<CanvasElement, 'id' | 'product'>> = {
  hat: { x: 9, y: 8, w: 25, h: 14, rotation: -7, z: 42 },
  eyewear: { x: 62, y: 9, w: 27, h: 12, rotation: 5, z: 48 },
  outer: { x: 9, y: 25, w: 36, h: 36, rotation: -5, z: 32 },
  top: { x: 38, y: 20, w: 32, h: 29, rotation: 2, z: 38 },
  bottom: { x: 24, y: 47, w: 38, h: 34, rotation: -1, z: 28 },
  bag: { x: 65, y: 44, w: 28, h: 25, rotation: 7, z: 44 },
  jewelry: { x: 8, y: 66, w: 21, h: 13, rotation: -12, z: 50 },
  shoes: { x: 33, y: 78, w: 46, h: 17, rotation: 2, z: 56 },
};

const STORY_LAYOUTS: Record<Category, Omit<CanvasElement, 'id' | 'product'>> = {
  hat: { x: 36, y: 7, w: 28, h: 16, rotation: -4, z: 72 },
  eyewear: { x: 60, y: 17, w: 25, h: 11, rotation: 6, z: 74 },
  outer: { x: 16, y: 23, w: 38, h: 41, rotation: -3, z: 40 },
  top: { x: 35, y: 24, w: 35, h: 31, rotation: 1, z: 56 },
  bottom: { x: 31, y: 48, w: 39, h: 36, rotation: -1, z: 36 },
  bag: { x: 63, y: 51, w: 31, h: 27, rotation: 6, z: 68 },
  jewelry: { x: 12, y: 68, w: 20, h: 13, rotation: -9, z: 78 },
  shoes: { x: 25, y: 81, w: 50, h: 17, rotation: 2, z: 82 },
};

const LAYOUTS: Record<LayoutPreset, Record<Category, Omit<CanvasElement, 'id' | 'product'>>> = {
  editorial: EDITORIAL_LAYOUTS,
  flatlay: FLATLAY_LAYOUTS,
  story: STORY_LAYOUTS,
};

const LAYOUT_LABELS: Record<LayoutPreset, string> = {
  editorial: 'Editorial',
  flatlay: 'Flat lay',
  story: 'Story',
};

const FORMAT_PRESETS: Record<CanvasFormat, { label: string; ratio: string; caption: string; className: string }> = {
  story: {
    label: 'Story',
    ratio: '9:13',
    caption: '9:13 OOTD',
    className: 'aspect-[9/13]',
  },
  post: {
    label: 'Post',
    ratio: '4:5',
    caption: '4:5 feed',
    className: 'aspect-[4/5]',
  },
  square: {
    label: 'Grid',
    ratio: '1:1',
    caption: '1:1 grid',
    className: 'aspect-square',
  },
};

const FALLBACK_LAYOUTS: Array<Omit<CanvasElement, 'id' | 'product'>> = [
  { x: 18, y: 13, w: 42, h: 34, rotation: -5, z: 10 },
  { x: 48, y: 14, w: 37, h: 31, rotation: 4, z: 20 },
  { x: 18, y: 45, w: 36, h: 30, rotation: 3, z: 30 },
  { x: 52, y: 48, w: 34, h: 28, rotation: -4, z: 40 },
  { x: 24, y: 73, w: 44, h: 18, rotation: 2, z: 50 },
];

const CATEGORY_COPY: Record<Category, string> = {
  hat: 'Frame the top',
  outer: 'Build silhouette',
  top: 'Anchor torso',
  bottom: 'Ground the look',
  shoes: 'Finish low',
  bag: 'Add weight',
  eyewear: 'Add attitude',
  jewelry: 'Add shine',
};

const CATEGORY_LABELS: Record<Category, string> = {
  hat: 'Hats',
  outer: 'Outer',
  top: 'Tops',
  bottom: 'Bottoms',
  shoes: 'Shoes',
  bag: 'Bags',
  eyewear: 'Eyewear',
  jewelry: 'Jewelry',
};

const CATALOG_CATEGORY_OPTIONS: CatalogCategory[] = ['all', ...CATEGORY_ORDER];

const CATALOG_LABELS: Record<CatalogCategory, string> = {
  all: 'All',
  ...CATEGORY_LABELS,
};

const CATALOG_STARTERS: Record<CatalogCategory, string> = {
  all: '',
  hat: 'baseball cap',
  outer: 'jacket',
  top: 'shirt',
  bottom: 'pants',
  shoes: 'sneakers',
  bag: 'bag',
  eyewear: 'sunglasses',
  jewelry: 'ring',
};

const CATALOG_QUICK_SEARCHES: Array<{ label: string; query: string; category: CatalogCategory }> = [
  { label: 'Shoes', query: 'shoes', category: 'shoes' },
  { label: 'Bags', query: 'bag', category: 'bag' },
  { label: 'Jackets', query: 'jacket', category: 'outer' },
  { label: 'Tops', query: 'shirt', category: 'top' },
  { label: 'Pants', query: 'pants', category: 'bottom' },
  { label: 'Sunglasses', query: 'sunglasses', category: 'eyewear' },
  { label: 'Jewelry', query: 'ring', category: 'jewelry' },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function snapToEditorialGrid(value: number, target = 50, threshold = 1.8): number {
  return Math.abs(value - target) <= threshold ? target : value;
}

function normalizeRotation(rotation: number): number {
  return ((rotation + 180 + 3600) % 360) - 180;
}

function createElements(products: Product[], preset: LayoutPreset = 'editorial'): CanvasElement[] {
  const categoryLayouts = LAYOUTS[preset];
  return products.slice(0, 8).map((product, index) => {
    const layout = categoryLayouts[product.category] ?? FALLBACK_LAYOUTS[index % FALLBACK_LAYOUTS.length];
    return {
      ...layout,
      id: `${product.id}-${index}`,
      product,
      x: clamp(layout.x + (index > 4 ? (index - 4) * 2 : 0), 0, 90),
      y: clamp(layout.y + (index > 4 ? (index - 4) * 1.5 : 0), 0, 90),
      z: layout.z + index,
    };
  });
}

function productKey(products: Product[]): string {
  return products.map((product) => product.id).join('|');
}

function formatProductPrice(priceCents?: number): string {
  if (!priceCents) return 'Price pending';
  return `$${(priceCents / 100).toLocaleString()}`;
}

function urlHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'merchant link';
  }
}

function catalogText(product: Product): string {
  return [
    product.brand,
    product.name,
    product.retailer,
    product.category,
    product.sourceQuery,
    ...(product.vibes || []),
    ...(product.occasions || []),
    ...(product.searchTerms || []),
  ].join(' ').toLowerCase();
}

function normalizeCatalogQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function catalogQueryTokens(query: string): string[] {
  return normalizeCatalogQuery(query)
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function catalogMatchesQuery(product: Product, query: string): boolean {
  const normalizedQuery = normalizeCatalogQuery(query);
  if (!normalizedQuery) return true;
  const text = catalogText(product);
  if (text.includes(normalizedQuery)) return true;
  const tokens = catalogQueryTokens(query);
  if (!tokens.length) return true;
  return tokens.every((token) => text.includes(token));
}

function catalogQueryScore(product: Product, query = ''): number {
  const normalizedQuery = normalizeCatalogQuery(query);
  if (!normalizedQuery) return 0;
  const text = catalogText(product);
  const name = product.name.toLowerCase();
  const brand = product.brand.toLowerCase();
  let score = 0;

  if (name.includes(normalizedQuery)) score += 16;
  if (brand.includes(normalizedQuery)) score += 12;
  if (text.includes(normalizedQuery)) score += 8;
  for (const token of catalogQueryTokens(query)) {
    if (name.includes(token)) score += 4;
    if (brand.includes(token)) score += 3;
    if (text.includes(token)) score += 1;
  }

  return score;
}

function hasExactCatalogLink(product: Product): boolean {
  return isExactProductUrl(getProductOutboundUrl(product));
}

function isEditorCatalogProduct(product: Product): boolean {
  return Boolean(isCleanStylistCatalogProduct(product) && hasExactCatalogLink(product));
}

function sortEditorCatalogProducts(products: Product[], query = ''): Product[] {
  return products
    .slice()
    .sort((left, right) =>
      catalogQueryScore(right, query) - catalogQueryScore(left, query)
      || Number(hasExactCatalogLink(right)) - Number(hasExactCatalogLink(left))
      || (right.popularityScore || 0) - (left.popularityScore || 0),
    );
}

function catalogSeedProducts(category: CatalogCategory, query = '', exactOnly = false): Product[] {
  return sortEditorCatalogProducts(getStylistCatalogProducts()
    .filter((product) => category === 'all' || product.category === category)
    .filter((product) => catalogMatchesQuery(product, query))
    .filter((product) => !exactOnly || isEditorCatalogProduct(product)), query)
    .slice(0, 18);
}

function catalogAvailability() {
  const products = getStylistCatalogProducts()
    .filter(isCleanStylistCatalogProduct)
    .filter((product) => Boolean(getProductOutboundUrl(product)));
  const availability = Object.fromEntries(
    CATALOG_CATEGORY_OPTIONS.map((category) => {
      const categoryProducts = category === 'all'
        ? products
        : products.filter((product) => product.category === category);
      return [
        category,
        {
          total: categoryProducts.length,
          exact: categoryProducts.filter(hasExactCatalogLink).length,
        },
      ];
    }),
  ) as Record<CatalogCategory, { total: number; exact: number }>;

  return availability;
}

export function OutfitCanvasEditor({
  products,
  title,
  signal,
}: {
  products: Product[];
  title: string;
  signal: string;
}) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [elements, setElements] = useState<CanvasElement[]>(() => createElements(products));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [shadow, setShadow] = useState(true);
  const [glow, setGlow] = useState(false);
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>('editorial');
  const layoutPresetRef = useRef<LayoutPreset>('editorial');
  const [format, setFormat] = useState<CanvasFormat>('story');
  const [storyReady, setStoryReady] = useState(false);
  const [caption, setCaption] = useState('today feels intentional');
  const [panel, setPanel] = useState<EditorPanel>('catalog');
  const [catalogCategory, setCatalogCategory] = useState<CatalogCategory>('all');
  const [catalogQuery, setCatalogQuery] = useState(CATALOG_STARTERS.all);
  const [catalogResults, setCatalogResults] = useState<Product[]>(() => catalogSeedProducts('all'));
  const [catalogExactOnly] = useState(true);
  const [catalogNotice, setCatalogNotice] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [dragProduct, setDragProduct] = useState<Product | null>(null);
  const [catalogPointerDrag, setCatalogPointerDrag] = useState<CatalogPointerDrag | null>(null);
  const catalogPointerDragRef = useRef<CatalogPointerDrag | null>(null);

  const key = useMemo(() => productKey(products), [products]);
  const availability = useMemo(catalogAvailability, []);

  useEffect(() => {
    layoutPresetRef.current = layoutPreset;
  }, [layoutPreset]);

  useEffect(() => {
    const next = createElements(products, layoutPresetRef.current);
    setElements(next);
    setActiveId(null);
    // Only source outfit changes should reset the canvas. Layout changes use
    // applyLayoutPreset so dragged-in catalog products are preserved.
  }, [key, products]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function loadCatalog() {
      const query = catalogQuery.trim() || CATALOG_STARTERS[catalogCategory];
      const fallbackProducts = catalogSeedProducts(catalogCategory, query, catalogExactOnly);
      if (!query && catalogCategory === 'all') {
        setCatalogResults(fallbackProducts);
        setCatalogError(null);
        setCatalogLoading(false);
        return;
      }
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            query,
            category: catalogCategory === 'all' ? undefined : catalogCategory,
            frame: 'androgynous',
            transparentOnly: true,
            exactOnly: true,
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          if (!cancelled) {
            setCatalogResults(fallbackProducts);
            setCatalogError('No reviewed cutouts found yet.');
          }
          return;
        }
        const data = (await response.json()) as { products?: Product[] };
        const nextProducts = sortEditorCatalogProducts((data.products || [])
          .filter((product) => (catalogExactOnly ? isEditorCatalogProduct(product) : isCleanStylistCatalogProduct(product)))
          .filter((product) => Boolean(getProductOutboundUrl(product))), query)
          .slice(0, 18);
        if (!cancelled) {
          setCatalogResults(nextProducts.length ? nextProducts : fallbackProducts);
          setCatalogError(nextProducts.length || fallbackProducts.length ? null : 'No exact product-page cutouts found yet.');
        }
      } catch (error) {
        if (!cancelled && !(error instanceof DOMException && error.name === 'AbortError')) {
          setCatalogResults(fallbackProducts);
          setCatalogError('Exact product-page search is unavailable right now.');
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }

    void loadCatalog();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [catalogCategory, catalogExactOnly, catalogQuery]);

  const active = elements.find((element) => element.id === activeId) ?? null;
  const activeProductUrl = active ? getProductOutboundUrl(active.product) : '';
  const activeProductHost = activeProductUrl ? urlHost(activeProductUrl) : '';
  const activeLinkKindKey = activeProductUrl && isExactProductUrl(activeProductUrl) ? 'exact' : 'blocked';
  const activeLinkKind = activeLinkKindKey === 'exact' ? 'Exact product page' : 'Blocked non-exact link';
  const catalogExactCount = catalogResults.filter(hasExactCatalogLink).length;
  const catalogLinkedCount = catalogResults.filter((product) => Boolean(getProductOutboundUrl(product))).length;
  const canvasExactCount = elements.filter((element) => hasExactCatalogLink(element.product)).length;
  const canvasLinkedCount = elements.filter((element) => Boolean(getProductOutboundUrl(element.product))).length;

  function updateActive(mutator: (element: CanvasElement) => CanvasElement) {
    if (!activeId) return;
    setElements((current) => current.map((element) => (element.id === activeId ? mutator(element) : element)));
  }

  function autoArrange() {
    const next = createElements(elements.map((element) => element.product), layoutPreset);
    setElements(next);
    setActiveId(null);
  }

  function applyLayoutPreset(nextPreset: LayoutPreset) {
    layoutPresetRef.current = nextPreset;
    setLayoutPreset(nextPreset);
    setElements((current) => createElements(current.map((element) => element.product), nextPreset));
    setActiveId(null);
  }

  const addCatalogProduct = useCallback((product: Product, point?: { x: number; y: number }) => {
    if (!isEditorCatalogProduct(product)) {
      setCatalogNotice('Only reviewed transparent pieces with exact product pages can enter the editor.');
      window.setTimeout(() => setCatalogNotice(null), 1800);
      return;
    }
    const id = `${product.id}-catalog-${Date.now()}`;
    setElements((current) => {
      const layout = LAYOUTS[layoutPresetRef.current][product.category] ?? FALLBACK_LAYOUTS[current.length % FALLBACK_LAYOUTS.length];
      const maxZ = Math.max(...current.map((element) => element.z), 1);
      const element: CanvasElement = {
        ...layout,
        product,
        id,
        x: point ? clamp(point.x - layout.w / 2, -4, 92) : clamp(layout.x + (current.length % 3) * 2, -4, 92),
        y: point ? clamp(point.y - layout.h / 2, -4, 92) : clamp(layout.y + (current.length % 4) * 1.4, -4, 92),
        z: maxZ + 1,
      };
      return [...current, element];
    });
    setActiveId(id);
    setPanel('tools');
    setCatalogNotice('Added exact linked cutout to the frame.');
    window.setTimeout(() => setCatalogNotice(null), 1200);
  }, []);

  const addCatalogProductAtViewportPoint = useCallback((product: Product, clientX: number, clientY: number): boolean => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    const isInsideCanvas = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    if (!isInsideCanvas) return false;
    addCatalogProduct(product, {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    });
    return true;
  }, [addCatalogProduct]);

  const activeCatalogPointerId = catalogPointerDrag?.pointerId;

  useEffect(() => {
    if (!activeCatalogPointerId) return;
    const pointerId = activeCatalogPointerId;

    function onWindowPointerMove(event: globalThis.PointerEvent) {
      if (event.pointerId !== pointerId) return;
      event.preventDefault();
      setCatalogPointerDrag((current) => {
        if (!current || current.pointerId !== event.pointerId) return current;
        const moved = Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 6;
        const next = {
          ...current,
          x: event.clientX,
          y: event.clientY,
          hasMoved: current.hasMoved || moved,
        };
        catalogPointerDragRef.current = next;
        return next;
      });
    }

    function onWindowPointerUp(event: globalThis.PointerEvent) {
      if (event.pointerId !== pointerId) return;
      const current = catalogPointerDragRef.current;
      catalogPointerDragRef.current = null;
      if (current?.hasMoved) {
        addCatalogProductAtViewportPoint(current.product, event.clientX, event.clientY);
      }
      setCatalogPointerDrag(null);
    }

    function onWindowPointerCancel(event: globalThis.PointerEvent) {
      if (event.pointerId !== pointerId) return;
      catalogPointerDragRef.current = null;
      setCatalogPointerDrag(null);
    }

    window.addEventListener('pointermove', onWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerCancel);

    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerCancel);
    };
  }, [activeCatalogPointerId, addCatalogProductAtViewportPoint]);

  function startCatalogPointerDrag(event: PointerEvent<HTMLButtonElement>, product: Product) {
    event.preventDefault();
    event.stopPropagation();
    setPanel('catalog');
    setActiveId(null);
    const nextDrag = {
      product,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      hasMoved: false,
    };
    catalogPointerDragRef.current = nextDrag;
    setCatalogPointerDrag(nextDrag);
  }

  function selectCatalogCategory(category: CatalogCategory) {
    setCatalogCategory(category);
    setCatalogQuery(CATALOG_STARTERS[category]);
    setCatalogResults(catalogSeedProducts(category, CATALOG_STARTERS[category], catalogExactOnly));
  }

  function applyQuickSearch(query: string, category: CatalogCategory) {
    setCatalogCategory(category);
    setCatalogQuery(query);
    setCatalogResults(catalogSeedProducts(category, query, catalogExactOnly));
  }

  function applyFormat(nextFormat: CanvasFormat) {
    setFormat(nextFormat);
    if (nextFormat === 'story') applyLayoutPreset('story');
    if (nextFormat === 'square') applyLayoutPreset('flatlay');
  }

  function duplicateActive() {
    if (!active) return;
    const maxZ = Math.max(...elements.map((element) => element.z), 1);
    const duplicate = {
      ...active,
      id: `${active.id}-copy-${Date.now()}`,
      x: clamp(active.x + 4, 0, 92),
      y: clamp(active.y + 4, 0, 92),
      rotation: active.rotation + 3,
      z: maxZ + 1,
    };
    setElements((current) => [...current, duplicate]);
    setActiveId(duplicate.id);
  }

  function layerActive(direction: 'front' | 'back') {
    if (!activeId) return;
    setElements((current) => {
      const zValues = current.map((element) => element.z);
      const maxZ = Math.max(...zValues, 1);
      const minZ = Math.min(...zValues, 1);
      return current.map((element) =>
        element.id === activeId ? { ...element, z: direction === 'front' ? maxZ + 1 : minZ - 1 } : element,
      );
    });
  }

  function alignActiveCenter() {
    updateActive((element) => ({
      ...element,
      x: clamp(50 - element.w / 2, -4, 92),
    }));
  }

  function removeActive() {
    if (!activeId || elements.length <= 3) return;
    setElements((current) => current.filter((element) => element.id !== activeId));
    setActiveId(null);
  }

  function onElementPointerDown(event: PointerEvent<HTMLButtonElement>, element: CanvasElement) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setActiveId(element.id);
    setDrag({
      id: element.id,
      pointerId: event.pointerId,
      mode: 'move',
      startX: event.clientX,
      startY: event.clientY,
      startAngle: 0,
      originX: element.x,
      originY: element.y,
      originW: element.w,
      originH: element.h,
      originRotation: element.rotation,
      centerX: 0,
      centerY: 0,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onResizePointerDown(event: PointerEvent<HTMLSpanElement>, element: CanvasElement) {
    event.preventDefault();
    event.stopPropagation();
    setActiveId(element.id);
    setDrag({
      id: element.id,
      pointerId: event.pointerId,
      mode: 'resize',
      startX: event.clientX,
      startY: event.clientY,
      startAngle: 0,
      originX: element.x,
      originY: element.y,
      originW: element.w,
      originH: element.h,
      originRotation: element.rotation,
      centerX: 0,
      centerY: 0,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onRotatePointerDown(event: PointerEvent<HTMLSpanElement>, element: CanvasElement) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + ((element.x + element.w / 2) / 100) * rect.width;
    const centerY = rect.top + ((element.y + element.h / 2) / 100) * rect.height;
    const startAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI);
    setActiveId(element.id);
    setDrag({
      id: element.id,
      pointerId: event.pointerId,
      mode: 'rotate',
      startX: event.clientX,
      startY: event.clientY,
      startAngle,
      originX: element.x,
      originY: element.y,
      originW: element.w,
      originH: element.h,
      originRotation: element.rotation,
      centerX,
      centerY,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = ((event.clientX - drag.startX) / rect.width) * 100;
    const dy = ((event.clientY - drag.startY) / rect.height) * 100;
    setElements((current) =>
      current.map((element) => {
        if (element.id !== drag.id) return element;
        if (drag.mode === 'rotate') {
          const angle = Math.atan2(event.clientY - drag.centerY, event.clientX - drag.centerX) * (180 / Math.PI);
          return {
            ...element,
            rotation: normalizeRotation(drag.originRotation + angle - drag.startAngle),
          };
        }
        if (drag.mode === 'resize') {
          const delta = Math.max(dx, dy);
          return {
            ...element,
            w: clamp(drag.originW + delta, 10, 96),
            h: clamp(drag.originH + delta, 8, 96),
          };
        }
        const nextX = clamp(drag.originX + dx, -4, 92);
        const nextY = clamp(drag.originY + dy, -4, 92);
        const snappedCenterX = snapToEditorialGrid(nextX + element.w / 2);
        const snappedCenterY = snapToEditorialGrid(nextY + element.h / 2);
        return {
          ...element,
          x: clamp(snappedCenterX - element.w / 2, -4, 92),
          y: clamp(snappedCenterY - element.h / 2, -4, 92),
        };
      }),
    );
  }

  function endDrag() {
    setDrag(null);
  }

  function onCanvasDragOver(event: DragEvent<HTMLDivElement>) {
    if (!dragProduct) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  function onCanvasDrop(event: DragEvent<HTMLDivElement>) {
    if (!dragProduct || !canvasRef.current) return;
    event.preventDefault();
    addCatalogProductAtViewportPoint(dragProduct, event.clientX, event.clientY);
    setDragProduct(null);
  }

  function stageStory() {
    setStoryReady(true);
    window.setTimeout(() => setStoryReady(false), 1600);
  }

  const exportPreset = FORMAT_PRESETS[format];
  const canvasIsClear = true;

  return (
    <section className="relative" data-editor-transparent-output-lock="true">
      <div
        ref={canvasRef}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDragOver={onCanvasDragOver}
        onDrop={onCanvasDrop}
        data-outfit-canvas
        data-canvas-link-quality={`${canvasExactCount}/${canvasLinkedCount}`}
        data-canvas-piece-count={elements.length}
        data-canvas-exact-count={canvasExactCount}
        data-canvas-linked-count={canvasLinkedCount}
        data-canvas-background="clear"
        data-canvas-transparent-lock="true"
        className={`relative mx-auto w-full max-w-[390px] touch-none overflow-hidden rounded-[34px] border border-white/12 shadow-[0_32px_90px_rgba(0,0,0,.16)] ${
          canvasIsClear ? 'bg-transparent' : 'bg-[#f9f7f3]'
        } ${exportPreset.className}`}
      >
        {canvasIsClear ? null : (
          <div className="absolute inset-0 opacity-[.045] [background-image:linear-gradient(90deg,#000_1px,transparent_1px),linear-gradient(#000_1px,transparent_1px)] [background-size:28px_28px]" />
        )}
        {drag ? (
          <>
            <div className={`pointer-events-none absolute left-1/2 top-0 z-[88] h-full w-px -translate-x-1/2 ${canvasIsClear ? 'bg-white/16' : 'bg-black/10'}`} />
            <div className={`pointer-events-none absolute left-0 top-1/2 z-[88] h-px w-full -translate-y-1/2 ${canvasIsClear ? 'bg-white/16' : 'bg-black/10'}`} />
          </>
        ) : null}
        <div className="absolute left-5 top-5 z-[90]">
          <div className={`text-[8px] font-black uppercase tracking-[.22em] ${canvasIsClear ? 'text-white/45' : 'text-black/38'}`}>Collage editor</div>
          <div className={`mt-1 max-w-[18ch] font-serif text-[25px] font-semibold leading-[.9] ${canvasIsClear ? 'text-white' : 'text-black'}`}>{title}</div>
        </div>
        <div className={`absolute right-5 top-5 z-[90] rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[.14em] shadow-[0_12px_32px_rgba(0,0,0,.08)] backdrop-blur-xl ${
          canvasIsClear ? 'border-white/12 bg-black/45 text-white/62' : 'border-black/8 bg-white/70 text-black/52'
        }`}>
          {exportPreset.ratio} · {signal} · {canvasExactCount}/{canvasLinkedCount} exact
        </div>

        {catalogPointerDrag ? (
          <div className="pointer-events-none absolute inset-4 z-[125] grid place-items-center rounded-[28px] border border-dashed border-accent/60 bg-accent/8 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)] backdrop-blur-[2px]">
            <div className="rounded-full border border-accent/35 bg-black/55 px-4 py-2 text-[9px] font-black uppercase tracking-[.16em] text-white">
              Drop to place exact cutout
            </div>
          </div>
        ) : null}

        {elements.map((element) => (
          (() => {
            const elementUrl = getProductOutboundUrl(element.product);
            const elementExact = isExactProductUrl(elementUrl);
            return (
          <button
            key={element.id}
            type="button"
            onPointerDown={(event) => onElementPointerDown(event, element)}
            onClick={() => setActiveId(element.id)}
            className={`absolute cursor-grab touch-none overflow-visible rounded-[24px] transition active:cursor-grabbing ${
              activeId === element.id ? `outline outline-1 outline-offset-4 ${canvasIsClear ? 'outline-white/30' : 'outline-black/20'}` : 'outline-none'
            }`}
            style={{
              left: `${element.x}%`,
              top: `${element.y}%`,
              width: `${element.w}%`,
              height: `${element.h}%`,
              transform: `rotate(${element.rotation}deg)`,
              zIndex: element.z,
            }}
            aria-label={`Move ${element.product.brand} ${element.product.name}`}
            data-canvas-piece={element.product.id}
            data-canvas-piece-category={element.product.category}
            data-canvas-piece-link-kind={elementExact ? 'exact' : 'blocked'}
            data-canvas-piece-link-host={urlHost(elementUrl)}
            >
              <ProductImage
                product={element.product}
                transparentOnly
                displayMode="moodboard"
              wrapperClassName="h-full w-full overflow-visible bg-transparent"
              className={`h-full w-full object-contain p-0 ${
                shadow ? 'drop-shadow-[0_32px_28px_rgba(0,0,0,.24)]' : ''
                  } ${glow ? 'drop-shadow-[0_0_24px_rgba(246,48,107,.38)]' : ''}`}
              />
              {activeId === element.id ? (
                <>
                  <span
                    onPointerDown={(event) => onRotatePointerDown(event, element)}
                    className="absolute -right-2 -top-2 grid h-7 w-7 cursor-grab place-items-center rounded-full border border-black/10 bg-white text-black shadow-[0_10px_26px_rgba(0,0,0,.18)]"
                    aria-hidden="true"
                  >
                    <RotateCw size={13} />
                  </span>
                  <span
                    onPointerDown={(event) => onResizePointerDown(event, element)}
                    className="absolute -bottom-2 -right-2 grid h-7 w-7 cursor-nwse-resize place-items-center rounded-full border border-black/10 bg-white text-black shadow-[0_10px_26px_rgba(0,0,0,.18)]"
                    aria-hidden="true"
                  >
                    <Plus size={13} />
                  </span>
                </>
              ) : null}
            </button>
            );
          })()
        ))}

        <div className={`absolute bottom-5 left-5 z-[95] max-w-[66%] rounded-[24px] border px-4 py-3 shadow-[0_18px_42px_rgba(0,0,0,.12)] backdrop-blur-xl ${
          canvasIsClear ? 'border-white/12 bg-black/45 text-white' : 'border-black/8 bg-white/72 text-black'
        }`}>
          <input
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            aria-label="Canvas caption"
            suppressHydrationWarning
            className={`w-full bg-transparent font-serif text-[21px] font-semibold leading-tight outline-none ${canvasIsClear ? 'placeholder:text-white/30' : 'placeholder:text-black/24'}`}
            placeholder="add a caption"
          />
          <div className={`mt-1 text-[9px] font-black uppercase tracking-[.18em] ${canvasIsClear ? 'text-white/45' : 'text-black/38'}`}>
            {exportPreset.caption}. Make it editorial.
          </div>
        </div>
        {storyReady ? (
          <div className="pointer-events-none absolute inset-x-5 top-20 z-[120] rounded-[24px] border border-black/8 bg-white/82 px-4 py-3 text-black shadow-[0_18px_48px_rgba(0,0,0,.18)] backdrop-blur-xl">
            <div className="text-[8px] font-black uppercase tracking-[.2em] text-accent">Export staged</div>
            <div className="mt-1 font-serif text-[22px] font-semibold leading-none">{exportPreset.label} composition ready</div>
          </div>
        ) : null}
      </div>

      {catalogPointerDrag ? (
        <div
          className="pointer-events-none fixed z-[200] h-[104px] w-[104px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-accent/45 bg-black/42 p-3 shadow-[0_24px_60px_rgba(246,48,107,.32)] backdrop-blur-xl"
          style={{ left: catalogPointerDrag.x, top: catalogPointerDrag.y }}
          data-catalog-drag-ghost
        >
          <ProductImage
            product={catalogPointerDrag.product}
            transparentOnly
            displayMode="thumbnail"
            wrapperClassName="h-full w-full overflow-visible bg-transparent"
            className="h-full w-full object-contain p-0 drop-shadow-[0_24px_22px_rgba(0,0,0,.48)]"
          />
        </div>
      ) : null}

      <div className="mt-4 rounded-[28px] border border-white/10 bg-white/[0.055] p-3 shadow-[0_18px_46px_rgba(0,0,0,.22)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[8px] font-black uppercase tracking-[.2em] text-accent">Selected piece</div>
            <div className="mt-1 truncate font-serif text-[20px] font-semibold text-ink">
              {active ? `${active.product.brand} ${active.product.name}` : 'Choose an item'}
            </div>
            <div className="mt-1 text-[11px] font-semibold text-muted-2">
              {active ? CATEGORY_COPY[active.product.category] : 'Tap or drag any piece'}
            </div>
            {active ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-white/10 bg-black/18 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.13em] text-white/62">
                  {active.product.retailer}
                </span>
                <span className="rounded-full border border-white/10 bg-black/18 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.13em] text-white/62">
                  {formatProductPrice(active.product.priceCents)}
                </span>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.13em] text-emerald-100">
                  {activeLinkKind}
                </span>
                <span
                  className="rounded-full border border-white/10 bg-black/18 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.13em] text-white/52"
                  data-selected-piece-link-host={activeProductHost}
                >
                  {activeProductHost}
                </span>
              </div>
            ) : null}
          </div>
          <div className="flex flex-none flex-col gap-2">
            <button
              type="button"
              onClick={autoArrange}
              className="sy-press inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-[10px] font-black uppercase tracking-[.12em] text-white shadow-pink-glow"
            >
              <Sparkles size={13} />
              Auto
            </button>
            {active ? (
              <a
                href={activeProductUrl}
                target="_blank"
                rel="noreferrer"
                className="sy-press inline-flex items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.055] px-4 py-2.5 text-[10px] font-black uppercase tracking-[.12em] text-white/78 transition active:scale-[0.98] hover:border-accent/55 hover:text-white"
                aria-label={`Shop ${active.product.brand} ${active.product.name}`}
                data-shop-selected-piece
                data-shop-selected-link-kind={activeLinkKindKey}
                data-shop-selected-link-host={activeProductHost}
              >
                <ShoppingBag size={13} className="text-accent" />
                Shop
                <ExternalLink size={11} className="text-white/48" />
              </a>
            ) : null}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-full border border-white/10 bg-black/18 p-1">
          <PanelButton active={panel === 'catalog'} label="Real pieces" onClick={() => setPanel('catalog')} />
          <PanelButton active={panel === 'tools'} label="Move" onClick={() => setPanel('tools')} />
          <PanelButton active={panel === 'layout'} label="Layout" onClick={() => setPanel('layout')} />
        </div>

        {panel === 'catalog' ? (
          <div
            className="mt-3 rounded-[22px] border border-white/10 bg-black/16 p-3"
            data-editor-catalog
            data-editor-catalog-scope={catalogCategory}
            data-editor-catalog-link-quality={`${catalogExactCount}/${catalogResults.length}`}
            data-editor-catalog-linked-count={catalogLinkedCount}
            data-editor-catalog-total-cutouts={availability.all.total}
            data-editor-catalog-total-exact={availability.all.exact}
            data-editor-catalog-query={catalogQuery}
            data-editor-catalog-exact-only={catalogExactOnly ? 'true' : 'false'}
            data-editor-catalog-result-count={catalogResults.length}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[8px] font-black uppercase tracking-[.2em] text-accent">Real pieces drawer</div>
                <div className="mt-1 text-[12px] font-semibold leading-relaxed text-white/72">
                  Search shoes, tops, bags, or any category. Tap Add or drag a cutout into the frame.
                </div>
              </div>
              <span className="flex-none rounded-full border border-emerald-300/35 bg-emerald-300/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.12em] text-emerald-100">
                No AI merch
              </span>
            </div>

            {catalogNotice ? (
              <div className="mb-2 rounded-[16px] border border-accent/35 bg-accent/10 px-3 py-2 text-[10px] font-semibold text-white/74" data-editor-catalog-notice>
                {catalogNotice}
              </div>
            ) : null}

            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-3 py-2">
              <Search size={14} className="flex-none text-accent" />
              <input
                value={catalogQuery}
                onChange={(event) => setCatalogQuery(event.target.value)}
                aria-label="Search real cutout products"
                suppressHydrationWarning
                className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-white outline-none placeholder:text-white/32"
                placeholder="Search shoes, bags, jackets..."
              />
              {catalogLoading ? <LoaderCircle size={14} className="animate-spin text-white/48" /> : null}
            </div>

            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {CATALOG_CATEGORY_OPTIONS.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => selectCatalogCategory(category)}
                  data-editor-catalog-category={category}
                  data-editor-catalog-category-count={availability[category].total}
                  data-editor-catalog-category-exact-count={availability[category].exact}
                  className={`sy-press flex-none rounded-full border px-3 py-2 text-[9px] font-black uppercase tracking-[.12em] transition active:scale-[0.98] ${
                    catalogCategory === category
                      ? 'border-accent/70 bg-accent/18 text-white shadow-[0_10px_26px_rgba(246,48,107,.2)]'
                      : 'border-white/10 bg-white/[0.04] text-white/56 hover:border-accent/40 hover:text-white'
                  }`}
                >
                  {CATALOG_LABELS[category]}
                  <span className="ml-1 text-white/34">{availability[category].total}</span>
                </button>
              ))}
            </div>

            <div className="mt-1 flex gap-2 overflow-x-auto pb-1 scrollbar-hide" data-editor-quick-searches>
              {CATALOG_QUICK_SEARCHES.map((quickSearch) => (
                <button
                  key={quickSearch.label}
                  type="button"
                  onClick={() => applyQuickSearch(quickSearch.query, quickSearch.category)}
                  className="sy-press flex-none rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[8px] font-black uppercase tracking-[.12em] text-white/48 transition active:scale-[0.98] hover:border-accent/45 hover:text-white"
                  data-catalog-quick-search={quickSearch.query}
                  data-catalog-quick-category={quickSearch.category}
                >
                  {quickSearch.label}
                </button>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] px-3 py-2">
              <div className="min-w-0">
                <div className="text-[8px] font-black uppercase tracking-[.16em] text-accent">Link quality</div>
                <div className="mt-0.5 truncate text-[10px] font-semibold text-white/48">
                  {catalogExactCount} exact product pages
                </div>
                <div className="mt-0.5 text-[8px] font-black uppercase tracking-[.13em] text-emerald-100/70">
                  Transparent cutouts · real merchant pages only
                </div>
              </div>
              <button
                type="button"
                disabled
                aria-pressed="true"
                data-editor-exact-link-toggle="locked"
                className="flex-none rounded-full border border-emerald-300/45 bg-emerald-400/12 px-3 py-1.5 text-[8px] font-black uppercase tracking-[.12em] text-emerald-100"
              >
                Exact locked
              </button>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {catalogLoading && catalogResults.length === 0 ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`catalog-loading-${index}`}
                    className="h-[154px] w-[112px] flex-none animate-pulse rounded-[20px] border border-white/10 bg-white/[0.055]"
                  />
                ))
              ) : catalogResults.length ? (
                catalogResults.map((product) => {
                  const url = getProductOutboundUrl(product);
                  const exact = isExactProductUrl(url);
                  return (
                    <article
                      key={`catalog-${product.id}`}
                      draggable
                      onDragStart={(event) => {
                        setDragProduct(product);
                        event.dataTransfer.effectAllowed = 'copy';
                      }}
                      onDragEnd={() => setDragProduct(null)}
                  className="w-[118px] flex-none rounded-[20px] border border-white/10 bg-white/[0.035] p-2 shadow-[0_12px_28px_rgba(0,0,0,.18)]"
                      data-catalog-result
                      data-catalog-product-id={product.id}
                      data-catalog-category={product.category}
                      data-catalog-link-kind={exact ? 'exact' : 'blocked'}
                      data-catalog-link-host={urlHost(url)}
                      data-catalog-query-score={catalogQueryScore(product, catalogQuery)}
                    >
                      <button
                        type="button"
                        onClick={() => addCatalogProduct(product)}
                        className="block h-[78px] w-full rounded-[16px] bg-transparent"
                        aria-label={`Add ${product.brand} ${product.name}`}
                      >
                        <ProductImage
                          product={product}
                          transparentOnly
                          displayMode="thumbnail"
                          wrapperClassName="h-full w-full overflow-visible bg-transparent"
                          className="h-full w-full object-contain p-0 drop-shadow-[0_20px_18px_rgba(0,0,0,.4)]"
                        />
                      </button>
                      <div className="mt-2 truncate text-[8px] font-black uppercase tracking-[.14em] text-accent">{product.brand}</div>
                      <div className="mt-0.5 line-clamp-2 min-h-[28px] text-[10px] font-semibold leading-tight text-white/82">{product.name}</div>
                      <div className="mt-1 text-[9px] font-bold text-white/62">{formatProductPrice(product.priceCents)}</div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[6px] font-black uppercase tracking-[.1em] text-white/56">
                          Cutout
                        </span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[6px] font-black uppercase tracking-[.1em] ${
                          exact ? 'bg-emerald-400/10 text-emerald-100' : 'bg-amber-400/10 text-amber-100'
                        }`}>
                          {exact ? 'Exact' : 'Blocked'}
                        </span>
                        <span className="min-w-0 truncate text-[8px] font-semibold text-white/36">{urlHost(url)}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-[1fr_auto] gap-1.5">
                        <button
                          type="button"
                          onClick={() => addCatalogProduct(product)}
                          className="sy-press rounded-full bg-accent px-2 py-1.5 text-[8px] font-black uppercase tracking-[.1em] text-white shadow-pink-glow active:scale-95"
                        >
                          Add
                        </button>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="sy-press grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/[0.055] text-white/72 hover:text-white"
                          aria-label={`Shop ${product.brand} ${product.name}`}
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>
                      <button
                        type="button"
                        onPointerDown={(event) => startCatalogPointerDrag(event, product)}
                        className="sy-press mt-1.5 inline-flex w-full touch-none items-center justify-center gap-1.5 rounded-full border border-accent/28 bg-accent/10 px-2 py-1.5 text-[8px] font-black uppercase tracking-[.11em] text-white/72 transition active:scale-95 hover:border-accent/55 hover:text-white"
                        aria-label={`Drag ${product.brand} ${product.name} into canvas`}
                        data-catalog-touch-drag={product.id}
                      >
                        <Move size={10} className="text-accent" />
                        Drag into frame
                      </button>
                    </article>
                  );
                })
              ) : (
                <div className="grid h-[154px] min-w-full place-items-center rounded-[20px] border border-white/10 bg-white/[0.04] px-6 text-center text-[12px] leading-relaxed text-muted-2">
                  {catalogError || 'Search for a real product with a reviewed cutout.'}
                </div>
              )}
            </div>

            <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-white/42">
              <ShoppingBag size={12} className="text-accent" />
              {catalogCategory === 'all' ? 'All linked cutouts are searchable here.' : `Showing linked ${CATALOG_LABELS[catalogCategory].toLowerCase()} cutouts.`}
            </div>
          </div>
        ) : null}

        {panel === 'tools' ? (
          <>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {elements
            .slice()
            .sort((left, right) => right.z - left.z)
            .map((element) => (
              <button
                key={`tray-${element.id}`}
                type="button"
                onClick={() => setActiveId(element.id)}
                className={`h-[58px] w-[52px] flex-none rounded-[16px] border bg-black/24 p-1 shadow-[0_10px_24px_rgba(0,0,0,.18)] transition active:scale-95 ${
                  activeId === element.id ? 'border-accent ring-2 ring-accent/35' : 'border-white/12'
                }`}
                aria-label={`Select ${element.product.brand} ${element.product.name}`}
              >
                <ProductImage
                  product={element.product}
                  transparentOnly
                  displayMode="thumbnail"
                  wrapperClassName="h-full w-full overflow-visible bg-transparent"
                  className="h-full w-full object-contain p-1"
                />
              </button>
            ))}
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          <EditorButton label="Rotate left" onClick={() => updateActive((element) => ({ ...element, rotation: element.rotation - 8 }))}>
            <RotateCcw size={16} />
          </EditorButton>
          <EditorButton label="Rotate right" onClick={() => updateActive((element) => ({ ...element, rotation: element.rotation + 8 }))}>
            <RotateCw size={16} />
          </EditorButton>
          <EditorButton label="Smaller" onClick={() => updateActive((element) => ({ ...element, w: clamp(element.w - 4, 10, 90), h: clamp(element.h - 4, 8, 90) }))}>
            <Minus size={16} />
          </EditorButton>
          <EditorButton label="Larger" onClick={() => updateActive((element) => ({ ...element, w: clamp(element.w + 4, 10, 96), h: clamp(element.h + 4, 8, 96) }))}>
            <Plus size={16} />
          </EditorButton>
          <EditorButton label="Bring front" onClick={() => layerActive('front')}>
            <BringToFront size={16} />
          </EditorButton>
          <EditorButton label="Send back" onClick={() => layerActive('back')}>
            <SendToBack size={16} />
          </EditorButton>
          <EditorButton label="Duplicate" onClick={duplicateActive}>
            <Copy size={16} />
          </EditorButton>
          <EditorButton label="Move" onClick={() => setActiveId(active?.id ?? null)}>
            <Move size={16} />
          </EditorButton>
          <EditorButton label="Center align" onClick={alignActiveCenter}>
            <LayoutGrid size={16} />
          </EditorButton>
          <EditorButton label="Remove piece" onClick={removeActive}>
            <Trash2 size={16} />
          </EditorButton>
        </div>
          </>
        ) : null}

        {panel === 'layout' ? (
          <>
        <div className="mt-3 grid grid-cols-3 gap-2">
            {(Object.keys(LAYOUT_LABELS) as LayoutPreset[]).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => applyLayoutPreset(preset)}
              className={`sy-press rounded-full border px-2 py-2.5 text-[9px] font-black uppercase tracking-[.1em] transition active:scale-[0.98] ${
                layoutPreset === preset
                  ? 'border-accent/55 bg-accent/16 text-white'
                  : 'border-white/10 bg-white/[0.04] text-white/52 hover:text-white'
              }`}
            >
              {LAYOUT_LABELS[preset]}
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-[20px] border border-white/10 bg-black/16 p-3">
          <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[.18em] text-muted">
            <LayoutGrid size={12} />
            Export format
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(Object.keys(FORMAT_PRESETS) as CanvasFormat[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyFormat(preset)}
                className={`sy-press rounded-[16px] border px-2 py-2.5 text-left transition active:scale-[0.98] ${
                  format === preset
                    ? 'border-accent/65 bg-accent/14 text-white'
                    : 'border-white/10 bg-white/[0.04] text-white/58 hover:text-white'
                }`}
              >
                <span className="block text-[9px] font-black uppercase tracking-[.13em]">{FORMAT_PRESETS[preset].label}</span>
                <span className="mt-0.5 block text-[8px] font-semibold uppercase tracking-[.12em] text-white/42">{FORMAT_PRESETS[preset].ratio}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <ToggleButton active={shadow} label="Soft shadows" onClick={() => setShadow((value) => !value)} />
          <ToggleButton active={glow} label="Glow layer" onClick={() => setGlow((value) => !value)} />
        </div>

        <div
          className="mt-3 rounded-[20px] border border-emerald-300/20 bg-emerald-400/10 p-3"
          data-editor-transparent-output-lock="true"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[8px] font-black uppercase tracking-[.18em] text-emerald-100">Transparent output</div>
              <p className="mt-1 text-[11px] leading-relaxed text-white/54">
                Backgrounds are locked off. Every piece in the frame uses a reviewed real-product cutout.
              </p>
            </div>
            <span className="flex-none rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.12em] text-emerald-100">
              Locked
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <button
            type="button"
            onClick={stageStory}
            className="sy-press inline-flex items-center justify-center gap-2 rounded-full border border-accent/45 bg-accent/12 px-4 py-3 text-[10px] font-black uppercase tracking-[.13em] text-white transition active:scale-[0.98] hover:border-accent/70"
          >
            <Share2 size={13} className="text-accent" />
            {storyReady ? `${exportPreset.label} ready` : `Stage ${exportPreset.label}`}
          </button>
          <button
            type="button"
            onClick={stageStory}
            aria-label="Prepare export"
            className="sy-press grid h-11 w-11 place-items-center rounded-full bg-white text-black shadow-[0_16px_34px_rgba(0,0,0,.22)] transition active:scale-95"
          >
            <ImageDown size={17} />
          </button>
        </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function PanelButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`sy-press rounded-full px-3 py-2.5 text-[9px] font-black uppercase tracking-[.12em] transition active:scale-[0.98] ${
        active ? 'bg-accent text-white shadow-pink-glow' : 'text-white/52 hover:bg-white/[0.055] hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

function EditorButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="sy-press grid h-11 place-items-center rounded-[16px] border border-white/10 bg-white/[0.055] text-white/80 transition active:scale-95 hover:border-accent/45 hover:text-white"
    >
      {children}
    </button>
  );
}

function ToggleButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`sy-press rounded-full border px-3 py-2.5 text-[10px] font-black uppercase tracking-[.12em] transition active:scale-[0.98] ${
        active
          ? 'border-accent/50 bg-accent/16 text-white'
          : 'border-white/10 bg-white/[0.04] text-white/52 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}
