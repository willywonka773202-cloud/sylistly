import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

export const runtime = 'nodejs';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const SUPPORTED_CATEGORIES = new Set(['hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry']);
const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // 12MB — generous for product photos, caps abuse

/**
 * SSRF guard: refuse to proxy internal / private / loopback / link-local hosts
 * (incl. the cloud metadata IP). The catalog only ever points this proxy at
 * public retailer CDNs, so this costs nothing for legit traffic but stops the
 * open proxy from being aimed at internal services. (Literal-IP + obvious
 * internal-hostname checks; not full DNS-rebind protection, but proportionate.)
 */
function isDisallowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local + metadata
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (host.includes(':')) {
    if (host === '::1' || host === '::') return true;
    if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80') || host.startsWith('::ffff:')) return true;
    return false;
  }
  return false;
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url');
  const cutout = req.nextUrl.searchParams.get('cutout') === '1';
  const categoryParam = req.nextUrl.searchParams.get('category');
  const category = categoryParam && SUPPORTED_CATEGORIES.has(categoryParam) ? categoryParam : null;
  if (!rawUrl) {
    return new NextResponse('Missing url', { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return new NextResponse('Invalid url', { status: 400 });
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return new NextResponse('Unsupported protocol', { status: 400 });
  }

  if (isDisallowedHost(parsed.hostname)) {
    return new NextResponse('Blocked host', { status: 400 });
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      redirect: 'follow',
      cache: 'force-cache',
    });

    if (!upstream.ok) {
      return new NextResponse(`Upstream image failed: ${upstream.status}`, { status: upstream.status });
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    // Defense-in-depth: never relay text/markup/JSON — only images/binary — so
    // the proxy can't be used to read internal HTML/JSON responses.
    if (/^(text\/|application\/(json|xml|xhtml|html|javascript|x-www-form))/i.test(contentType)) {
      return new NextResponse('Unsupported content type', { status: 415 });
    }
    const declaredLength = Number(upstream.headers.get('content-length') || 0);
    if (declaredLength && declaredLength > MAX_IMAGE_BYTES) {
      return new NextResponse('Image too large', { status: 413 });
    }
    const arrayBuffer = await upstream.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      return new NextResponse('Image too large', { status: 413 });
    }
    const source = Buffer.from(arrayBuffer);

    if (!cutout || contentType.includes('svg')) {
      return new NextResponse(new Uint8Array(source), {
        status: 200,
        headers: {
          'content-type': contentType,
          'cache-control': 'public, max-age=86400, s-maxage=86400',
        },
      });
    }

    const transformed = await makeTransparentCutout(source, category);

    return new NextResponse(new Uint8Array(transformed), {
      status: 200,
      headers: {
        'content-type': 'image/png',
        'cache-control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (error) {
    return new NextResponse(
      error instanceof Error ? error.message : 'Image proxy failed',
      { status: 502 },
    );
  }
}

async function makeTransparentCutout(source: Buffer, category: string | null): Promise<Buffer> {
  const pipeline = sharp(source, { failOn: 'none' }).rotate().ensureAlpha();
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });

  for (let index = 0; index < data.length; index += info.channels) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const alpha = data[index + 3];
    const brightness = (red + green + blue) / 3;
    const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);

    if (brightness >= 248 && chroma <= 26) {
      data[index + 3] = 0;
      continue;
    }

    if (brightness >= 232 && chroma <= 34) {
      const fade = Math.max(0, Math.min(1, (248 - brightness) / 16));
      data[index + 3] = Math.round(alpha * fade);
    }
  }

  const trimmed = sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 })
    .png();

  const trimmedBuffer = await trimmed.toBuffer();
  if (!category) {
    return trimmedBuffer;
  }

  return cropForCategory(trimmedBuffer, category);
}

async function cropForCategory(source: Buffer, category: string): Promise<Buffer> {
  const image = sharp(source, { failOn: 'none' });
  const metadata = await image.metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;

  if (!width || !height) {
    return source;
  }

  const aspectRatio = height / Math.max(1, width);
  const isLikelyModelShot = aspectRatio > 1.18;

  if (!isLikelyModelShot && (category === 'top' || category === 'outer' || category === 'bottom' || category === 'shoes')) {
    return source;
  }

  const box = categoryCropBox(category, width, height);

  return image
    .extract(box)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .png()
    .toBuffer();
}

function categoryCropBox(category: string, width: number, height: number) {
  const clamped = (value: number, max: number) => Math.max(0, Math.min(max, Math.round(value)));

  if (category === 'top') {
    const left = clamped(width * 0.06, width - 1);
    const top = clamped(height * 0.18, height - 1);
    const cropWidth = clamped(width * 0.88, width - left);
    const cropHeight = clamped(height * 0.42, height - top);
    return { left, top, width: Math.max(1, cropWidth), height: Math.max(1, cropHeight) };
  }

  if (category === 'outer') {
    const left = clamped(width * 0.04, width - 1);
    const top = clamped(height * 0.12, height - 1);
    const cropWidth = clamped(width * 0.92, width - left);
    const cropHeight = clamped(height * 0.54, height - top);
    return { left, top, width: Math.max(1, cropWidth), height: Math.max(1, cropHeight) };
  }

  if (category === 'bottom') {
    const left = clamped(width * 0.12, width - 1);
    const top = clamped(height * 0.34, height - 1);
    const cropWidth = clamped(width * 0.76, width - left);
    const cropHeight = clamped(height * 0.40, height - top);
    return { left, top, width: Math.max(1, cropWidth), height: Math.max(1, cropHeight) };
  }

  if (category === 'shoes') {
    const left = clamped(width * 0.08, width - 1);
    const top = clamped(height * 0.76, height - 1);
    const cropWidth = clamped(width * 0.84, width - left);
    const cropHeight = clamped(height * 0.18, height - top);
    return { left, top, width: Math.max(1, cropWidth), height: Math.max(1, cropHeight) };
  }

  if (category === 'hat' || category === 'eyewear') {
    const left = clamped(width * 0.12, width - 1);
    const top = clamped(height * 0.04, height - 1);
    const cropWidth = clamped(width * 0.76, width - left);
    const cropHeight = clamped(height * 0.28, height - top);
    return { left, top, width: Math.max(1, cropWidth), height: Math.max(1, cropHeight) };
  }

  if (category === 'bag') {
    const left = clamped(width * 0.14, width - 1);
    const top = clamped(height * 0.24, height - 1);
    const cropWidth = clamped(width * 0.72, width - left);
    const cropHeight = clamped(height * 0.4, height - top);
    return { left, top, width: Math.max(1, cropWidth), height: Math.max(1, cropHeight) };
  }

  if (category === 'jewelry') {
    const side = Math.min(width, height);
    const cropSize = clamped(side * 0.48, side);
    const left = clamped((width - cropSize) / 2, width - cropSize);
    const top = clamped(height * 0.18, height - cropSize);
    return { left, top, width: Math.max(1, cropSize), height: Math.max(1, cropSize) };
  }

  return { left: 0, top: 0, width, height };
}
