const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');

const rootDir = join(__dirname, '..');
const docsDir = join(rootDir, 'docs');
const contentPath = join(docsDir, 'site-content.json');
const i18nPath = join(rootDir, 'src', 'i18n', 'index.ts');
const logoPath = join(rootDir, 'src', 'assets', 'logo.svg');
const checkOnly = process.argv.includes('--check');

const content = JSON.parse(readFileSync(contentPath, 'utf8'));
const siteLocales = Object.keys(content.locales);
const appLocales = readAppLocales();

assertSameLocales(siteLocales, appLocales);

const site = content.site;
const defaultLocale = site.defaultLocale;

if (!siteLocales.includes(defaultLocale)) {
  throw new Error(`Default locale "${defaultLocale}" is not present in docs/site-content.json.`);
}

const generatedFiles = new Map();
const logoSvg = readFileSync(logoPath, 'utf8');

generatedFiles.set(join(docsDir, 'index.html'), renderRootPage());
generatedFiles.set(join(docsDir, 'logo.svg'), logoSvg);

for (const locale of siteLocales) {
  generatedFiles.set(join(docsDir, locale, 'index.html'), renderLocalePage(locale));
}

const changed = [];

for (const [filePath, html] of generatedFiles.entries()) {
  let current = '';

  try {
    current = readFileSync(filePath, 'utf8');
  } catch {
    current = '';
  }

  if (current !== html) {
    changed.push(filePath);
  }

  if (!checkOnly) {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, html, 'utf8');
  }
}

if (checkOnly && changed.length > 0) {
  console.error('Generated GitHub Pages files are not up to date:');
  for (const filePath of changed) {
    console.error(`- ${filePath}`);
  }
  console.error('Run: npm run build:pages');
  process.exit(1);
}

if (!checkOnly) {
  console.log(`Generated ${generatedFiles.size} GitHub Pages files.`);
}

function readAppLocales() {
  const source = readFileSync(i18nPath, 'utf8');
  const match = source.match(/SUPPORTED_LOCALES:\s*AppLocale\[\]\s*=\s*\[([^\]]+)\]/m);

  if (!match) {
    throw new Error('Could not find SUPPORTED_LOCALES in src/i18n/index.ts.');
  }

  return [...match[1].matchAll(/'([^']+)'/g)].map((locale) => locale[1]);
}

function assertSameLocales(docsLocales, locales) {
  const docsSorted = [...docsLocales].sort();
  const appSorted = [...locales].sort();

  if (docsSorted.join(',') !== appSorted.join(',')) {
    throw new Error(
      `Docs locales (${docsSorted.join(', ')}) do not match app locales (${appSorted.join(', ')}).`,
    );
  }
}

function renderRootPage() {
  const localeLinks = siteLocales
    .map((locale) => {
      const page = content.locales[locale];
      return `<a href="./${locale}/" lang="${locale}" hreflang="${locale}">${escapeHtml(page.languageName)}</a>`;
    })
    .join('\n        ');

  const alternates = renderAlternateLinks('./');
  const defaultPage = content.locales[defaultLocale];

  return `<!doctype html>
<html lang="${defaultLocale}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(defaultPage.pageTitle)}</title>
    <meta name="description" content="${escapeHtml(defaultPage.metaDescription)}">
    <link rel="icon" href="./logo.svg" type="image/svg+xml">
    <link rel="stylesheet" href="./styles.css">
${indent(alternates, 4)}
    <script>
      (function () {
        var supported = ${JSON.stringify(siteLocales)};
        var preferred = (navigator.languages || [navigator.language || '${defaultLocale}'])
          .map(function (language) { return String(language).slice(0, 2).toLowerCase(); })
          .find(function (language) { return supported.indexOf(language) !== -1; }) || '${defaultLocale}';
        window.location.replace('./' + preferred + '/');
      }());
    </script>
  </head>
  <body>
    <main class="locale_gate" aria-labelledby="language-title">
      <a class="brand" href="./${defaultLocale}/" aria-label="${escapeHtml(site.name)}">
        <span class="brand_mark" aria-hidden="true"><img src="./logo.svg" alt=""></span>
        <span>${escapeHtml(site.name)}</span>
      </a>
      <section>
        <p class="eyebrow">${escapeHtml(defaultPage.languageLabel)}</p>
        <h1 id="language-title">${escapeHtml(site.name)}</h1>
        <div class="language_grid">
        ${localeLinks}
        </div>
      </section>
    </main>
  </body>
</html>
`;
}

function renderLocalePage(locale) {
  const page = content.locales[locale];
  const alternates = renderAlternateLinks('../');
  const languageOptions = renderLanguageSelector(locale);
  const summary = page.summary.map((item) => `
            <div>
              <dt>${escapeHtml(item.term)}</dt>
              <dd>${escapeHtml(item.detail)}</dd>
            </div>`).join('');
  const features = page.features.map((feature) => `
          <article class="card">
            <h3>${escapeHtml(feature.title)}</h3>
            <p>${escapeHtml(feature.body)}</p>
          </article>`).join('');
  const createSteps = renderSteps(page.createGuideSteps);
  const editSteps = renderSteps(page.editGuideSteps);
  const formats = page.formats.map((format) => `<span>${escapeHtml(format)}</span>`).join('\n          ');

  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(page.pageTitle)}</title>
    <meta name="description" content="${escapeHtml(page.metaDescription)}">
    <link rel="canonical" href="${escapeHtml(site.basePath)}${locale}/">
    <link rel="icon" href="../logo.svg" type="image/svg+xml">
    <link rel="stylesheet" href="../styles.css">
