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
const BADGE_COLOR = { r: 255, g: 85, b: 0 };

// Eye badge: orange circle with a white almond-shaped eye + dark pupil.
// Uses quadratic beziers for the pointed-ends eye (vesica) shape.
const makeEyeSvg = (badgeR, canvasSize) => {
  const cx = Math.round(canvasSize * 0.1) + badgeR;
  const cy = Math.round(canvasSize * 0.1) + badgeR;

  const eyeRx = Math.round(badgeR * 0.82);
  const eyeRy = Math.max(1, Math.round(badgeR * 0.48));
  const pupilR = Math.max(1, Math.round(badgeR * 0.28));

  // Lens / almond shape via two quadratic bezier arcs
  const eyePath = [
    `M ${cx - eyeRx} ${cy}`,
    `Q ${cx} ${cy - eyeRy} ${cx + eyeRx} ${cy}`,
    `Q ${cx} ${cy + eyeRy} ${cx - eyeRx} ${cy}`,
    "Z",
  ].join(" ");

  return Buffer.from(
    `<svg width="${canvasSize}" height="${canvasSize}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cy}" r="${badgeR}"
              fill="rgb(${BADGE_COLOR.r},${BADGE_COLOR.g},${BADGE_COLOR.b})"/>
      <path d="${eyePath}" fill="white"/>
      <circle cx="${cx}" cy="${cy}" r="${pupilR}" fill="#111"/>
    </svg>`,
  );
};

for (const size of SIZES) {
  const badgeR = Math.round(size * 0.16);
  const eyeSvg = makeEyeSvg(badgeR, size);

  const outPath = join(iconsDir, `icon${size}.png`);
  await sharp(logoPath)
    .resize(size, size)
    .composite([{ input: eyeSvg, top: 0, left: 0 }])
    .png()
    .toFile(outPath);

  console.log(`[icons] wrote ${outPath}`);
}
