/** The interactive intro plays once per app launch (not persisted). */
let shown = false;

export const intro = {
  shouldShow: () => !shown,
  markShown: () => {
    shown = true;
  },
};
