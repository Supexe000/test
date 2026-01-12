/* Configuration */
const CONFIG = {
    frameCount: 145,
    path: 'frames_sequence',
    prefix: 'frame_',
    ext: 'webp',
    scrollHeight: 600, // vh
    autoPlayDuration: 5000, // ms
    audioPath: 'audio/bs.mp3'
};

/* State Management */
const state = {
    images: [],
    loadedCount: 0,
    currentFrame: 0,
    phase: 'LOADING', // LOADING, WAITING, AUTOPLAY, MANUAL
    audio: null,
    rafId: null,
    startTime: 0
};

/* DOM Elements */
const canvas = document.getElementById('video-canvas');
const context = canvas.getContext('2d');
const scrollContainer = document.getElementById('scroll-container');

/* Initialization & Layout */
function init() {
    resize();
    preloadImages();
    window.addEventListener('resize', resize);

    // Attach interaction listeners to window
    ['click', 'touchstart', 'wheel', 'keydown', 'scroll'].forEach(evt => {
        window.addEventListener(evt, handleInteraction, { passive: false });
    });
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Redraw current frame if available
    if (state.images[state.currentFrame] && state.images[state.currentFrame].complete) {
        renderFrame(state.currentFrame);
    }
}

/* Asset Loading */
function preloadImages() {
    const batchSize = 10;

    function loadBatch(startIndex) {
        if (startIndex >= CONFIG.frameCount) return;

        let loadedInBatch = 0;
        const endIndex = Math.min(startIndex + batchSize, CONFIG.frameCount);

        for (let i = startIndex; i < endIndex; i++) {
            const img = new Image();
            const num = (i + 1).toString().padStart(3, '0');
            img.src = `${CONFIG.path}/${CONFIG.prefix}${num}.${CONFIG.ext}`;

            img.onload = () => {
                state.loadedCount++;
                loadedInBatch++;

                // First frame logic
                if (i === 0) {
                    renderFrame(0);
                    if (state.phase === 'LOADING') {
                        state.phase = 'WAITING';
                    }
                }

                // Trigger next batch only when this batch is mostly done or fully done
                // To keep it fast, let's trigger next batch when this one is done.
                if (loadedInBatch === (endIndex - startIndex)) {
                    loadBatch(endIndex);
                }
            };

            img.onerror = () => {
                // In case of error, continue anyway to avoid blocking
                state.loadedCount++;
                loadedInBatch++;
                if (loadedInBatch === (endIndex - startIndex)) {
                    loadBatch(endIndex);
                }
            };

            state.images[i] = img;
        }
    }

    // Start first batch
    loadBatch(0);
}

/* Core Rendering */
function renderFrame(index) {
    index = Math.max(0, Math.min(CONFIG.frameCount - 1, Math.round(index)));
    const img = state.images[index];

    if (!img || !img.complete) return;

    // Draw "Cover" logic
    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.width;
    const ih = img.height;

    const targetRatio = cw / ch;
    const imgRatio = iw / ih;

    let sx, sy, sw, sh;

    if (imgRatio > targetRatio) {
        // Image is wider than screen: crop sides
        sh = ih;
        sw = ih * targetRatio;
        sy = 0;
        sx = (iw - sw) / 2;
    } else {
        // Image is taller than screen: crop top/bottom
        sw = iw;
        sh = iw / targetRatio;
        sx = 0;
        sy = (ih - sh) / 2;
    }

    context.clearRect(0, 0, cw, ch);
    context.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
}

/* Audio Manager */
function startAudio() {
    if (!state.audio) {
        state.audio = new Audio(CONFIG.audioPath);
        state.audio.loop = true;
        state.audio.volume = 0.6; // Balanced start
        state.audio.play().catch(e => console.log("Audio play failed (policy):", e));
    }
}

/* Logic Flow */
function handleInteraction(e) {
    if (state.phase === 'WAITING') {
        // Prevent default for events that might scroll/zoom, ensuring clean start
        if (e.type === 'wheel' || e.type === 'touchmove') e.preventDefault();

        startExperience();
    }
}

function startExperience() {
    console.log("Interaction detected. Starting Cinematic Experience.");
    state.phase = 'AUTOPLAY';

    // 1. Start Audio
    startAudio();

    // 2. Remove Interaction Listeners (except scroll which we need later, but for now we replace logic)
    // Actually, we keep listeners but change logic based on phase.

    // 3. Start Animation Loop
    state.startTime = performance.now();
    state.rafId = requestAnimationFrame(autoPlayLoop);
}

function autoPlayLoop(time) {
    if (state.phase !== 'AUTOPLAY') return;

    const elapsed = time - state.startTime;
    const progress = Math.min(1, elapsed / CONFIG.autoPlayDuration);

    // Map progress to frames
    // Linear is best for "video" feel, maybe slight ease-out at very end?
    // Let's stick to Linear for consistent video speed.
    const frameIndex = progress * (CONFIG.frameCount - 1);

    state.currentFrame = frameIndex;
    renderFrame(frameIndex);

    if (progress < 1) {
        state.rafId = requestAnimationFrame(autoPlayLoop);
    } else {
        finishAutoPlay();
    }
}

function finishAutoPlay() {
    console.log("Auto-play finished. Switching to Manual Mode.");
    state.phase = 'MANUAL';

    // Unlock scrolling
    document.body.style.overflowY = 'auto'; // allow vertical scroll

    // IMPORTANT: Sync Scroll Position
    // We are at the end (Frame 144). 
    // We must position the native scrollbar at the bottom so up-scroll works naturally.
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    window.scrollTo(0, maxScroll);

    // Add Scroll Listener for Manual Mode
    window.addEventListener('scroll', onScroll);
}

/* Manual Scroll Handler */
function onScroll() {
    if (state.phase !== 'MANUAL') return;

    const scrollTop = window.scrollY;
    const maxScroll = document.body.scrollHeight - window.innerHeight;

    if (maxScroll <= 0) return;

    // Calculate progress based on scroll
    const progress = scrollTop / maxScroll;
    const frameIndex = progress * (CONFIG.frameCount - 1);

    state.currentFrame = frameIndex;
    renderFrame(frameIndex);
}

// Start
init();
