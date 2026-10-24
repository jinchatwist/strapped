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

// Where the in-app camera guide puts the watch, in a 390×844 drawing: the wrist is 172 units wide
// (44% of the screen: enough pixels for a sharp watch, with the hand and more arm in the picture so
// people can see how it suits them), near the middle of the screen, with the forearm turned 30°.
export const CAMERA_GUIDE = { x: 185, y: 460, angle: 30, wristUnits: 172, viewW: 390, viewH: 844 };

// Millimetres across the wrist seen from above (about a third of the circumference).
export function wristWidthMm(size: WristSize) {
  return Math.round(WRIST_SIZES[size].cm * 10 * 0.33);
}
