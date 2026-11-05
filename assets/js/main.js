// 3D wave dot grid — Three.js WebGL
(function () {
    if (typeof THREE === 'undefined') return;
    const canvas = document.getElementById('particle-bg');
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 12000);

    // Each page has a resting camera angle: home/tracks = 0, about = π/2
    function pageAngle(path) {
        const p = (path || '/').replace(/\/$/, '') || '/';
        return p === '/about' ? Math.PI / 2 : 0;
    }

    // Start at the correct angle for the initial page (no animation needed on load)
    let camTheta = pageAngle(window.location.pathname);

    // Scroll-driven camera: zoom in + lower angle as page scrolls down
    const CAM_TOP  = { x: 0, y: 700, z: 400 };
    const CAM_BOT  = { x: 0, y: 180, z: 950 };
    const LOOK_TOP = { x: 0, y: 0, z: -600 };
    const LOOK_BOT = { x: 0, y: 0, z: -50  };
    const FOV_TOP  = 55, FOV_BOT = 44;

    let scrollT = 0, scrollTargetT = 0;

    window.addEventListener('scroll', () => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        scrollTargetT = maxScroll > 0 ? Math.min(window.scrollY / maxScroll, 1) : 0;
    }, { passive: true });

    function setCameraAngle(theta) {
        const t = scrollT;
        const camX = CAM_TOP.x + (CAM_BOT.x - CAM_TOP.x) * t;
        const camY = CAM_TOP.y + (CAM_BOT.y - CAM_TOP.y) * t;
        const camZ = CAM_TOP.z + (CAM_BOT.z - CAM_TOP.z) * t;
        const lx   = LOOK_TOP.x + (LOOK_BOT.x - LOOK_TOP.x) * t;
        const ly   = LOOK_TOP.y + (LOOK_BOT.y - LOOK_TOP.y) * t;
        const lz   = LOOK_TOP.z + (LOOK_BOT.z - LOOK_TOP.z) * t;
        const cos = Math.cos(theta), sin = Math.sin(theta);
        const rCamX = camX - GRID_CX, rCamZ = camZ - GRID_CZ;
        const rLkX  = lx   - GRID_CX, rLkZ  = lz   - GRID_CZ;
        camera.position.set(
            rCamX * cos - rCamZ * sin + GRID_CX,
            camY,
            rCamX * sin + rCamZ * cos + GRID_CZ
        );
        camera.lookAt(
            rLkX * cos - rLkZ * sin + GRID_CX,
            ly,
            rLkX * sin + rLkZ * cos + GRID_CZ
        );
        camera.fov = FOV_TOP + (FOV_BOT - FOV_TOP) * t;
        camera.updateProjectionMatrix();
    }

    // Transition state
    let transStart = null, transFrom = 0, transTo = 0;
    const TRANS_MS = 650;
    let pendingCallback = null;

    function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

    function tickTransition(now) {
        if (transStart === null) return;
        const t = Math.min((now - transStart) / TRANS_MS, 1);
        camTheta = transFrom + (transTo - transFrom) * easeInOut(t);
        if (t >= 1) {
            transStart = null;
            camTheta = transTo;
            if (pendingCallback) {
                const cb = pendingCallback;
                pendingCallback = null;
                cb();
            }
        }
    }

    // Round dot sprite texture
    function circleTexture() {
        const sz = 64;
        const c = document.createElement('canvas');
        c.width = c.height = sz;
        const cx = c.getContext('2d');
        cx.beginPath();
        cx.arc(sz / 2, sz / 2, sz / 2 - 2, 0, Math.PI * 2);
        cx.fillStyle = '#fff';
        cx.fill();
        return new THREE.CanvasTexture(c);
    }

    const COLS = 55, ROWS = 45, SPACING = 60;
    const COUNT = COLS * ROWS;
    const GRID_CX = 0;
    const GRID_CZ = -((ROWS - 1) * SPACING / 2) - 100; // ≈ -1420

    setCameraAngle(camTheta);

    const baseX = new Float32Array(COUNT);
    const baseZ = new Float32Array(COUNT);
    const posArr = new Float32Array(COUNT * 3);
    const colArr = new Float32Array(COUNT * 3);

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const i = r * COLS + c;
            baseX[i] = (c - (COLS - 1) / 2) * SPACING;
            baseZ[i] = -(r * SPACING) - 100;
            posArr[i * 3]     = baseX[i];
            posArr[i * 3 + 1] = 0;
            posArr[i * 3 + 2] = baseZ[i];
        }
    }

    const geometry = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(posArr, 3);
    const colAttr = new THREE.BufferAttribute(colArr, 3);
    geometry.setAttribute('position', posAttr);
    geometry.setAttribute('color', colAttr);

    const material = new THREE.PointsMaterial({
        map: circleTexture(),
        alphaTest: 0.4,
        size: 10,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.65,
        vertexColors: true,
    });

    scene.add(new THREE.Points(geometry, material));

    const raycaster = new THREE.Raycaster();
    const mouseNDC = new THREE.Vector2(-9999, -9999);
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const mouseWorld = new THREE.Vector3();
    let mouseActive = false;

    function updateMouseWorld() {
        if (!mouseActive) return;
        raycaster.setFromCamera(mouseNDC, camera);
        raycaster.ray.intersectPlane(groundPlane, mouseWorld);
    }

    const tmpColor = new THREE.Color();

    function animate(now) {
        scrollT += (scrollTargetT - scrollT) * 0.07;
        tickTransition(now);
        setCameraAngle(camTheta);
        updateMouseWorld();

        const isDark = document.documentElement.classList.contains('theme-dark');
        const br = isDark ? 1 : 0;
        const bg = isDark ? 1 : 0;
        const bb = isDark ? 1 : 0;

        const RAINBOW_R = 160;
        const RIPPLE_R  = 180;

        for (let i = 0; i < COUNT; i++) {
            const x = baseX[i], z = baseZ[i];

            const t = now + waveOffset;
            let y = Math.sin(x * 0.011 + z * 0.009 + t * 0.0005) * 38
                  + Math.sin(-x * 0.016 + z * 0.013 + t * 0.00038) * 18;

            let rainbowInfluence = 0;
            if (mouseActive) {
                const dx = x - mouseWorld.x;
                const dz = z - mouseWorld.z;
                const d = Math.sqrt(dx * dx + dz * dz);
                if (d < RIPPLE_R) {
                    y += Math.cos(d * 0.03 - now * 0.005) * (1 - d / RIPPLE_R) * 55;
                }
                if (d < RAINBOW_R) {
                    rainbowInfluence = 1 - d / RAINBOW_R;
                }
            }

            posArr[i * 3 + 1] = y;

            if (rainbowInfluence > 0) {
                const hue = ((now * 0.00025 + Math.sqrt(x * x + z * z) * 0.0012) % 1 + 1) % 1;
                tmpColor.setHSL(hue, 1.0, 0.5);
                colArr[i * 3]     = br + (tmpColor.r - br) * rainbowInfluence;
                colArr[i * 3 + 1] = bg + (tmpColor.g - bg) * rainbowInfluence;
                colArr[i * 3 + 2] = bb + (tmpColor.b - bb) * rainbowInfluence;
            } else {
                colArr[i * 3]     = br;
                colArr[i * 3 + 1] = bg;
                colArr[i * 3 + 2] = bb;
            }
        }

        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;

        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('mousemove', e => {
        mouseNDC.set(
            (e.clientX / window.innerWidth) * 2 - 1,
            -(e.clientY / window.innerHeight) * 2 + 1
        );
        mouseActive = true;
    });

    window.addEventListener('mouseleave', () => { mouseActive = false; });

    // Continuous wave time — sessionStorage offset keeps wave phase across loads
    let waveOffset = 0;
    const waveRef = sessionStorage.getItem('wave-ref');
    if (waveRef) waveOffset = Date.now() - parseInt(waveRef);
    // Keep waveRef alive so the next load can sync
    sessionStorage.setItem('wave-ref', (Date.now() - waveOffset).toString());

    // SPA navigation — camera rotates to new page angle, then content swaps
    // No full reload, background runs continuously the entire time
    window._navigateSPA = function (url, options) {
        const replaceHistory = (options && options.replaceHistory) || false;
        const destPath = new URL(url, location.origin).pathname;
        const targetAngle = pageAngle(destPath);

        // Start rotation toward the destination page's resting angle
        transFrom = camTheta;
        transTo = targetAngle;
        transStart = performance.now();

        // Fetch the new page content in parallel with the animation
        const fetchPromise = fetch(url, { headers: { Accept: 'text/html' } }).then(r => {
            if (!r.ok) throw new Error('fetch failed');
            return r.text();
        });

        // When the rotation completes, swap the content
        pendingCallback = async function () {
            try {
                const html = await fetchPromise;
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const newContent = doc.getElementById('page-content');
                if (!newContent) throw new Error('no #page-content');

                document.getElementById('page-content').replaceWith(newContent);
                document.title = doc.title;

                if (replaceHistory) {
                    history.replaceState({}, doc.title, url);
                } else {
                    history.pushState({}, doc.title, url);
                }

                // Reset scroll position for the new page
                scrollTargetT = 0;
                scrollT = 0;
                window.scrollTo(0, 0);

                if (typeof window._initPageHandlers === 'function') window._initPageHandlers();
            } catch (e) {
                // Fallback to full navigation if SPA swap fails
                window.location.href = url;
            }
        };
    };

    requestAnimationFrame(animate);
})();

