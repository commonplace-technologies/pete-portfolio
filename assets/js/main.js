// Halftone dot grid background
(function () {
    const canvas = document.getElementById('particle-bg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W, H, dots = [];
    const SPACING    = 24;
    const BASE_R     = 1.2;
    const MAX_R      = 5.5;
    const WAVE_SPEED = 5500;
    const MOUSE_R    = 130;
    const mouse = { x: -9999, y: -9999 };

    function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
        buildGrid();
    }

    function buildGrid() {
        dots = [];
        const cols = Math.ceil(W / SPACING) + 1;
        const rows = Math.ceil(H / SPACING) + 1;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                dots.push({
                    x: c * SPACING,
                    y: r * SPACING,
                    phase: (c * 0.45 + r * 0.3) + Math.random() * 0.3,
                    period: WAVE_SPEED + Math.random() * 2000,
                });
            }
        }
    }

    function dotColor() {
        return document.documentElement.classList.contains('theme-dark')
            ? '110,140,165'
            : '42,58,74';
    }

    function animate(now) {
        ctx.clearRect(0, 0, W, H);
        const rgb = dotColor();

        for (const d of dots) {
            const wave = (Math.sin((now / d.period) * Math.PI * 2 + d.phase) + 1) / 2;
            let r = BASE_R + wave * (MAX_R - BASE_R);

            const dx = d.x - mouse.x;
            const dy = d.y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < MOUSE_R) {
                r += (1 - dist / MOUSE_R) * MAX_R * 1.4;
            }

            ctx.beginPath();
            ctx.arc(d.x, d.y, Math.max(0.4, r), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${rgb},${0.12 + wave * 0.22})`;
            ctx.fill();
        }

        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
    window.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });

    resize();
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
