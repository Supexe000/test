const canvas = document.getElementById('video-canvas');
const context = canvas.getContext('2d');

// --- Configuration ---
const CONFIG = {
    frameCount: 145, // 0 to 144
    path: 'frames_sequence',
    prefix: 'frame_',
    ext: 'webp',
    scrollLengthHSV: 600, // height in vh
    duration: 5000 // duration of auto-play in ms
};

// --- State ---
const state = {
    images: [],
    loadedCount: 0,
    currentFrame: 0,
    phase: 'LOADING', // LOADING, INTRO, WAITING_FOR_REPLAY, REPLAY_PLAYING, MANUAL
    rafId: null
};

// --- DOM Elements ---
const scrollContainer = document.getElementById('scroll-container');
const scrollSpacer = document.getElementById('scroll-spacer');
scrollSpacer.style.height = `${CONFIG.scrollLengthHSV}vh`;

// --- Resize Handling ---
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    renderFrame(state.currentFrame);
}
window.addEventListener('resize', resize);
resize(); // Init

// --- Rendering ---
function renderFrame(index) {
    index = Math.round(index);
    // Clamp
    if (index < 0) index = 0;
    if (index >= CONFIG.frameCount) index = CONFIG.frameCount - 1;

    // Check image
    const img = state.images[index];
    if (!img || !img.complete) return;

    // Draw Cover
    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.width;
    const ih = img.height;

    // Aspect ratios
    const targetRatio = cw / ch;
    const imgRatio = iw / ih;

    let sx, sy, sw, sh;

    if (imgRatio > targetRatio) {
        // Image wider: crop horizontal
        sh = ih;
        sw = ih * targetRatio;
        sy = 0;
        sx = (iw - sw) / 2;
    } else {
        // Image taller: crop vertical
        sw = iw;
        sh = iw / targetRatio;
        sx = 0;
        sy = (ih - sh) / 2;
    }

    context.clearRect(0, 0, cw, ch);
    context.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
}

// --- Loading ---
function preload() {
    for (let i = 0; i < CONFIG.frameCount; i++) {
        const img = new Image();
        const num = i.toString().padStart(3, '0');
        img.src = `${CONFIG.path}/${CONFIG.prefix}${num}.${CONFIG.ext}`;
        img.onload = () => {
            state.loadedCount++;
            if (state.loadedCount === CONFIG.frameCount) {
                onAllLoaded();
            }
        };
        // If first frame loads, render it so screen isn't empty
        if (i === 0) {
            img.onload = () => {
                state.loadedCount++;
                renderFrame(0);
                if (state.loadedCount === CONFIG.frameCount) onAllLoaded();
            }
        }
        state.images.push(img);
    }
}

function onAllLoaded() {
    if (state.phase === 'LOADING') {
        startIntro();
    }
}

// --- Animation Engine ---
// Animates scroll position programmatically
function animateScroll(targetY, duration, onComplete) {
    const startY = window.scrollY;
    // If we are already there
    const dist = targetY - startY;
    if (dist === 0) {
        if (onComplete) onComplete();
        return;
    }

    const startTime = performance.now();

    function loop(time) {
        const elapsed = time - startTime;
        const progress = Math.min(1, elapsed / duration);

        // Ease Out Cubic or Linear? User said "smoothly". Linear is like video.
        // Let's use Linear for video-like feel, maybe slight ease out at end?
        // Pure linear is best for "Video" feel.
        const ease = progress; // t => t

        const newY = startY + (dist * ease);
        window.scrollTo(0, newY);

        if (progress < 1) {
            state.rafId = requestAnimationFrame(loop);
        } else {
            if (onComplete) onComplete();
        }
    }
    state.rafId = requestAnimationFrame(loop);
}

// --- Logic Flow ---

function startIntro() {
    console.log("Starting Intro");
    state.phase = 'INTRO';
    document.body.classList.add('no-scroll');

    // Ensure we start at 0
    window.scrollTo(0, 0);

    // Recalculate maxScroll just in case resize happened or layout updated
    const maxScroll = document.body.scrollHeight - window.innerHeight;

    if (maxScroll <= 0) {
        console.warn("Scroll height is insufficient for intro animation.");
        // Fallback: just play frames? Or force layout?
        // Let's assume CSS fix works, but if not, we should at least unlock.
        state.phase = 'WAITING_FOR_REPLAY';
        document.body.classList.remove('no-scroll');
        return;
    }

    animateScroll(maxScroll, CONFIG.duration, () => {
        console.log("Intro Finished");
        // State -> Waiting for Reply
        state.phase = 'WAITING_FOR_REPLAY';
        document.body.classList.remove('no-scroll');
        // Now user is at bottom. Canvas shows last frame (via scroll listener).
    });
}

function triggerReplay() {
    if (state.phase !== 'WAITING_FOR_REPLAY') return;

    console.log("Triggering Replay");
    state.phase = 'REPLAY_PLAYING';
    document.body.classList.add('no-scroll');

    // Jump to top instantly
    window.scrollTo(0, 0);

    const maxScroll = document.body.scrollHeight - window.innerHeight;

    animateScroll(maxScroll, CONFIG.duration, () => {
        console.log("Replay Finished -> Manual Mode");
        state.phase = 'MANUAL';
        document.body.classList.remove('no-scroll');
    });
}

// --- Event Listeners ---

// Master Scroll Listener: Updates visual frame based on scroll position
// effectively unifying Auto and Manual modes.
window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) return;

    const progress = Math.min(1, Math.max(0, scrollTop / maxScroll));
    const frameIndex = Math.floor(progress * (CONFIG.frameCount - 1));

    // Update State
    state.currentFrame = frameIndex;
    renderFrame(frameIndex);

    // Detect Interaction for Replay Trigger
    // Use a small threshold to detect if user tried to scroll away from bottom
    // We only care if we are in WAITING_FOR_REPLAY phase
    if (state.phase === 'WAITING_FOR_REPLAY') {
        // If scroll changed significantly? 
        // Logic: WAITING_FOR_REPLAY means we unlocked scroll at bottom.
        // If user scrolls up, scrollTop decreases.
        // "On first user touch... auto-play".
        // This implies hijacking the scroll attempt.
        triggerReplay();
    }
});

// Detect Click/Touch for Replay Trigger
const interactionHandler = (e) => {
    if (state.phase === 'WAITING_FOR_REPLAY') {
        triggerReplay();
    }
};

window.addEventListener('click', interactionHandler);
window.addEventListener('touchstart', interactionHandler, { passive: true });
// Wheel is handled by scroll listener mostly, but let's be safe
window.addEventListener('wheel', () => {
    if (state.phase === 'WAITING_FOR_REPLAY') {
        // This might fire before scroll event
        // triggerReplay(); 
        // Let scroll listener handle it to avoid duplicate triggers usually safe due to phase check
    }
}, { passive: true });


// Start
preload();
