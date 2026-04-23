import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

export const runtime = 'nodejs';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url');
  const cutout = req.nextUrl.searchParams.get('cutout') === '1';
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
    const arrayBuffer = await upstream.arrayBuffer();
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

    const transformed = await makeTransparentCutout(source);

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

async function makeTransparentCutout(source: Buffer): Promise<Buffer> {
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

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 })
    .png()
    .toBuffer();
}
