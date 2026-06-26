// Build script for pete.bacus.org.
//
// Reads:
//   site-content.json              — site meta, sections, track list
//   content/tracks/<slug>/body.md  — front-matter + markdown per track
//   content/about/about.md         — about page
//
// Writes dist/ as plain static HTML:
//   dist/index.html                — homepage (all sections)
//   dist/tracks/<slug>/index.html  — one page per track (clean URL)
//   dist/about/index.html          — about page
//   dist/assets/                   — copied verbatim
//   dist/.nojekyll, dist/CNAME

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { marked } from 'marked';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = path.join(ROOT, 'content');
const DIST = path.join(ROOT, 'dist');

const site = JSON.parse(await fs.readFile(path.join(ROOT, 'site-content.json'), 'utf8'));

// ---------- helpers ----------

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

function youtubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function soundcloudEmbedUrl(url) {
  if (!url) return null;
  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23000000&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`;
}

function spotifyEmbedUrl(url) {
  if (!url) return null;
  // Convert open.spotify.com/track/ID → embed URL
  return url.replace('open.spotify.com/', 'open.spotify.com/embed/');
}

const trackHref = (slug) => `/tracks/${slug}/`;

// ---------- data loaders ----------

async function loadTrack(slug) {
  const dir = path.join(CONTENT, 'tracks', slug);
  const raw = await fs.readFile(path.join(dir, 'body.md'), 'utf8');
  const { data, content } = matter(raw);
  return { slug, ...data, body: content.trim() };
}

async function loadAbout() {
  const raw = await fs.readFile(path.join(CONTENT, 'about', 'about.md'), 'utf8');
  const { data, content } = matter(raw);
  return { ...data, body: content.trim() };
}

// ---------- templates ----------

function layout({ title, description, currentPath, content }) {
  const fullTitle = title === site.site.title ? title : `${title} — ${site.site.title}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(description || site.site.meta.description)}">
  <meta property="og:title" content="${escapeHtml(fullTitle)}">
  <meta property="og:description" content="${escapeHtml(description || site.site.meta.description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://pete.bacus.org${currentPath}">
  <link rel="preload" href="/assets/fonts/iAWriterQuattroS-Regular.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/assets/css/style.css">
  <script>
    (function() {
      try {
        var theme = localStorage.getItem('pete.theme');
        if (!theme) theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        document.documentElement.classList.add('theme-' + theme);
      } catch (e) {}
    })();
  </script>
</head>
<body>
  <div class="utility-bar">
    <div class="theme-switch" role="group" aria-label="Theme">
      <button data-theme="light" type="button" aria-label="Light theme">Light</button>
      <span aria-hidden="true">/</span>
      <button data-theme="dark" type="button" aria-label="Dark theme">Dark</button>
    </div>
  </div>
  <nav class="navbar">
    <div class="container">
      <a href="/" class="logo">${escapeHtml(site.site.title)}</a>
      <button class="nav-toggle" aria-label="Toggle navigation" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <ul class="nav-menu">
        <li><a href="/"${currentPath === '/' ? ' aria-current="page"' : ''}>Music</a></li>
        <li><a href="/about/"${currentPath === '/about/' ? ' aria-current="page"' : ''}>About</a></li>
        <li><a href="mailto:${site.about.email}">Contact</a></li>
      </ul>
    </div>
  </nav>
  ${content}
  <footer class="footer">
    <div class="container">
      <p>&copy; ${new Date().getFullYear()} ${escapeHtml(site.site.title)}.</p>
      <div class="footer-links">
        <a href="${site.about.social.spotify}" target="_blank" rel="noopener">Spotify</a>
        <a href="${site.about.social.soundcloud}" target="_blank" rel="noopener">SoundCloud</a>
        <a href="${site.about.social.instagram}" target="_blank" rel="noopener">Instagram</a>
        <a href="mailto:${site.about.email}">Email</a>
      </div>
    </div>
  </footer>
  <script src="/assets/js/main.js"></script>
