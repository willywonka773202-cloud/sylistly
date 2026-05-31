Cached Discover preview assets live here.

Expected file format:
- WebP or PNG, 1200x1500 or larger
- Full outfit editorial preview on a person
- Premium black/cream/pink Sylistly visual direction
- No text baked into the image

Connect assets by updating data/discover-look-previews.json:

{
  "id": "night-femme",
  "previewImageUrl": "/discover-previews/night-femme.webp",
  "previewImageStatus": "ready",
  "tags": ["night out", "date", "jewelry"]
}

When previewImageStatus is not "ready", Discover falls back to a clean editorial product layout using only products with usable images.
