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
    // Steep downward angle so the grid fills top-to-bottom and spills off the sides
    camera.position.set(0, 700, 400);
    camera.lookAt(0, 0, -600);

    // Grid extends away in -Z, so near rows are at z≈-100, far rows at z≈-2740
    const COLS = 55, ROWS = 45, SPACING = 60;
    const COUNT = COLS * ROWS;
    const baseX = new Float32Array(COUNT);
    const baseZ = new Float32Array(COUNT);
    const posArr = new Float32Array(COUNT * 3);
    const colArr = new Float32Array(COUNT * 3); // per-vertex RGB

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const i = r * COLS + c;
            baseX[i] = (c - (COLS - 1) / 2) * SPACING;
            baseZ[i] = -(r * SPACING) - 100;
            posArr[i * 3]     = baseX[i];
            posArr[i * 3 + 1] = 0;
            posArr[i * 3 + 2] = baseZ[i];
            colArr[i * 3] = colArr[i * 3 + 1] = colArr[i * 3 + 2] = 0;
        }
    }

    const geometry = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(posArr, 3);
    const colAttr = new THREE.BufferAttribute(colArr, 3);
    geometry.setAttribute('position', posAttr);
    geometry.setAttribute('color', colAttr);

    const material = new THREE.PointsMaterial({
        size: 11,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.65,
        vertexColors: true,
    });

    scene.add(new THREE.Points(geometry, material));

    // Mouse world position via ray → y=0 plane intersection
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
        updateMouseWorld();

        const isDark = document.documentElement.classList.contains('theme-dark');
        const br = isDark ? 1 : 0;  // base color R
        const bg = isDark ? 1 : 0;
        const bb = isDark ? 1 : 0;

        const RAINBOW_R = 300;

        for (let i = 0; i < COUNT; i++) {
            const x = baseX[i], z = baseZ[i];

            // Wave — slower oscillation, slightly larger amplitude
            let y = Math.sin(x * 0.011 + z * 0.009 + now * 0.0005) * 70
                  + Math.sin(-x * 0.016 + z * 0.013 + now * 0.00038) * 32;

            // Mouse ripple
            let rainbowInfluence = 0;
            if (mouseActive) {
                const dx = x - mouseWorld.x;
                const dz = z - mouseWorld.z;
                const d = Math.sqrt(dx * dx + dz * dz);
                if (d < 350) {
                    y += Math.cos(d * 0.022 - now * 0.005) * (1 - d / 350) * 90;
                }
                if (d < RAINBOW_R) {
                    rainbowInfluence = 1 - d / RAINBOW_R;
                }
            }

            posArr[i * 3 + 1] = y;

            // Color: rainbow near mouse, base color elsewhere
            if (rainbowInfluence > 0) {
                const hue = ((now * 0.00025 + Math.sqrt((x * x + z * z)) * 0.0012) % 1 + 1) % 1;
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

    // Theme toggle — initial class set by inline <head> script to avoid flash.
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

    // YouTube hover-to-play video grid.
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
            if (iframe) {
                iframe.remove();
                iframe = null;
            }
            item.classList.remove('is-playing');
        });

        item.addEventListener('click', () => {
            window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank', 'noopener');
        });
    });
});
