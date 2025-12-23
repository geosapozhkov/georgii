// Living Color Field Background System
// Creates a continuously changing background that reflects the passage of the year

(function() {
  'use strict';

  // Color definitions
  const NEAR_BLACK = { r: 7, g: 7, b: 7 };    // #070707
  const BASELINE_GRAY = { r: 99, g: 99, b: 99 }; // #636363
  const NEAR_WHITE = { r: 250, g: 250, b: 250 }; // #FAFAFA

  // Animation parameters
  const TRANSITION_DURATION = 60000; // 60 seconds per transition
  const BASELINE_RETURN_PROBABILITY = 0.4; // 40% chance to return to baseline on each transition
  
  let currentColor = { r: 99, g: 99, b: 99 }; // Start with baseline
  let startColor = { r: 99, g: 99, b: 99 }; // Starting color for current transition
  let targetColor = { r: 99, g: 99, b: 99 };
  let animationStartTime = Date.now();

  // Get day of year (0-364)
  function getDayOfYear() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const oneDay = 1000 * 60 * 60 * 24;
    let dayOfYear = Math.floor(diff / oneDay) - 1; // 0-364
    
    // TEST MODE: Shift time forward by 5 months (150 days)
    // Remove this offset when testing is complete
    // const TEST_OFFSET = 150; // 5 months
    // dayOfYear = (dayOfYear + TEST_OFFSET) % 365;
    
    return dayOfYear;
  }

  // Determine which period of the year (0-3)
  function getPeriod(dayOfYear) {
    return Math.floor(dayOfYear / 91.25); // 365/4 ≈ 91.25
  }

  // Get probability weights for each period
  // Returns weights for [near-black probability, baseline probability, near-white probability]
  function getPeriodWeights(period) {
    switch(period) {
      case 0: // Days 0-91 (Early year) - favors near-black
        return [0.3, 0.5, 0.2];
      case 1: // Days 92-182 (Mid-early) - favors baseline
        return [0.2, 0.6, 0.2];
      case 2: // Days 183-273 (Mid-late) - favors near-white
        return [0.2, 0.5, 0.3];
      case 3: // Days 274-364 (Late year) - favors baseline
        return [0.2, 0.6, 0.2];
      default:
        return [0.2, 0.6, 0.2]; // Default to baseline-heavy
    }
  }

  // Weighted random selection (can use custom random function)
  function weightedRandom(weights, randomFn = Math.random) {
    const total = weights.reduce((sum, w) => sum + w, 0);
    let random = randomFn() * total;
    
    for (let i = 0; i < weights.length; i++) {
      random -= weights[i];
      if (random <= 0) return i;
    }
    return weights.length - 1;
  }

  // Seeded random number generator for deterministic "randomness" based on time
  function seededRandom(seed) {
    let value = seed;
    return function() {
      value = (value * 9301 + 49297) % 233280;
      return value / 233280;
    };
  }

  // Select target color based on period probabilities (deterministic based on time)
  function selectTargetColor(transitionIndex) {
    const dayOfYear = getDayOfYear();
    const period = getPeriod(dayOfYear);
    const weights = getPeriodWeights(period);

    // Create seeded random based on day and transition index for deterministic behavior
    const seed = dayOfYear * 1000 + transitionIndex;
    const random = seededRandom(seed);

    // Check if we should return to baseline
    if (random() < BASELINE_RETURN_PROBABILITY) {
      const grayVar = (random() - 0.5) * 30;
      return {
        r: Math.max(70, Math.min(130, BASELINE_GRAY.r + grayVar)),
        g: Math.max(70, Math.min(130, BASELINE_GRAY.g + grayVar)),
        b: Math.max(70, Math.min(130, BASELINE_GRAY.b + grayVar))
      };
    }

    // Otherwise, use weighted selection
    const selection = weightedRandom(weights, random);
    
    switch(selection) {
      case 0: // Near-black
        const darkVariation = (random() - 0.5) * 15;
        return {
          r: Math.max(5, Math.min(20, NEAR_BLACK.r + darkVariation)),
          g: Math.max(5, Math.min(20, NEAR_BLACK.g + darkVariation)),
          b: Math.max(5, Math.min(20, NEAR_BLACK.b + darkVariation))
        };
      case 2: // Near-white
        const lightVariation = (random() - 0.5) * 20;
        return {
          r: Math.max(240, Math.min(255, NEAR_WHITE.r + lightVariation)),
          g: Math.max(240, Math.min(255, NEAR_WHITE.g + lightVariation)),
          b: Math.max(240, Math.min(255, NEAR_WHITE.b + lightVariation))
        };
      default: // Baseline gray (case 1)
        const grayVariation = (random() - 0.5) * 30;
        return {
          r: Math.max(70, Math.min(130, BASELINE_GRAY.r + grayVariation)),
          g: Math.max(70, Math.min(130, BASELINE_GRAY.g + grayVariation)),
          b: Math.max(70, Math.min(130, BASELINE_GRAY.b + grayVariation))
        };
    }
  }

  // Easing function for smooth transitions (ease-in-out)
  function easeInOutCubic(t) {
    return t < 0.5 
      ? 4 * t * t * t 
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // Interpolate between two colors
  function interpolateColor(color1, color2, t) {
    const eased = easeInOutCubic(t);
    return {
      r: Math.round(color1.r + (color2.r - color1.r) * eased),
      g: Math.round(color1.g + (color2.g - color1.g) * eased),
      b: Math.round(color1.b + (color2.b - color1.b) * eased)
    };
  }

  // Convert RGB object to hex string
  function rgbToHex(rgb) {
    const componentToHex = (c) => {
      const hex = Math.round(c).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return '#' + componentToHex(rgb.r) + componentToHex(rgb.g) + componentToHex(rgb.b);
  }

  // Store transition duration with variation and transition index
  let currentTransitionDuration = TRANSITION_DURATION;
  let transitionIndex = 0;
  
  // Flag for white background mode
  let isWhiteBackgroundMode = false;
  let whiteTransitionStartTime = null;
  const WHITE_TRANSITION_DURATION = 1000; // 1 second for smooth transition to white
  
  // Flag for returning to gray mode
  let isReturningToGray = false;
  let grayTransitionStartTime = null;
  const GRAY_TRANSITION_DURATION = 2000; // 2 seconds for smooth transition to gray

  // Calculate deterministic transition duration based on transition index
  function getTransitionDuration(transIndex) {
    const seed = transIndex;
    const random = seededRandom(seed);
    return TRANSITION_DURATION + (random() - 0.5) * 10000; // 55-65 seconds
  }

  // Initialize background state based on current time (deterministic)
  // Uses timestamp to calculate which transition cycle we're in and position within it
  function initializeFromTime(now) {
    // Use a fixed cycle duration (average of transition durations) for simplicity
    // This creates predictable cycles that repeat
    const CYCLE_BASE = 60000; // 60 seconds base
    
    // Calculate which transition cycle we're in (cycles repeat every ~60 seconds)
    // Use seconds since epoch to create a continuous cycle
    const secondsSinceEpoch = Math.floor(now / 1000);
    const cycleNumber = Math.floor(secondsSinceEpoch / (CYCLE_BASE / 1000));
    
    // Calculate position within current cycle (0 to ~60 seconds)
    const positionInCycle = (secondsSinceEpoch % (CYCLE_BASE / 1000)) * 1000; // in milliseconds
    
    // Get transition indices for start and target of current cycle
    transitionIndex = cycleNumber;
    const nextTransitionIndex = cycleNumber + 1;
    
    // Get deterministic durations
    const startDuration = getTransitionDuration(transitionIndex);
    const nextDuration = getTransitionDuration(nextTransitionIndex);
    
    // Calculate which transition we're in and progress within it
    let currentTransStart = 0;
    let currentTransEnd = startDuration;
    let currentTransIndex = transitionIndex;
    
    if (positionInCycle >= startDuration) {
      // We're in the next transition
      currentTransStart = startDuration;
      currentTransEnd = startDuration + nextDuration;
      currentTransIndex = nextTransitionIndex;
      transitionIndex = nextTransitionIndex;
    }
    
    // Get colors for current transition
    startColor = selectTargetColor(currentTransIndex);
    targetColor = selectTargetColor(currentTransIndex + 1);
    
    // Calculate progress within current transition
    const progress = Math.min(1, Math.max(0, (positionInCycle - currentTransStart) / (currentTransEnd - currentTransStart)));
    
    // Set initial colors based on current progress
    currentColor = interpolateColor(startColor, targetColor, progress);
    
    // Set animation start time
    animationStartTime = now - (positionInCycle - currentTransStart);
    currentTransitionDuration = currentTransEnd - currentTransStart;
    
    // Set transition index for next cycle
    transitionIndex = currentTransIndex + 1;
  }

  // Update background color
  function updateBackground() {
    const now = Date.now();
    const body = document.body;
    
    // If returning to gray mode (transitioning from white back to living background)
    if (isReturningToGray) {
      if (grayTransitionStartTime === null) {
        grayTransitionStartTime = now;
        // Capture current color (white) as starting point
        startColor = { ...currentColor };
      }
      
      const elapsed = now - grayTransitionStartTime;
      const progress = Math.min(elapsed / GRAY_TRANSITION_DURATION, 1);
      
      // Interpolate from current color (white) to baseline gray
      currentColor = interpolateColor(startColor, BASELINE_GRAY, progress);
      
      const hexColor = rgbToHex(currentColor);
      body.style.background = hexColor; // Simple background during transition
      
      // When transition is complete, resume living background
      if (progress >= 1) {
        isReturningToGray = false;
        grayTransitionStartTime = null;
        // Set colors to baseline gray to start living animation from gray
        currentColor = { ...BASELINE_GRAY };
        startColor = { ...BASELINE_GRAY };
        // Select new target for living animation
        transitionIndex++;
        targetColor = selectTargetColor(transitionIndex);
        // Reset animation timing
        animationStartTime = now;
        currentTransitionDuration = getTransitionDuration(transitionIndex);
      }
      
      requestAnimationFrame(updateBackground);
      return;
    }
    
    // If white background mode is active
    if (isWhiteBackgroundMode) {
      if (whiteTransitionStartTime === null) {
        whiteTransitionStartTime = now;
        // Capture current color as starting point
        startColor = { ...currentColor };
      }
      
      const elapsed = now - whiteTransitionStartTime;
      const progress = Math.min(elapsed / WHITE_TRANSITION_DURATION, 1);
      
      // Interpolate from current color to white
      const whiteColor = { r: 250, g: 250, b: 250 }; // #FAFAFA
      currentColor = interpolateColor(startColor, whiteColor, progress);
      
      const hexColor = rgbToHex(currentColor);
      body.style.background = hexColor; // Simple white background, no gradient
      
      requestAnimationFrame(updateBackground);
      return;
    }
    
    // Normal living background animation
    const elapsed = now - animationStartTime;
    const progress = Math.min(elapsed / currentTransitionDuration, 1);

    // Interpolate current color towards target
    currentColor = interpolateColor(startColor, targetColor, progress);

    // Apply gradient background for smoother, more organic feel
    const hexColor = rgbToHex(currentColor);
    
    // Create very subtle gradient variation for "living" texture
    // Use time-based variation instead of random for smoother effect
    const timeVariation = Math.sin(now / 5000) * 3; // Slow oscillation
    const gradientColor = {
      r: Math.max(0, Math.min(255, currentColor.r + timeVariation)),
      g: Math.max(0, Math.min(255, currentColor.g + timeVariation)),
      b: Math.max(0, Math.min(255, currentColor.b + timeVariation))
    };
    
    body.style.background = `linear-gradient(135deg, ${hexColor} 0%, ${rgbToHex(gradientColor)} 100%)`;

    // If transition is complete, select new target (deterministic)
    if (progress >= 1) {
      animationStartTime = now;
      
      // Update start color to current target (where we've arrived)
      startColor = { ...targetColor };
      currentColor = { ...targetColor };
      
      // Select new target using deterministic transition index
      transitionIndex++;
      targetColor = selectTargetColor(transitionIndex);
      
      // Calculate deterministic transition duration
      currentTransitionDuration = getTransitionDuration(transitionIndex);
    }

    requestAnimationFrame(updateBackground);
  }
  
  // Public function to transition to white background
  window.transitionToWhiteBackground = function() {
    if (!isWhiteBackgroundMode) {
      isWhiteBackgroundMode = true;
      isReturningToGray = false; // Cancel any gray transition
      grayTransitionStartTime = null;
      whiteTransitionStartTime = null; // Will be set on next animation frame
      // Capture current background color from body as starting point
      const body = document.body;
      const computedStyle = window.getComputedStyle(body);
      const bgColor = computedStyle.backgroundColor;
      
      // Parse RGB from computed style (format: "rgb(r, g, b)" or "rgba(r, g, b, a)")
      const match = bgColor.match(/\d+/g);
      if (match && match.length >= 3) {
        startColor = {
          r: parseInt(match[0], 10),
          g: parseInt(match[1], 10),
          b: parseInt(match[2], 10)
        };
        currentColor = { ...startColor };
      } else {
        // Fallback: use current color
        startColor = { ...currentColor };
      }
    }
  };
  
  // Public function to set white background immediately (without transition)
  window.setWhiteBackground = function() {
    isWhiteBackgroundMode = true;
    isReturningToGray = false;
    grayTransitionStartTime = null;
    whiteTransitionStartTime = Date.now() - WHITE_TRANSITION_DURATION; // Set as already completed
    const whiteColor = { r: 250, g: 250, b: 250 }; // #FAFAFA
    currentColor = whiteColor;
    startColor = whiteColor;
    const body = document.body;
    body.style.background = rgbToHex(whiteColor);
  };
  
  // Public function to resume living background (with smooth transition back to gray)
  window.resumeLivingBackground = function() {
    if (isWhiteBackgroundMode) {
      isWhiteBackgroundMode = false;
      whiteTransitionStartTime = null;
      // Start smooth transition back to gray
      isReturningToGray = true;
      grayTransitionStartTime = null; // Will be set on next animation frame
      // Use current color (white) as starting point
      startColor = { ...currentColor };
    }
  };

  // Initialize the living background
  function initLivingBackground() {
    // Check if body already has white background (set by inline script in project.html)
    const body = document.body;
    const computedStyle = window.getComputedStyle(body);
    const bgColor = computedStyle.backgroundColor;
    const match = bgColor.match(/\d+/g);
    
    // If background is already white (#FAFAFA or rgb(250, 250, 250)), activate white mode immediately
    if (match && match.length >= 3) {
      const r = parseInt(match[0], 10);
      const g = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      // Check if it's white (within small tolerance)
      if (r >= 245 && g >= 245 && b >= 245) {
        isWhiteBackgroundMode = true;
        whiteTransitionStartTime = Date.now() - WHITE_TRANSITION_DURATION; // Set as already completed
        const whiteColor = { r: 250, g: 250, b: 250 };
        currentColor = whiteColor;
        startColor = whiteColor;
        // Start animation loop (will maintain white)
        updateBackground();
        return;
      }
    }
    
    const now = Date.now();
    
    // Initialize state deterministically based on current time
    // This ensures the background continues seamlessly on page refresh
    initializeFromTime(now);
    
    // Log current period for testing
    const dayOfYear = getDayOfYear();
    const period = getPeriod(dayOfYear);
    const weights = getPeriodWeights(period);
    console.log(`📅 Living Background initialized (deterministic, persistent):`);
    console.log(`   Day of year: ${dayOfYear}`);
    console.log(`   Period: ${period} (0=early/near-black, 1=mid-early/baseline, 2=mid-late/near-white, 3=late/baseline)`);
    console.log(`   Probabilities: [near-black: ${(weights[0]*100).toFixed(0)}%, baseline: ${(weights[1]*100).toFixed(0)}%, near-white: ${(weights[2]*100).toFixed(0)}%]`);
    console.log(`   Current color: rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`);

    // Start animation loop
    updateBackground();
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLivingBackground);
  } else {
    initLivingBackground();
  }

})();

