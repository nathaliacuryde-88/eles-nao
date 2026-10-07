import type { HandData } from '../App';

/**
 * The hands, from the camera: MediaPipe's hand landmarker, run on every new
 * video frame, turned into what the visuals read — where each hand is, open
 * or a fist, how many fingers, how fast it moves, and a clap when the two
 * meet. The same reading as the VJ tool's, without React.
 *
 * Nothing leaves the browser: the model runs here, on the video here.
 */

const PROXIMITY_THRESHOLD = 0.15; // hands this close together count as a clap
const VERSION = '0.10.14';

interface HandHistory {
  position: { x: number; y: number };
  timestamp: number;
}

export async function trackHands(video: HTMLVideoElement, onHandData: (data: HandData) => void) {
  const url = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
  const vision = await import(/* @vite-ignore */ url);
  const { HandLandmarker, FilesetResolver } = vision;
  const fileset = await FilesetResolver.forVisionTasks(`${url}/wasm`);
  const landmarker = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.7,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  const histories: Record<'left' | 'right', HandHistory[]> = { left: [], right: [] };
  let lastVideoTime = -1;

  const detect = () => {
    if (video.currentTime !== lastVideoTime && video.readyState >= 2) {
      lastVideoTime = video.currentTime;
      try {
        onHandData(read(landmarker.detectForVideo(video, performance.now())));
      } catch (error) {
        console.error('Hand detection error:', error);
      }
    }
    requestAnimationFrame(detect);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const read = (results: any): HandData => {
    const now = Date.now();
    const handData: HandData = { left: null, right: null };
    if (!results.landmarks?.length || !results.handedness) return handData;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    results.handedness.forEach((hand: any, index: number) => {
      const landmarks = results.landmarks[index];
      // MediaPipe sees from the camera; the picture is a mirror, so swap.
      const side: 'left' | 'right' = hand[0].categoryName.toLowerCase() === 'left' ? 'right' : 'left';
      const palm = landmarks[9];
      const position = { x: 1 - palm.x, y: palm.y };
      const history = histories[side];

      let velocity = 0;
      const prev = history[history.length - 1];
      if (prev) {
        const dist = Math.hypot(position.x - prev.position.x, position.y - prev.position.y);
        const dt = (now - prev.timestamp) / 1000;
        velocity = dt > 0 ? Math.min((dist / dt) * 2, 3) : 0;
      }
      history.push({ position, timestamp: now });
      if (history.length > 10) history.shift();

      handData[side] = {
        position,
        gesture: detectGesture(landmarks),
        velocity,
        fingerCount: countFingers(landmarks),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        landmarks: landmarks.map((lm: any) => ({ x: 1 - lm.x, y: lm.y, z: lm.z })),
      };
    });

    if (handData.left && handData.right) {
      const distance = Math.hypot(
        handData.left.position.x - handData.right.position.x,
        handData.left.position.y - handData.right.position.y,
      );
      handData.distanceBetweenHands = distance;
      if (distance < PROXIMITY_THRESHOLD) {
        handData.clapping = true;
        handData.clapIntensity = 1 - distance / PROXIMITY_THRESHOLD;
      }
    }
    return handData;
  };

  detect();
}

// Count extended fingers (0-5) - Works with both PALM and BACK of hand facing camera
function countFingers(landmarks: any[]): number {
  if (!landmarks || landmarks.length < 21) return 0;
  
  const wrist = landmarks[0];
  const palm = landmarks[9]; // Middle of palm
  
  // ═══════════════════════════════════════════════════════════════════════════
  // IMPROVED FINGER DETECTION - Works with PALM or BACK of hand
  // ═══════════════════════════════════════════════════════════════════════════
  // Strategy: Check if fingertips are "above" their base knuckles (MCP joints)
  // This works regardless of hand orientation because vertical is always vertical
  // ═══════════════════════════════════════════════════════════════════════════
  
  let extendedFingers = 0;
  
  // ───────────────────────────────────────────────────────────────────────────
  // THUMB (special case - horizontal movement)
  // ───────────────────────────────────────────────────────────────────────────
  const thumbTip = landmarks[4];
  const thumbIP = landmarks[3];
  const thumbMCP = landmarks[2];
  const thumbCMC = landmarks[1];
  
  // For thumb, check horizontal distance from base (works for both orientations)
  const thumbTipDist = Math.sqrt(
    Math.pow(thumbTip.x - thumbCMC.x, 2) + 
    Math.pow(thumbTip.y - thumbCMC.y, 2)
  );
  const thumbMCPDist = Math.sqrt(
    Math.pow(thumbMCP.x - thumbCMC.x, 2) + 
    Math.pow(thumbMCP.y - thumbCMC.y, 2)
  );
  
  // Thumb is extended if tip is farther from base than MCP joint
  if (thumbTipDist > thumbMCPDist * 1.2) {
    extendedFingers++;
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // OTHER FINGERS (Index, Middle, Ring, Pinky) - Vertical check
  // ───────────────────────────────────────────────────────────────────────────
  const fingerData = [
    { tip: 8, pip: 6, mcp: 5 },   // Index finger
    { tip: 12, pip: 10, mcp: 9 }, // Middle finger (NOTE: mcp is 9, which is palm center)
    { tip: 16, pip: 14, mcp: 13 }, // Ring finger
    { tip: 20, pip: 18, mcp: 17 }  // Pinky finger
  ];
  
  // Detect hand orientation using wrist and middle finger base
  const middleMCP = landmarks[9];
  const handVector = {
    y: middleMCP.y - wrist.y, // Positive if hand points down, negative if up
    z: middleMCP.z - wrist.z  // Z depth
  };
  
  for (const finger of fingerData) {
    const tip = landmarks[finger.tip];
    const pip = landmarks[finger.pip];
    const mcp = landmarks[finger.mcp];
    
    // ═══════════════════════════════════════════════════════════════════════
    // METHOD 1: Vertical position check (works for most cases)
    // ═══════════════════════════════════════════════════════════════════════
    // If tip is ABOVE (smaller Y) the MCP joint, finger is likely extended
    const verticalExtension = tip.y < mcp.y - 0.02; // 0.02 threshold for noise
    
    // ═══════════════════════════════════════════════════════════════════════
    // METHOD 2: Distance check (backup method)
    // ═══════════════════════════════════════════════════════════════════════
    const tipToWrist = Math.sqrt(
      Math.pow(tip.x - wrist.x, 2) + 
      Math.pow(tip.y - wrist.y, 2) + 
      Math.pow(tip.z - wrist.z, 2)
    );
    const pipToWrist = Math.sqrt(
      Math.pow(pip.x - wrist.x, 2) + 
      Math.pow(pip.y - wrist.y, 2) + 
      Math.pow(pip.z - wrist.z, 2)
    );
    const distanceExtension = tipToWrist > pipToWrist * 1.05;
    
    // ═══════════════════════════════════════════════════════════════════════
    // METHOD 3: Straightness check (tip-pip-mcp angle)
    // ═══════════════════════════════════════════════════════════════════════
    const pipToMCP = {
      x: mcp.x - pip.x,
      y: mcp.y - pip.y,
      z: mcp.z - pip.z
    };
    const pipToTip = {
      x: tip.x - pip.x,
      y: tip.y - pip.y,
      z: tip.z - pip.z
    };
    
    // Normalize vectors
    const lenPipMCP = Math.sqrt(pipToMCP.x ** 2 + pipToMCP.y ** 2 + pipToMCP.z ** 2);
    const lenPipTip = Math.sqrt(pipToTip.x ** 2 + pipToTip.y ** 2 + pipToTip.z ** 2);
    
    if (lenPipMCP > 0 && lenPipTip > 0) {
      const dotProduct = (
        (pipToMCP.x / lenPipMCP) * (pipToTip.x / lenPipTip) +
        (pipToMCP.y / lenPipMCP) * (pipToTip.y / lenPipTip) +
        (pipToMCP.z / lenPipMCP) * (pipToTip.z / lenPipTip)
      );
      
      // If dot product is negative, finger is straight (pointing opposite direction)
      const straightnessExtension = dotProduct < -0.3;
      
      // ═════════════════════════════════════════════════════════════════════
      // COMBINE ALL METHODS - Finger is extended if ANY method confirms it
      // ═════════════════════════════════════════════════════════════════════
      if (verticalExtension || distanceExtension || straightnessExtension) {
        extendedFingers++;
      }
    } else {
      // Fallback to vertical check only
      if (verticalExtension || distanceExtension) {
        extendedFingers++;
      }
    }
  }
  
  return extendedFingers;
}

function detectGesture(landmarks: any[]): 'open' | 'fist' | 'pinch' | 'none' {
  if (!landmarks || landmarks.length < 21) return 'none';
  
  const palm = landmarks[9]; // Middle of palm
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyTip = landmarks[20];
  
  // Finger PIP joints (middle joints)
  const indexPIP = landmarks[6];
  const middlePIP = landmarks[10];
  const ringPIP = landmarks[14];
  const pinkyPIP = landmarks[18];

  // Check for pinch (thumb and index close together)
  const thumbIndexDist = Math.sqrt(
    Math.pow(thumbTip.x - indexTip.x, 2) + 
    Math.pow(thumbTip.y - indexTip.y, 2) +
    Math.pow(thumbTip.z - indexTip.z, 2)
  );

  if (thumbIndexDist < 0.06) {
    return 'pinch';
  }

  // Check if fingers are extended using 3D distance from palm
  const indexTipDist = Math.sqrt(
    Math.pow(indexTip.x - palm.x, 2) + 
    Math.pow(indexTip.y - palm.y, 2) + 
    Math.pow(indexTip.z - palm.z, 2)
  );
  const indexPIPDist = Math.sqrt(
    Math.pow(indexPIP.x - palm.x, 2) + 
    Math.pow(indexPIP.y - palm.y, 2) + 
    Math.pow(indexPIP.z - palm.z, 2)
  );
  const indexExtended = indexTipDist > indexPIPDist * 1.1;
  
  const middleTipDist = Math.sqrt(
    Math.pow(middleTip.x - palm.x, 2) + 
    Math.pow(middleTip.y - palm.y, 2) + 
    Math.pow(middleTip.z - palm.z, 2)
  );
  const middlePIPDist = Math.sqrt(
    Math.pow(middlePIP.x - palm.x, 2) + 
    Math.pow(middlePIP.y - palm.y, 2) + 
    Math.pow(middlePIP.z - palm.z, 2)
  );
  const middleExtended = middleTipDist > middlePIPDist * 1.1;
  
  const ringTipDist = Math.sqrt(
    Math.pow(ringTip.x - palm.x, 2) + 
    Math.pow(ringTip.y - palm.y, 2) + 
    Math.pow(ringTip.z - palm.z, 2)
  );
  const ringPIPDist = Math.sqrt(
    Math.pow(ringPIP.x - palm.x, 2) + 
    Math.pow(ringPIP.y - palm.y, 2) + 
    Math.pow(ringPIP.z - palm.z, 2)
  );
  const ringExtended = ringTipDist > ringPIPDist * 1.1;
  
  const pinkyTipDist = Math.sqrt(
    Math.pow(pinkyTip.x - palm.x, 2) + 
    Math.pow(pinkyTip.y - palm.y, 2) + 
    Math.pow(pinkyTip.z - palm.z, 2)
  );
  const pinkyPIPDist = Math.sqrt(
    Math.pow(pinkyPIP.x - palm.x, 2) + 
    Math.pow(pinkyPIP.y - palm.y, 2) + 
    Math.pow(pinkyPIP.z - palm.z, 2)
  );
  const pinkyExtended = pinkyTipDist > pinkyPIPDist * 1.1;

  const extendedCount = [indexExtended, middleExtended, ringExtended, pinkyExtended].filter(Boolean).length;

  if (extendedCount >= 3) {
    return 'open';
  } else if (extendedCount <= 1) {
    return 'fist';
  }

  return 'none';
}