document.addEventListener('DOMContentLoaded', function () {
    // Mobile nav toggle
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (navToggle) {
        navToggle.addEventListener('click', function () {
            navMenu.classList.toggle('active');
            const spans = navToggle.querySelectorAll('span');
            if (navMenu.classList.contains('active')) {
                spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
                spans[1].style.opacity = '0';
                spans[2].style.transform = 'rotate(-45deg) translate(7px, -6px)';
            } else {
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            }
        });
        navMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', function () {
                navMenu.classList.remove('active');
                const spans = navToggle.querySelectorAll('span');
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            });
        });
    }

    // Theme toggle
    const root = document.documentElement;

    function currentTheme() {
        return root.classList.contains('theme-dark') ? 'dark' : 'light';
    }

    function applyTheme(theme) {
        root.classList.toggle('theme-dark', theme === 'dark');
        root.classList.toggle('theme-light', theme === 'light');
        syncButtons('[data-theme]', 'theme', theme);
    }

    function syncButtons(selector, attr, active) {
        document.querySelectorAll(selector).forEach(b => {
            b.classList.toggle('is-active', b.dataset[attr] === active);
            b.setAttribute('aria-pressed', String(b.dataset[attr] === active));
        });
    }

    syncButtons('[data-theme]', 'theme', currentTheme());

    document.querySelectorAll('[data-theme]').forEach(btn => {
        btn.addEventListener('click', () => {
            const next = btn.dataset.theme;
            applyTheme(next);
            try { localStorage.setItem('pete.theme', next); } catch (e) {}
        });
    });

    // SPA nav links — intercept clicks on internal links in the nav
    document.querySelectorAll('.nav-menu a[href]').forEach(link => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('mailto') || href.startsWith('#')) return;
        link.addEventListener('click', e => {
            const dest = new URL(href, location.origin).pathname.replace(/\/$/, '') || '/';
            const current = window.location.pathname.replace(/\/$/, '') || '/';
            if (dest === current) return;
            e.preventDefault();
            if (window._navigateSPA) window._navigateSPA(href);
        });
    });

    // Browser back/forward — refetch the content for the restored URL
    window.addEventListener('popstate', function () {
        if (window._navigateSPA) {
            window._navigateSPA(window.location.href, { replaceHistory: true });
        } else {
            window.location.reload();
        }
    });

    // Page-specific handlers — run on initial load and after every SPA swap
    function initPageHandlers() {
        // Smooth scroll for anchor links within the current page content
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                const href = this.getAttribute('href');
                if (href !== '#') {
                    e.preventDefault();
                    const target = document.querySelector(href);
                    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });

        // YouTube hover-to-play video grid
        document.querySelectorAll('.video-item').forEach(item => {
            const videoId = item.dataset.videoId;
            if (!videoId) return;

            let iframe = null;

            item.addEventListener('mouseenter', () => {
                if (iframe) return;
                iframe = document.createElement('iframe');
                iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0`;
                iframe.allow = 'autoplay; encrypted-media';
                iframe.title = item.querySelector('.video-title')?.textContent || '';
                item.appendChild(iframe);
                item.classList.add('is-playing');
            });

            item.addEventListener('mouseleave', () => {
                if (iframe) { iframe.remove(); iframe = null; }
                item.classList.remove('is-playing');
            });

            item.addEventListener('click', () => {
                window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank', 'noopener');
            });
        });
    }

    // Expose for SPA content swaps
    window._initPageHandlers = initPageHandlers;
    initPageHandlers();
});
