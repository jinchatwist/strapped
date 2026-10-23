// Wrist sizes people pick on the watch screen, as wrist circumference in cm.
export const WRIST_SIZES = {
  S: { label: "Small", cm: 15.5 },
  M: { label: "Medium", cm: 17 },
  L: { label: "Large", cm: 18.5 },
} as const;
export type WristSize = keyof typeof WRIST_SIZES;

export function inches(cm: number) {
  return (cm / 2.54).toFixed(1);
}

// How big the watch should look on that wrist. Seen from above, a wrist is about a third of its
// circumference wide, so a 17 cm wrist is about 56 mm across.
export function scaleNote(size: WristSize, caseMm: number, lugMm: number) {
  const { cm } = WRIST_SIZES[size];
  const widthMm = wristWidthMm(size);
  const lug = Math.max(lugMm, caseMm);
  const lugShare = Math.round((lug / widthMm) * 100);
  const caseShare = Math.round((caseMm / widthMm) * 100);
  const overhang = lug > widthMm ? ` The lugs are longer than the wrist is wide, so they reach past both edges of the wrist.` : "";
  return [
    `Scale is critical. This person's wrist is ${cm} cm around (${inches(cm)} in), about ${widthMm} mm wide seen from above.`,
    `So the ${caseMm} mm case must span about ${caseShare}% of the wrist's width, and the ${lug} mm lug-to-lug about ${lugShare}% of it.${overhang}`,
    "Measure against the wrist in the photo and draw the watch at exactly that size, not bigger or smaller.",
  ].join(" ");
}

// Where the in-app camera's hand outline puts the watch, in the outline's 390×844 drawing:
// the wrist there is about 114 units wide, and the forearm is turned 28°.
export const CAMERA_GUIDE = { x: 166, y: 566, angle: 28, wristUnits: 114, viewW: 390, viewH: 844 };

// Millimetres across the wrist seen from above (about a third of the circumference).
export function wristWidthMm(size: WristSize) {
  return Math.round(WRIST_SIZES[size].cm * 10 * 0.33);
}
