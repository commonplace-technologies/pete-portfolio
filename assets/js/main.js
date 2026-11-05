// Particle field background
(function () {
    const canvas = document.getElementById('particle-bg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W, H;
    const mouse = { x: -9999, y: -9999 };
    const COUNT = 55;
    const REPEL_RADIUS = 110;
    const REPEL_STRENGTH = 55;
    const particles = [];

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }

    function makeParticle() {
        return {
            bx: Math.random() * W,
            by: Math.random() * H,
            vx: (Math.random() - 0.5) * 0.25,
            vy: (Math.random() - 0.5) * 0.25,
            phase:  Math.random() * Math.PI * 2,
            phaseY: Math.random() * Math.PI * 2,
            ampX:   10 + Math.random() * 20,
            ampY:   15 + Math.random() * 25,
            period: 4000 + Math.random() * 4000,
            r:      1 + Math.random(),
            opacity: 0.2 + Math.random() * 0.2,
        };
    }

    function init() {
        particles.length = 0;
        for (let i = 0; i < COUNT; i++) particles.push(makeParticle());
    }

    function dotColor() {
        return document.documentElement.classList.contains('theme-dark')
            ? '240,240,240'
            : '0,0,0';
    }

    function animate(now) {
        ctx.clearRect(0, 0, W, H);
        const rgb = dotColor();

        for (const p of particles) {
            // Slow drift — wrap at edges
            p.bx += p.vx;
            p.by += p.vy;
            if (p.bx < -20) p.bx = W + 20;
            if (p.bx > W + 20) p.bx = -20;
            if (p.by < -20) p.by = H + 20;
            if (p.by > H + 20) p.by = -20;

            // Wave oscillation
            const t = now / p.period;
            let x = p.bx + Math.sin(t * Math.PI * 2 + p.phase)  * p.ampX;
            let y = p.by + Math.sin(t * Math.PI * 2 + p.phaseY) * p.ampY;

            // Mouse repulsion
            const dx = x - mouse.x;
            const dy = y - mouse.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < REPEL_RADIUS * REPEL_RADIUS && d2 > 0) {
                const d = Math.sqrt(d2);
                const f = (REPEL_RADIUS - d) / REPEL_RADIUS;
                x += (dx / d) * f * REPEL_STRENGTH;
                y += (dy / d) * f * REPEL_STRENGTH;
            }

            ctx.beginPath();
            ctx.arc(x, y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${rgb},${p.opacity})`;
            ctx.fill();
        }

        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', () => { resize(); init(); });
    window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
    window.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });

    resize();
    init();
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
