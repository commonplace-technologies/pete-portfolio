// 3D wave dot grid — Three.js WebGL
(function () {
    if (typeof THREE === 'undefined') return;
    const canvas = document.getElementById('particle-bg');
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(0, 450, 1500);
    camera.lookAt(0, -50, 0);

    const COLS = 38, ROWS = 38, SPACING = 55;
    const COUNT = COLS * ROWS;
    const baseX = new Float32Array(COUNT);
    const baseZ = new Float32Array(COUNT);
    const posArr = new Float32Array(COUNT * 3);

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const i = r * COLS + c;
            baseX[i] = (c - (COLS - 1) / 2) * SPACING;
            baseZ[i] = (r - (ROWS - 1) / 2) * SPACING;
            posArr[i * 3]     = baseX[i];
            posArr[i * 3 + 1] = 0;
            posArr[i * 3 + 2] = baseZ[i];
        }
    }

    const geometry = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(posArr, 3);
    geometry.setAttribute('position', posAttr);

    const material = new THREE.PointsMaterial({
        color: 0x2a3a4a,
        size: 11,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.6,
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

    function getColor() {
        return document.documentElement.classList.contains('theme-dark')
            ? 0x6e8ca5 : 0x2a3a4a;
    }

    function animate(now) {
        updateMouseWorld();

        for (let i = 0; i < COUNT; i++) {
            const x = baseX[i], z = baseZ[i];
            let y = Math.sin(x * 0.011 + z * 0.009 + now * 0.00085) * 60
                  + Math.sin(-x * 0.016 + z * 0.013 + now * 0.00065) * 28;

            if (mouseActive) {
                const dx = x - mouseWorld.x;
                const dz = z - mouseWorld.z;
                const d = Math.sqrt(dx * dx + dz * dz);
                if (d < 300) {
                    y += Math.cos(d * 0.022 - now * 0.004) * (1 - d / 300) * 85;
                }
            }

            posArr[i * 3 + 1] = y;
        }
        posAttr.needsUpdate = true;

        material.color.set(getColor());
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
    // Mouseenter swaps the thumbnail for an autoplay iframe (muted — browsers
    // block unmuted autoplay without a direct click gesture). Mouseleave
    // restores the thumbnail by removing the iframe.
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

        // Clicking the video item opens the full YouTube page
        item.addEventListener('click', () => {
            window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank', 'noopener');
        });
    });
});
