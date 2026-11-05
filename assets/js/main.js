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

    // Current orbit angle (Y-axis rotation around world origin)
    let camTheta = 0;

    setCameraAngle(0);

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
        // Orbit around grid center, not world origin
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
    let pendingUrl = null;

    function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

    function tickTransition(now) {
        if (transStart === null) return;
        const t = Math.min((now - transStart) / TRANS_MS, 1);
        camTheta = transFrom + (transTo - transFrom) * easeInOut(t);
        setCameraAngle(camTheta);
        if (t >= 1) {
            transStart = null;
            camTheta = transTo;
            if (pendingUrl) { window.location.href = pendingUrl; pendingUrl = null; }
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
    // Z coordinate of grid center — used as orbit pivot
    const GRID_CX = 0;
    const GRID_CZ = -((ROWS - 1) * SPACING / 2) - 100; // ≈ -1420
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
        scrollT += (scrollTargetT - scrollT) * 0.07;  // smooth lerp
        tickTransition(now);
        setCameraAngle(camTheta);
        updateMouseWorld();

        const isDark = document.documentElement.classList.contains('theme-dark');
        const br = isDark ? 1 : 0;
        const bg = isDark ? 1 : 0;
        const bb = isDark ? 1 : 0;

        const RAINBOW_R = 160;  // smaller radius
        const RIPPLE_R  = 180;

        for (let i = 0; i < COUNT; i++) {
            const x = baseX[i], z = baseZ[i];

            const t = now + waveOffset;
            // Slower wave, smaller peaks
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

    // Continuous wave time across page loads — so the grid doesn't reset
    let waveOffset = 0;
    const waveRef = sessionStorage.getItem('wave-ref');
    if (waveRef) waveOffset = Date.now() - parseInt(waveRef);

    // Expose transition trigger for nav links (wired up in DOMContentLoaded)
    window._triggerCamTransition = function (url, direction) {
        sessionStorage.setItem('wave-ref', Date.now().toString());
        transFrom = camTheta;
        transTo = camTheta + direction * Math.PI / 2;
        transStart = performance.now();
        pendingUrl = url;
    };

    // On page load: check for incoming transition
    const incoming = sessionStorage.getItem('cam-incoming');
    if (incoming !== null) {
        sessionStorage.removeItem('cam-incoming');
        const startAngle = parseFloat(incoming);
        camTheta = startAngle;
        setCameraAngle(startAngle);
        transFrom = startAngle;
        transTo = 0;
        transStart = performance.now();
    }

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

    // Smooth scroll for anchor links
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

    // Camera rotation on nav transitions (Music ↔ About)
    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
    document.querySelectorAll('.nav-menu a[href]').forEach(link => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('mailto') || href.startsWith('#')) return;
        const dest = href.replace(/\/$/, '') || '/';
        if (dest === currentPath) return;  // already here

        link.addEventListener('click', e => {
            if (!window._triggerCamTransition) return;
            e.preventDefault();
            // Direction: going deeper (+1) or back (-1) based on path depth
            const dir = dest.length > currentPath.length ? 1 : -1;
            sessionStorage.setItem('cam-incoming', String(-dir * Math.PI / 2));
            window._triggerCamTransition(href, dir);
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
});
