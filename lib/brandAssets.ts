/* The GS Group mark (from the supplied "GS Group logo icon" artwork) and its colours. The four squares stand for the
   group companies: IT blue, AV teal, Digital red and IT Security green. */

export const BRAND = {
  blue: '#0741a2',
  red: '#fc3f28',
  green: '#98cc45',
  teal: '#35b191',
  ink: '#0c0d0c',
} as const;

/** The colour of each group company's square. Falls back to the IT blue. */
export const COMPANY_COLOR: Record<string, string> = {
  GSIT: BRAND.blue,
  GSAV: BRAND.teal,
  GSD: BRAND.red,
  GSS: BRAND.green,
};
export const companyColor = (shortCode: string) => COMPANY_COLOR[shortCode.toUpperCase()] ?? BRAND.blue;

/** Outlines of the "GS" letters, in the artwork's own units (each is drawn at its offset). */
export const GS_LETTERS = [
  {
    at: '425.2815 247.6378',
    d: 'M 0 0 L -24.159 0 C -36.661 0 -46.831 10.174 -46.831 22.682 L -46.831 24.675 L -29.521 24.675 L -29.521 22.682 C -29.521 19.72 -27.117 17.31 -24.159 17.31 L 0 17.31 C 5.027 17.31 9.118 21.4 9.118 26.428 L 9.118 32.212 C 9.118 37.239 5.027 41.33 0 41.33 L -22.249 41.33 C -36.82 41.33 -48.676 53.186 -48.676 67.759 L -48.676 73.571 C -48.676 88.144 -36.82 100 -22.249 100 L 1.67 100 C 14.176 100 24.352 89.824 24.352 77.317 L 24.315 75.163 L 7.005 75.494 L 7.042 77.438 C 7.042 80.28 4.632 82.69 1.67 82.69 L -22.249 82.69 C -27.276 82.69 -31.367 78.6 -31.367 73.571 L -31.367 67.759 C -31.367 62.73 -27.276 58.64 -22.249 58.64 L 0 58.64 C 14.571 58.64 26.428 46.785 26.428 32.212 L 26.428 26.428 C 26.428 11.855 14.571 0 0 0',
  },
  {
    at: '348.7356 247.6378',
    d: 'M 0 0 L -19.971 0 C -47.541 0 -69.969 22.43 -69.969 50 C -69.969 77.57 -47.541 100 -19.971 100 L 2.4 100 L 2.4 82.739 L -19.971 82.739 C -38.024 82.739 -52.709 68.053 -52.709 50 C -52.709 31.947 -38.024 17.261 -19.971 17.261 L 0 17.261 Z',
  },
  { at: '365.9958 264.898', d: 'M 0 0 L -17.26 0 L -17.26 23.217 L -40.5 23.217 L -40.5 40.477 L 0 40.477 Z' },
] as const;

/** The four squares (blue and red on top, green and teal below), as x, y, colour in the artwork's units. */
export const GS_SQUARES = [
  { x: 479.343, y: 311.598, fill: BRAND.blue },
  { x: 535.197, y: 311.598, fill: BRAND.red },
  { x: 479.343, y: 255.757, fill: BRAND.green },
  { x: 535.197, y: 255.757, fill: BRAND.teal },
] as const;
export const GS_SQUARE_SIZE = 27.927;
/** The artwork is drawn y-up on a 595.276 high page, so it is flipped into SVG's y-down space. */
export const GS_FLIP = 'matrix(1 0 0 -1 0 595.276)';
export const GS_VIEWBOX = '278.7 247.6 284.5 100.1';

/** The whole logo as an SVG document. `ink` is the colour of the letters (white on dark backgrounds). */
export const gsLogoSvg = (ink: string = BRAND.ink) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${GS_VIEWBOX}"><g transform="${GS_FLIP}">${GS_LETTERS.map((l) => `<path transform="translate(${l.at})" d="${l.d}" fill="${ink}"/>`).join('')}${GS_SQUARES.map((q) => `<rect x="${q.x}" y="${q.y}" width="${GS_SQUARE_SIZE}" height="${GS_SQUARE_SIZE}" fill="${q.fill}"/>`).join('')}</g></svg>`;

/** The Global Surf IT logo as an image source, for letterheads and the public pages. */
export const GS_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(gsLogoSvg())}`;