</body>
</html>
`;
}

function trackTypeLabel(track) {
  if (track.soundcloud_url) return 'Mix';
  if (track.youtube_url) return 'Video';
  if (track.audio_file) return 'Audio';
  if (track.spotify_url) return 'Stream';
  return '';
}

function homePage(tracksBySlug) {
  const sections = site.navigation.sections.map((section) => {
    const tracks = section.tracks.map((t) => tracksBySlug.get(t.id)).filter(Boolean);

    // Separate YouTube tracks (get video grid treatment) from others (get card treatment)
    const videoTracks = tracks.filter((t) => youtubeId(t.youtube_url));
    const cardTracks = tracks.filter((t) => !youtubeId(t.youtube_url));

    const videoGrid = videoTracks.length > 0 ? `
      <div class="video-grid">
        ${videoTracks.map((t) => {
          const vid = youtubeId(t.youtube_url);
          return `
        <div class="video-item" data-video-id="${vid}">
          <img
            class="video-thumb"
            src="https://img.youtube.com/vi/${vid}/hqdefault.jpg"
            alt="${escapeHtml(t.title)}"
            loading="lazy"
          >
          <div class="video-overlay"></div>
          <p class="video-title">${escapeHtml(t.title)}</p>
        </div>`;
        }).join('')}
      </div>` : '';

    const cards = cardTracks.map((t) => {
      const label = trackTypeLabel(t);
      return `
        <a href="${trackHref(t.slug)}" class="project-card">
          <div class="project-card-content">
            <h3>${escapeHtml(t.title)}${t.year ? `<span class="track-year">${t.year}</span>` : ''}</h3>
            ${label ? `<span class="track-type">${label}</span>` : ''}
            ${t.credit_role ? `<span class="track-role">${escapeHtml(t.credit_role)}</span>` : ''}
          </div>
        </a>`;
    }).join('');

    return `
      <section class="gallery-section" id="${section.id}">
        <h2 class="section-title">${escapeHtml(section.title)}</h2>
        ${videoGrid}
        ${cardTracks.length > 0 ? `<div class="project-grid">${cards}
        </div>` : ''}
      </section>`;
  }).join('');

  const hero = `
    <header class="hero">
      <div class="container hero-container">
        <div class="hero-text">
          <h1 class="hero-title">${escapeHtml(site.site.title)}</h1>
          <p class="hero-tagline">${escapeHtml(site.site.tagline)}</p>
          <div class="hero-cta">
            <a href="/about/" class="btn btn-primary">About</a>
            <a href="#mixes" class="btn btn-secondary">Listen</a>
          </div>
        </div>
      </div>
    </header>`;

  return hero + `
    <main class="portfolio">
      <div class="container">${sections}
      </div>
    </main>`;
}

function trackPage(track) {
  const body = track.body ? marked.parse(track.body) : '';
  const vid = youtubeId(track.youtube_url);

  const embeds = [];

  if (track.soundcloud_url) {
    const embedUrl = soundcloudEmbedUrl(track.soundcloud_url);
    embeds.push(`
        <div class="track-embed track-embed--soundcloud">
          <iframe
            src="${escapeHtml(embedUrl)}"
            height="166"
            allow="autoplay"
            loading="lazy"
            title="${escapeHtml(track.title)} on SoundCloud"
          ></iframe>
        </div>`);
  }

  if (track.spotify_url) {
    const embedUrl = spotifyEmbedUrl(track.spotify_url);
    embeds.push(`
        <div class="track-embed track-embed--spotify">
          <iframe
            src="${escapeHtml(embedUrl)}"
            height="152"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            title="${escapeHtml(track.title)} on Spotify"
          ></iframe>
        </div>`);
  }

  if (vid) {
    embeds.push(`
        <div class="track-embed track-embed--youtube">
          <div class="youtube-wrapper">
            <iframe
              src="https://www.youtube.com/embed/${vid}"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
              loading="lazy"
              title="${escapeHtml(track.title)}"
            ></iframe>
          </div>
        </div>`);
  }

  if (track.audio_file) {
    embeds.push(`
        <div class="track-embed track-embed--audio">
          <audio controls preload="none">
            <source src="${escapeHtml(track.audio_file)}" type="audio/mpeg">
          </audio>
        </div>`);
  }

  const meta = [];
  if (track.artist) meta.push(`<span>${escapeHtml(track.artist)}</span>`);
  if (track.credit_role) meta.push(`<span>${escapeHtml(track.credit_role)}</span>`);
  if (track.release_type) meta.push(`<span>${escapeHtml(track.release_type)}</span>`);
  if (track.year) meta.push(`<span>${track.year}</span>`);

  const sectionTitle = site.navigation.sections.find((s) => s.id === track.section)?.title || '';

  return `
    <article class="project">
      <div class="container">
        <p class="project-breadcrumb"><a href="/">Music</a>${sectionTitle ? ` / <a href="/#${track.section}">${escapeHtml(sectionTitle)}</a>` : ''}</p>
        <header class="project-header">
          <h1>${escapeHtml(track.title)}</h1>
          ${meta.length ? `<p class="track-meta">${meta.join(' · ')}</p>` : ''}
        </header>
        ${embeds.join('\n')}
        ${body ? `<div class="project-body">${body}</div>` : ''}
      </div>
    </article>`;
}

function aboutPage(about) {
  const body = about.body ? marked.parse(about.body) : '';
  return `
    <main class="about">
      <div class="container">
        <article class="about-content about-content--single">
          <h1>${escapeHtml(about.title || 'About')}</h1>
          <div class="about-body">${body}</div>
        </article>
      </div>
    </main>`;
}

// ---------- file ops ----------

async function writePage(relativePath, html) {
  const file = path.join(DIST, relativePath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, html);
}

async function copyDir(src, destRelative) {
  const dest = path.join(DIST, destRelative);
  try {
    await fs.cp(src, dest, { recursive: true });
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

// ---------- build ----------

async function build() {
  console.log('Building dist/...');
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });

  const allSlugs = site.navigation.sections.flatMap((s) => s.tracks.map((t) => t.id));
  const tracks = await Promise.all(allSlugs.map(loadTrack));
  const tracksBySlug = new Map(tracks.map((t) => [t.slug, t]));

  // Homepage
  await writePage('index.html', layout({
    title: site.site.title,
    description: site.site.tagline,
    currentPath: '/',
    content: homePage(tracksBySlug),
  }));

  // Track pages
  for (const track of tracks) {
    await writePage(path.join('tracks', track.slug, 'index.html'), layout({
      title: track.title,
      description: track.body ? track.body.slice(0, 200) : track.title,
      currentPath: trackHref(track.slug),
      content: trackPage(track),
    }));
  }

  // About
  const about = await loadAbout();
  await writePage(path.join('about', 'index.html'), layout({
    title: about.title || 'About',
    description: site.site.meta.description,
    currentPath: '/about/',
    content: aboutPage(about),
  }));

  // Static copies
  await copyDir(path.join(ROOT, 'assets'), 'assets');
  await fs.writeFile(path.join(DIST, '.nojekyll'), '');
  try {
    await fs.copyFile(path.join(ROOT, 'CNAME'), path.join(DIST, 'CNAME'));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }

  console.log(`Done. ${tracks.length} track pages, about page, homepage.`);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
