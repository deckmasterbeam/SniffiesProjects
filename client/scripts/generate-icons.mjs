import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const logoPath = join(__dirname, "sniffies_logo.png");
const iconsDir = join(root, "icons");
mkdirSync(iconsDir, { recursive: true });

const SIZES = [16, 32, 48, 128];
const DOT_COLOR = { r: 255, g: 85, b: 0, alpha: 1 };

const makeDotSvg = (dotR, canvasSize) => {
  const cx = Math.round(canvasSize * 0.1) + dotR;
  const cy = Math.round(canvasSize * 0.1) + dotR;
  return Buffer.from(
    `<svg width="${canvasSize}" height="${canvasSize}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cy}" r="${dotR}" fill="rgb(${DOT_COLOR.r},${DOT_COLOR.g},${DOT_COLOR.b})"/>
    </svg>`,
  );
};

for (const size of SIZES) {
  const dotRadius = Math.round(size * 0.11);
  const dotSvg = makeDotSvg(dotRadius, size);

  const outPath = join(iconsDir, `icon${size}.png`);
  await sharp(logoPath)
    .resize(size, size)
    .composite([{ input: dotSvg, top: 0, left: 0 }])
    .png()
    .toFile(outPath);

  console.log(`[icons] wrote ${outPath}`);
}
