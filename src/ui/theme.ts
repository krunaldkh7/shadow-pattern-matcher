/**
 * UI identity: "a piece hung in a small gallery".
 *
 * The HUD is ink written straight onto the tiled wall — no panels, no glass —
 * in the same warm brown as the cast shadow, so the interface and the puzzle
 * share one material. The only object that sits *on* the wall is the museum
 * placard that is pinned up when a piece is solved.
 */
export const INK = {
  /** Same family as the cast shadow (#4a3a2c), a touch deeper for text. */
  ink: '#3b2b20',
  inkSoft: 'rgba(59,43,32,0.62)',
  inkFaint: 'rgba(59,43,32,0.28)',
  /** Placard card stock. */
  paper: '#efe4cc',
  paperEdge: '#d9c9a8',
  /** Pin head and lit bulbs. */
  brass: '#b07d2a',
  bulbLit: '#e7a93a',
};

/** Urbanist: a clean geometric sans, used at a few weights for hierarchy. */
export const FONT = {
  numeral: 'Urbanist_700Bold',
  title: 'Urbanist_600SemiBold',
  body: 'Urbanist_500Medium',
  bodyItalic: 'Urbanist_500Medium_Italic',
  label: 'Urbanist_600SemiBold',
};