${indent(alternates, 4)}
  </head>
  <body>
    <header class="site_header">
      <nav class="site_nav" aria-label="${escapeHtml(page.navLabel)}">
        <a class="brand" href="#top" aria-label="${escapeHtml(site.name)}">
          <span class="brand_mark" aria-hidden="true"><img src="../logo.svg" alt=""></span>
          <span>${escapeHtml(site.name)}</span>
        </a>
        <div class="nav_cluster">
          <div class="nav_links">
            <a href="#features">${escapeHtml(page.featuresNav)}</a>
            <a href="#guides">${escapeHtml(page.guidesNav)}</a>
            <a href="#formats">${escapeHtml(page.formatsNav)}</a>
            <a href="${escapeHtml(site.repositoryUrl)}">${escapeHtml(page.githubNav)}</a>
          </div>
          <nav class="language_switcher" aria-label="${escapeHtml(page.languageLabel)}">
${indent(languageOptions, 12)}
          </nav>
        </div>
      </nav>

      <section id="top" class="hero">
        <div class="hero_copy">
          <p class="eyebrow">${escapeHtml(page.heroKicker)}</p>
          <h1>${escapeHtml(page.heroTitle)}</h1>
          <p class="lead">
            ${escapeHtml(page.heroLead)}
          </p>
          <div class="hero_actions">
            <a class="button button_primary" href="${escapeHtml(site.repositoryUrl)}">${escapeHtml(page.repoButton)}</a>
            <a class="button" href="#guides">${escapeHtml(page.guidesButton)}</a>
          </div>
        </div>
        <aside class="hero_panel" aria-label="${escapeHtml(page.summaryLabel)}">
          <dl>${summary}
          </dl>
        </aside>
      </section>
    </header>

    <main>
      <section id="features" class="section">
        <div class="section_header">
          <p class="eyebrow">${escapeHtml(page.featuresKicker)}</p>
          <h2>${escapeHtml(page.featuresTitle)}</h2>
        </div>
        <div class="card_grid">${features}
        </div>
      </section>

      <section id="guides" class="section section_tinted">
        <div class="section_header">
          <p class="eyebrow">${escapeHtml(page.guidesKicker)}</p>
          <h2>${escapeHtml(page.guidesTitle)}</h2>
        </div>
        <div class="guide_layout">
          <article class="guide">
            <h3>${escapeHtml(page.createGuideTitle)}</h3>
            <ol>
${indent(createSteps, 14)}
            </ol>
          </article>
          <article class="guide">
            <h3>${escapeHtml(page.editGuideTitle)}</h3>
            <ol>
${indent(editSteps, 14)}
            </ol>
          </article>
        </div>
      </section>

      <section id="formats" class="section">
        <div class="section_header">
          <p class="eyebrow">${escapeHtml(page.formatsKicker)}</p>
          <h2>${escapeHtml(page.formatsTitle)}</h2>
        </div>
        <div class="format_list" aria-label="${escapeHtml(page.formatsLabel)}">
          ${formats}
        </div>
        <p class="note">
          ${escapeHtml(page.formatsNote)}
        </p>
      </section>

      <section class="section section_split">
        <div>
          <p class="eyebrow">${escapeHtml(page.privacyKicker)}</p>
          <h2>${escapeHtml(page.privacyTitle)}</h2>
          <p>
            ${escapeHtml(page.privacyBody)}
          </p>
        </div>
        <div class="callout">
          <h3>${escapeHtml(page.smartScreenTitle)}</h3>
          <p>
            ${escapeHtml(page.smartScreenBody)}
          </p>
        </div>
      </section>
    </main>

    <footer class="site_footer">
      <span>${escapeHtml(site.name)}</span>
      <a href="${escapeHtml(site.repositoryUrl)}">${escapeHtml(page.footerRepo)}</a>
    </footer>
  </body>
</html>
`;
}

function renderLanguageSelector(activeLocale) {
  return siteLocales.map((locale) => {
    const page = content.locales[locale];
    const className = locale === activeLocale ? ' class="active"' : '';
    const ariaCurrent = locale === activeLocale ? ' aria-current="page"' : '';

    return `<a${className}${ariaCurrent} href="../${locale}/" lang="${locale}" hreflang="${locale}" title="${escapeHtml(page.languageName)}">${escapeHtml(page.shortName)}</a>`;
  }).join('\n');
}

function renderAlternateLinks(prefix) {
  const links = siteLocales.map((locale) => {
    return `<link rel="alternate" hreflang="${locale}" href="${prefix}${locale}/">`;
  });

  links.push(`<link rel="alternate" hreflang="x-default" href="${prefix}${defaultLocale}/">`);

  return links.join('\n');
}

function renderSteps(steps) {
  return steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('\n');
}

function indent(value, spaces) {
  const padding = ' '.repeat(spaces);
  return value.split('\n').map((line) => `${padding}${line}`).join('\n');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
