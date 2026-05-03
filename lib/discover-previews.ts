import previewData from '@/data/discover-look-previews.json';
import { hasUsableImageUrl } from './product-image-quality';

export type DiscoverPreviewStatus = 'ready' | 'pending' | 'missing';

export interface DiscoverLookPreview {
  id: string;
  previewImageUrl?: string;
  previewImageStatus: DiscoverPreviewStatus;
  tags?: string[];
  prompt?: string;
  notes?: string;
}

const PREVIEW_MAP = new Map(
  (previewData as DiscoverLookPreview[]).map((preview) => [preview.id, preview]),
);

export function getDiscoverLookPreview(id: string): DiscoverLookPreview {
  const preview = PREVIEW_MAP.get(id);
  if (!preview) return { id, previewImageStatus: 'missing', tags: [] };

  return {
    ...preview,
    previewImageUrl: hasUsableImageUrl(preview.previewImageUrl) ? preview.previewImageUrl : undefined,
  };
}
