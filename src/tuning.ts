// =====================================================================================
//  All settings you are likely to change live in this file. Edit, save, and the page reloads.
//  (The table that maps each speech sound to a mouth shape, VISEME_PARAMS, stays in avatar.ts.)
//
//  Sizes written "x mouth width" are relative to the mouth in YOUR photo, so they work at any
//  photo resolution. Add #debug to the page URL to see the mesh points while you tune.
// =====================================================================================

// ---------- image files (in public/) ----------
// The first file that exists is used.
//  - avatar: your person. A PNG with a transparent background lets the background stay still while she moves.
//  - background: OPTIONAL. If present, it is drawn behind a still, and only the person sways.
export const FILES = {
  avatar: ["/avatar.png", "/avatar.jpg", "/avatar.webp"],
  background: ["/background.jpg", "/background.png", "/background.webp"],
};

// ---------- look and motion ----------
export const TUNING = {
  // ---- upper teeth ----
  teeth: {
    colorTop: "#785e3c", // gradient: top edge (in shadow)
    colorMiddle: "#756752", // brightest band
    colorBottom: "#5b482e", // bottom edge
    middleStop: 0.35, // where the bright band sits, 0 = top, 1 = bottom
    sideInset: 0.15, // gap between teeth and each mouth corner (share of mouth opening width)
    baseHeight: 0.03, // teeth height when the mouth is barely open (x mouth width)
    heightPerOpen: 0.09, // extra height as the jaw opens (x mouth width)
    maxHeightShare: 0.38, // teeth never taller than this share of the mouth opening
    cornerRadius: 0.5, // rounding of the bottom corners (share of teeth height)
    count: 5, // number of teeth across; gaps = count - 1
    gapColor: "rgba(51, 27, 9, 0.35)", // lines between teeth; use alpha 0 to remove them
    gapWidth: 0.8, // px
    gapLength: 0.9, // share of teeth height the gap lines run down
    hideOnPucker: 0.9, // 0 = teeth stay visible on "oo", 1 = fully hidden
  },

  // ---- inside of the mouth ----
  mouth: {
    cavityTop: "#2a0a0e",
    cavityBottom: "#2e0b10",
    tongueColor: "#7d2a35",
    tongueMinOpen: 0.3, // tongue appears once the jaw is open this much (0-1)
    tongueWidth: 0.35, // share of the mouth opening width
    tongueHeight: 0.32, // share of the mouth opening height
    upperLipShadow: 0.55, // darkness right under the upper lip (0-1)
    upperLipShadowDepth: 0.55, // how far down that shadow reaches (share of opening height)
    cornerShadow: 0.3, // darkness in both mouth corners (0-1)
    cornerShadowWidth: 0.2, // how far in from each corner it reaches (share of opening width)
    minOpenToShow: 0.02, // below this the interior is not drawn at all
    appearSpeed: 7, // how fast the interior fades in as the mouth opens
  },

  // ---- how far things move ----
  motion: {
    jawDrop: 0.2, // jaw travel at full "ah" (x mouth width); lower = calmer mouth
    lipSpread: 0.18, // corners spread on "ee"
    lipPucker: 0.2, // corners squeeze on "oo"
    upperLipLift: 0.06, // upper lip rises a little when the jaw opens
    cornerFollow: 0.25, // how much lip corners and lower-lip edges follow the jaw (0-1)
    smileLift: 0.05, // corners lift on "ee"
    openSeconds: 0.03, // smoothing when the mouth opens (smaller = snappier)
    closeSeconds: 0.055, // smoothing when it closes
  },

  // ---- blinking ----
  blink: {
    seconds: 0.16, // duration of one blink
    firstMin: 1.5, // first blink happens between these two times (s)
    firstMax: 4.5,
    gapMin: 6, // then one every gapMin to gapMax seconds
    gapMax: 8,
    lashColor: "rgba(35,22,22,0.75)", // the closed-eye line
    lashWidth: 1.6, // px
    skinSampleOffset: 0.22, // where eyelid colour is sampled, above the eye (x eye width)
  },

  // ---- idle head movement ----
  head: {
    amount: 0.5, // master dial when there is a separate background: 0 = head perfectly still, 1 = default, 2 = twice as much
    amountOnFlatPhoto: 0.3, // used when there is NO background file: the whole photo moves, so keep it small (0 = still)
    tilt: 0.001, // slow tilt (radians)
    tiltFast: 0.006, // quicker small tilt
    tiltWhenSpeaking: 0.0008, // extra tilt while talking
    zoom: 0.0004, // slow breathing zoom
    zoomWhenSpeaking: 0.0005, // extra zoom while talking
    driftX: 1, // sideways drift (px)
    driftY: 1, // up/down drift (px)
  },
};
