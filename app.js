/**
 * ROSE PETAL MILK — INTERACTIVE SCROLL ANIMATION ENGINE
 * High-Performance Canvas Image Sequence with Lerp Scroll Physics
 */

(() => {
  'use strict';

  // --- Configuration ---
  const TOTAL_FRAMES = 300;
  const FRAME_DIR = 'frames';
  const FRAME_PREFIX = 'ezgif-frame-';
  const FRAME_EXT = '.jpg';

  // --- DOM Elements ---
  const preloader = document.getElementById('preloader');
  const preloaderBar = document.getElementById('preloaderBar');
  const preloaderPercent = document.getElementById('preloaderPercent');
  const preloaderFrames = document.getElementById('preloaderFrames');

  const experienceSec = document.getElementById('experience');
  const canvas = document.getElementById('sequenceCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const particlesCanvas = document.getElementById('particlesCanvas');
  const particlesCtx = particlesCanvas.getContext('2d');

  const scrubberBar = document.getElementById('scrubberBar');
  const scrubberProgress = document.getElementById('scrubberProgress');
  const scrubberThumb = document.getElementById('scrubberThumb');
  const currentFrameDisplay = document.getElementById('currentFrameDisplay');
  const chapterMarkers = document.querySelectorAll('.chapter-marker');

  const autoplayBtn = document.getElementById('autoplayBtn');
  const playIcon = document.getElementById('playIcon');
  const playText = document.getElementById('playText');
  const speedBtns = document.querySelectorAll('.speed-btn');
  const restartBtn = document.getElementById('restartBtn');
  const replayBtn = document.getElementById('replayBtn');
  const logoLink = document.getElementById('logoLink');

  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIcon = document.getElementById('themeIcon');
  const navbar = document.getElementById('mainNav');

  const chapterCards = document.querySelectorAll('.chapter-card');
  const toastNotification = document.getElementById('toastNotification');
  const toastMessage = document.getElementById('toastMessage');

  // --- State Variables ---
  const frameImages = [];
  let loadedFramesCount = 0;
  let isReady = false;

  let currentFrame = 0;
  let targetFrame = 0;
  let lastRenderedFrame = -1;

  let isAutoplaying = false;
  let autoplaySpeed = 1;
  let autoplayAnimationId = null;

  let isScrubbing = false;
  let isSoundEnabled = false;
  let audioCtx = null;

  // =========================================================================
  // 1. FRAME PRELOADER
  // =========================================================================

  function getFramePath(index) {
    const frameNum = String(index + 1).padStart(3, '0');
    return `${FRAME_DIR}/${FRAME_PREFIX}${frameNum}${FRAME_EXT}`;
  }

  function preloadImages() {
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = getFramePath(i);
      img.onload = () => {
        loadedFramesCount++;
        const pct = Math.floor((loadedFramesCount / TOTAL_FRAMES) * 100);
        
        if (preloaderBar) preloaderBar.style.width = `${pct}%`;
        if (preloaderPercent) preloaderPercent.textContent = `${pct}%`;
        if (preloaderFrames) preloaderFrames.textContent = `${loadedFramesCount} / ${TOTAL_FRAMES} Frames`;

        if (loadedFramesCount === 1) {
          // Draw first frame immediately
          renderFrame(0);
        }

        if (loadedFramesCount === TOTAL_FRAMES) {
          setTimeout(completePreloader, 400);
        }
      };
      img.onerror = () => {
        loadedFramesCount++;
        if (loadedFramesCount === TOTAL_FRAMES) {
          setTimeout(completePreloader, 400);
        }
      };
      frameImages.push(img);
    }
  }

  function completePreloader() {
    isReady = true;
    if (preloader) preloader.classList.add('hidden');
    renderFrame(0);
    initParticles();
  }

  // =========================================================================
  // 2. CANVAS RENDERING ENGINE (High-DPI & Aspect Ratio Preservation)
  // =========================================================================

  function renderFrame(frameIdx) {
    const idx = Math.min(Math.max(Math.round(frameIdx), 0), TOTAL_FRAMES - 1);
    const img = frameImages[idx];

    if (!img || !img.complete || img.naturalWidth === 0) return;

    // Set canvas dimensions
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth || 1280;
    const ch = canvas.clientHeight || 720;

    if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Calculate aspect ratio fit (contain)
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const canvasAspect = cw / ch;

    let drawW, drawH, drawX, drawY;

    if (imgAspect > canvasAspect) {
      drawW = cw;
      drawH = cw / imgAspect;
      drawX = 0;
      drawY = (ch - drawH) / 2;
    } else {
      drawH = ch;
      drawW = ch * imgAspect;
      drawX = (cw - drawW) / 2;
      drawY = 0;
    }

    // Fill background seamless tone
    const isDark = document.body.classList.contains('theme-midnight');
    ctx.fillStyle = isDark ? '#14050a' : '#dfafb2';
    ctx.fillRect(0, 0, cw, ch);

    // Draw the product frame
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();

    lastRenderedFrame = idx;
    updateHUD(idx);
    updateChapters(idx);
  }

  // =========================================================================
  // 3. SCROLL & LERP PHYSICS LOOP
  // =========================================================================

  function updateScrollTarget() {
    if (isAutoplaying || isScrubbing) return;

    const rect = experienceSec.getBoundingClientRect();
    const scrollableDistance = rect.height - window.innerHeight;

    if (scrollableDistance <= 0) return;

    const scrollFraction = Math.min(Math.max(-rect.top / scrollableDistance, 0), 1);
    targetFrame = scrollFraction * (TOTAL_FRAMES - 1);
  }

  function animationLoop() {
    if (isReady) {
      // Lerp smooth frame interpolation
      const diff = targetFrame - currentFrame;
      if (Math.abs(diff) > 0.01) {
        currentFrame += diff * 0.15;
        if (Math.abs(currentFrame - lastRenderedFrame) >= 0.5) {
          renderFrame(currentFrame);
          triggerScrollAudio(currentFrame);
        }
      }
    }

    // Update navbar backdrop on scroll
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    requestAnimationFrame(animationLoop);
  }

  // =========================================================================
  // 4. HUD & CHAPTER PROGRESSION
  // =========================================================================

  function updateHUD(frameIdx) {
    const formatted = String(frameIdx + 1).padStart(3, '0');
    if (currentFrameDisplay) currentFrameDisplay.textContent = formatted;

    const progressPct = (frameIdx / (TOTAL_FRAMES - 1)) * 100;
    if (scrubberProgress) scrubberProgress.style.width = `${progressPct}%`;
    if (scrubberThumb) scrubberThumb.style.left = `${progressPct}%`;

    // Highlight active chapter marker in scrubber
    chapterMarkers.forEach(marker => {
      const markerFrame = parseInt(marker.getAttribute('data-frame'), 10);
      if (Math.abs(frameIdx - markerFrame) < 35) {
        marker.classList.add('active');
      } else {
        marker.classList.remove('active');
      }
    });

  }

  let activeChapterIndex = -1;

  function updateChapters(frameIdx) {
    let newChapterIndex = -1;

    chapterCards.forEach((card, idx) => {
      const start = parseInt(card.getAttribute('data-frame-start'), 10);
      const end = parseInt(card.getAttribute('data-frame-end'), 10);

      if (frameIdx >= start && frameIdx <= end) {
        card.classList.add('active');
        newChapterIndex = idx;
      } else {
        card.classList.remove('active');
      }
    });

    if (newChapterIndex !== activeChapterIndex && newChapterIndex !== -1) {
      activeChapterIndex = newChapterIndex;
      playHarmonicChime(220 * Math.pow(1.25, activeChapterIndex));
    }
  }

  // =========================================================================
  // 5. TIMELINE SCRUBBER DRAG & JUMP
  // =========================================================================

  function seekToProgress(fraction) {
    const clamped = Math.min(Math.max(fraction, 0), 1);
    targetFrame = clamped * (TOTAL_FRAMES - 1);
    currentFrame = targetFrame;
    renderFrame(currentFrame);

    // Sync window scroll within #experience
    const rect = experienceSec.getBoundingClientRect();
    const experienceTop = window.scrollY + rect.top;
    const scrollableDistance = rect.height - window.innerHeight;
    const targetScrollY = experienceTop + (clamped * scrollableDistance);

    window.scrollTo({
      top: targetScrollY,
      behavior: 'auto'
    });
  }

  function handleScrubberEvent(e) {
    if (!scrubberBar) return;
    const rect = scrubberBar.getBoundingClientRect();
    const clientX = (e.clientX !== undefined) ? e.clientX : (e.touches && e.touches[0].clientX);
    const clickX = clientX - rect.left;
    const fraction = clickX / rect.width;
    seekToProgress(fraction);
  }

  if (scrubberBar) {
    scrubberBar.addEventListener('mousedown', (e) => {
      isScrubbing = true;
      handleScrubberEvent(e);

      const onMouseMove = (moveEvent) => {
        if (isScrubbing) handleScrubberEvent(moveEvent);
      };

      const onMouseUp = () => {
        isScrubbing = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    scrubberBar.addEventListener('touchstart', (e) => {
      isScrubbing = true;
      handleScrubberEvent(e);

      const onTouchMove = (moveEvent) => {
        if (isScrubbing) handleScrubberEvent(moveEvent);
      };

      const onTouchEnd = () => {
        isScrubbing = false;
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);
      };

      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onTouchEnd);
    }, { passive: true });
  }

  chapterMarkers.forEach(marker => {
    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetF = parseInt(marker.getAttribute('data-frame'), 10);
      seekToProgress(targetF / (TOTAL_FRAMES - 1));
    });
  });

  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      seekToProgress(0);
      showToast('Returned to Frame 001');
    });
  }

  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      seekToProgress(0);
      showToast('Replaying Botanical Experience');
    });
  }

  if (logoLink) {
    logoLink.addEventListener('click', (e) => {
      e.preventDefault();
      seekToProgress(0);
    });
  }

  // =========================================================================
  // 6. KINETIC AUTOPLAY ENGINE
  // =========================================================================

  function toggleAutoplay() {
    isAutoplaying = !isAutoplaying;

    if (isAutoplaying) {
      if (playIcon) {
        playIcon.classList.remove('fa-play');
        playIcon.classList.add('fa-pause');
      }
      if (playText) playText.textContent = 'Pause';
      if (autoplayBtn) autoplayBtn.classList.add('active');
      startAutoplay();
      showToast('Autoplay Activated');
    } else {
      stopAutoplay();
      if (playIcon) {
        playIcon.classList.remove('fa-pause');
        playIcon.classList.add('fa-play');
      }
      if (playText) playText.textContent = 'Autoplay';
      if (autoplayBtn) autoplayBtn.classList.remove('active');
    }
  }

  function startAutoplay() {
    let lastTime = performance.now();

    function step(now) {
      if (!isAutoplaying) return;

      const delta = (now - lastTime) / 1000;
      lastTime = now;

      // 30 FPS base rate multiplied by speed factor
      targetFrame += 28 * autoplaySpeed * delta;

      if (targetFrame >= TOTAL_FRAMES - 1) {
        targetFrame = TOTAL_FRAMES - 1;
        toggleAutoplay();
        return;
      }

      currentFrame = targetFrame;
      renderFrame(currentFrame);

      // Smoothly sync window scroll
      const scrollableDistance = document.documentElement.scrollHeight - window.innerHeight;
      const progress = targetFrame / (TOTAL_FRAMES - 1);
      window.scrollTo({
        top: progress * scrollableDistance,
        behavior: 'auto'
      });

      autoplayAnimationId = requestAnimationFrame(step);
    }

    autoplayAnimationId = requestAnimationFrame(step);
  }

  function stopAutoplay() {
    if (autoplayAnimationId) {
      cancelAnimationFrame(autoplayAnimationId);
      autoplayAnimationId = null;
    }
  }

  if (autoplayBtn) autoplayBtn.addEventListener('click', toggleAutoplay);

  speedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      speedBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      autoplaySpeed = parseFloat(btn.getAttribute('data-speed'));
      showToast(`Speed set to ${autoplaySpeed}x`);
    });
  });

  // =========================================================================
  // 7. WEB AUDIO API GENERATIVE SOUND ENGINE
  // =========================================================================

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function toggleSound() {
    initAudio();
    isSoundEnabled = !isSoundEnabled;

    const soundIcon = document.getElementById('soundIcon');
    if (isSoundEnabled) {
      if (soundToggleBtn) soundToggleBtn.classList.add('sound-active');
      if (soundIcon) soundIcon.className = 'fa-solid fa-volume-high';
      playHarmonicChime(520);
      showToast('Botanical Soundscape On');
    } else {
      if (soundToggleBtn) soundToggleBtn.classList.remove('sound-active');
      if (soundIcon) soundIcon.className = 'fa-solid fa-volume-xmark';
      showToast('Sound Muted');
    }
  }

  if (soundToggleBtn) soundToggleBtn.addEventListener('click', toggleSound);

  let lastAudioFrame = 0;
  function triggerScrollAudio(frame) {
    if (!isSoundEnabled || !audioCtx) return;

    if (Math.abs(frame - lastAudioFrame) > 18) {
      lastAudioFrame = frame;
      const freq = 400 + (frame % 100) * 4;
      playDropSynth(freq);
    }
  }

  function playDropSynth(freq) {
    if (!audioCtx || !isSoundEnabled) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, audioCtx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.22);
    } catch (e) {}
  }

  function playHarmonicChime(freq = 440) {
    if (!audioCtx || !isSoundEnabled) return;
    try {
      const notes = [freq, freq * 1.25, freq * 1.5];
      notes.forEach((f, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, audioCtx.currentTime + (i * 0.04));

        gain.gain.setValueAtTime(0.03, audioCtx.currentTime + (i * 0.04));
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.6 + (i * 0.04));

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(audioCtx.currentTime + (i * 0.04));
        osc.stop(audioCtx.currentTime + 0.7 + (i * 0.04));
      });
    } catch (e) {}
  }

  // =========================================================================
  // 8. FLOATING ROSE PETALS CANVAS PARTICLE SYSTEM
  // =========================================================================

  let particles = [];
  const PARTICLE_COUNT = 24;

  function initParticles() {
    if (!particlesCanvas) return;
    resizeParticlesCanvas();
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * particlesCanvas.width,
        y: Math.random() * particlesCanvas.height,
        size: Math.random() * 8 + 6,
        speedX: (Math.random() - 0.5) * 0.8,
        speedY: Math.random() * 0.7 + 0.4,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.02,
        opacity: Math.random() * 0.5 + 0.2
      });
    }
    animateParticles();
  }

  function resizeParticlesCanvas() {
    if (!particlesCanvas) return;
    particlesCanvas.width = window.innerWidth;
    particlesCanvas.height = window.innerHeight;
  }

  function animateParticles() {
    if (!particlesCanvas || !particlesCtx) return;
    particlesCtx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);

    const isDark = document.body.classList.contains('theme-midnight');
    const petalColor = isDark ? 'rgba(255, 120, 160, ' : 'rgba(214, 77, 110, ';

    particles.forEach(p => {
      p.x += p.speedX;
      p.y += p.speedY;
      p.rotation += p.rotationSpeed;

      if (p.y > particlesCanvas.height + 20) {
        p.y = -20;
        p.x = Math.random() * particlesCanvas.width;
      }
      if (p.x > particlesCanvas.width + 20) p.x = -20;
      if (p.x < -20) p.x = particlesCanvas.width + 20;

      particlesCtx.save();
      particlesCtx.translate(p.x, p.y);
      particlesCtx.rotate(p.rotation);

      particlesCtx.beginPath();
      particlesCtx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
      particlesCtx.fillStyle = `${petalColor}${p.opacity})`;
      particlesCtx.fill();
      particlesCtx.restore();
    });

    requestAnimationFrame(animateParticles);
  }

  // =========================================================================
  // 9. THEME TOGGLE (Rose Quartz / Midnight Velvet)
  // =========================================================================

  function toggleTheme() {
    const isDark = document.body.classList.toggle('theme-midnight');
    if (themeIcon) themeIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    showToast(isDark ? 'Midnight Velvet Mode' : 'Rose Quartz Mode');
    if (isReady) renderFrame(currentFrame);
  }

  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

  // =========================================================================
  // 10. TOAST NOTIFICATION
  // =========================================================================

  let toastTimer = null;
  function showToast(msg) {
    if (!toastNotification || !toastMessage) return;
    toastMessage.textContent = msg;
    const box = toastNotification.querySelector('.toast-box');
    if (box) {
      box.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        box.classList.remove('show');
      }, 2400);
    }
  }

  // =========================================================================
  // 11. CENTERED NAVIGATION CLICK & SCROLL SPY
  // =========================================================================

  const navLinks = document.querySelectorAll('#mainNavLinks .nav-link');

  function initNavScrollSpy() {
    if (!navLinks.length) return;

    let isProgrammaticScroll = false;
    let scrollTimeout = null;

    // Smooth click navigation
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href');
        if (!targetId || targetId === '#') return;

        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          isProgrammaticScroll = true;
          clearTimeout(scrollTimeout);

          // Update active state immediately on click
          navLinks.forEach(l => l.classList.remove('active'));
          link.classList.add('active');

          const navbarHeight = navbar ? navbar.offsetHeight : 70;
          const targetOffset = targetElement.getBoundingClientRect().top + window.scrollY - navbarHeight + 10;

          window.scrollTo({
            top: targetOffset,
            behavior: 'smooth'
          });

          scrollTimeout = setTimeout(() => {
            isProgrammaticScroll = false;
          }, 900);
        }
      });
    });

    // IntersectionObserver for scroll-based active state
    const observedSections = [
      { id: 'experience', href: null },
      { id: 'about', href: '#about' },
      { id: 'product', href: '#product' },
      { id: 'experience-lifestyle', href: '#experience-lifestyle' }
    ];

    const observerOptions = {
      root: null,
      rootMargin: '-30% 0px -50% 0px',
      threshold: [0, 0.2, 0.5]
    };

    const sectionObserver = new IntersectionObserver((entries) => {
      if (isProgrammaticScroll) return;

      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.id;
          if (sectionId === 'experience') {
            // At top experience hero, clear active section highlight
            navLinks.forEach(link => link.classList.remove('active'));
          } else {
            navLinks.forEach(link => {
              if (link.getAttribute('href') === `#${sectionId}`) {
                link.classList.add('active');
              } else {
                link.classList.remove('active');
              }
            });
          }
        }
      });
    }, observerOptions);

    observedSections.forEach(sec => {
      const el = document.getElementById(sec.id);
      if (el) sectionObserver.observe(el);
    });
  }

  // =========================================================================
  // 12. EVENT LISTENERS & INITIALIZATION
  // =========================================================================

  window.addEventListener('scroll', updateScrollTarget, { passive: true });
  window.addEventListener('resize', () => {
    resizeParticlesCanvas();
    if (isReady) renderFrame(currentFrame);
  });

  // Kickstart
  preloadImages();
  initNavScrollSpy();
  requestAnimationFrame(animationLoop);

})();
