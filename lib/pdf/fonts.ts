import path from 'path'
import { Font } from '@react-pdf/renderer'

// Heebo is bundled in /public/fonts and shared by every PDF in the app.
const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts')

export function registerHeebo() {
  Font.register({
    family: 'Heebo',
    fonts: [
      { src: path.join(FONTS_DIR, 'Heebo-Regular.ttf'), fontWeight: 'normal' },
      { src: path.join(FONTS_DIR, 'Heebo-Bold.ttf'), fontWeight: 'bold' },
    ],
  })
}

// Give the next render a fresh fontkit instance (empty glyph cache).
// fontkit caches glyph objects by id and the first creator decides their
// `codePoints`; state left over from earlier renders in a warm server instance
// can leave a glyph without code points, which makes react-pdf's BiDi
// reordering throw "Cannot read properties of undefined (reading 'id')".
// Call right before every renderToBuffer.
export function resetPdfFonts() {
  const family = Font.getRegisteredFonts()['Heebo'] as unknown as { sources?: unknown[] } | undefined
  if (family && Array.isArray(family.sources)) family.sources = []
  registerHeebo()
}
