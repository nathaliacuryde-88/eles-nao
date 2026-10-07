/** What the renderers are played with: the hands, and the music (unused here). */

export interface AudioData {
  /** Kick and sub, 20–160Hz. Scale, weight, push. */
  bass: number;
  /** Bassline and the body of a voice, 160–800Hz. */
  lowMid: number;
  /** Where melody lives, 800Hz–4kHz. Speed and movement. */
  mid: number;
  /** Hats, air, consonants, 4–12kHz. Density and detail. */
  high: number;
  /** Everything, 20Hz–12kHz. */
  overall: number;
  /** An onset landed this frame. */
  beat: boolean;
  /** How hard, 0-1. Zero on frames with no beat. */
  beatIntensity: number;
  /**
   * The pulse without the on/off edge: jumps on an onset and falls away over
   * about a third of a second. Anything that would stutter on a boolean —
   * a scale, a brightness, a speed — should ride this instead.
   */
  onset: number;
}

/** One tracked hand, as produced by {@link HandTracker} from MediaPipe landmarks. */
export interface Hand {
  position: { x: number; y: number };
  gesture: 'open' | 'fist' | 'pinch' | 'none';
  pinchDistance?: number;
  /** Speed of hand movement (0-1+). */
  velocity?: number;
  /** How long the current gesture has been held, in seconds. */
  holdDuration?: number;
  /** Number of extended fingers (1-5) - controls speed multiplier. */
  fingerCount?: number;
  /** MediaPipe hand landmarks (21 points). */
  landmarks?: Array<{ x: number; y: number; z: number }>;
}

export interface HandData {
  left: Hand | null;
  right: Hand | null;
  distanceBetweenHands?: number;
  /** True when hands rapidly come together - triggers vibration + explosion. */
  clapping?: boolean;
  /** 0-1, how strong the clap was. */
  clapIntensity?: number;
  /** Last N positions. */
  gestureTrail?: { x: number; y: number; hand: 'left' | 'right' }[];
  /** Made up — the automatic drive, or the music standing in — not her real hands. */
  synthetic?: boolean;
}
