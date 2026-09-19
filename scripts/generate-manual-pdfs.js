const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { marked } = require('marked');

// Configure marked
marked.setOptions({
  gfm: true,
  breaks: false
});

const manualesDir = path.join(__dirname, '..', 'docs', 'manuales');
const outputPdfDir = path.join(manualesDir, 'pdf');

if (!fs.existsSync(outputPdfDir)) {
  fs.mkdirSync(outputPdfDir, { recursive: true });
}

// Map of alerts
const alertMeta = {
  NOTE: { title: 'Nota Informativa', icon: 'ℹ️', class: 'alert-note' },
  TIP: { title: 'Consejo Práctico / Recomendación de Oro', icon: '💡', class: 'alert-tip' },
  IMPORTANT: { title: 'Requisito Fundamental / Importante', icon: '📌', class: 'alert-important' },
  WARNING: { title: 'Atención / Advertencia Operativa', icon: '⚠️', class: 'alert-warning' },
  CAUTION: { title: 'Precaución Crítica / Riesgo de Infracción', icon: '🛑', class: 'alert-caution' }
};

function preprocessMarkdown(mdContent, sourceFilePath) {
  let content = mdContent;

  // 1. Process GitHub Callout Alerts: > [!TIP] ...
  const alertRegex = /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*\r?\n((?:^>.*(?:\r?\n|$))*)/gim;
  content = content.replace(alertRegex, (match, type, body) => {
    const meta = alertMeta[type.toUpperCase()] || alertMeta.NOTE;
    const cleanLines = body
      .split(/\r?\n/)
      .map(line => line.replace(/^>\s?/, ''))
      .filter(line => line.trim().length > 0)
      .join('\n\n');
    const parsedBody = marked.parse(cleanLines);
    return `\n<div class="custom-alert ${meta.class}"><div class="alert-header"><span class="alert-icon">${meta.icon}</span><span class="alert-title">${meta.title}</span></div><div class="alert-content">${parsedBody}</div></div>\n`;
  });

  // 2. Process Mermaid Diagrams
  const mermaidRegex = /```mermaid\s*([\s\S]*?)\s*```/g;
  content = content.replace(mermaidRegex, (match, code) => {
    const sanitized = code.trim();
    return `\n<div class="mermaid-box"><div class="mermaid-badge">Diagrama de Flujo del Proceso</div><pre class="mermaid">\n${sanitized}\n</pre></div>\n`;
  });

  // 3. Process Images into inline base64 to avoid broken links
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  content = content.replace(imageRegex, (match, alt, imgPath) => {
    let resolvedPath = path.resolve(path.dirname(sourceFilePath), imgPath);
    if (fs.existsSync(resolvedPath)) {
      const ext = path.extname(resolvedPath).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
      const base64 = fs.readFileSync(resolvedPath).toString('base64');
      const dataUri = `data:${mime};base64,${base64}`;
      return `\n<figure class="doc-figure"><img src="${dataUri}" alt="${alt}" /><figcaption><strong>Captura de Pantalla:</strong> ${alt}</figcaption></figure>\n`;
    }
    return match;
  });

  return content;
}

function buildHtmlDocument(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    @page {
      size: A4 portrait;
      margin: 22mm 16mm 22mm 16mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.55;
      color: #1e293b;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
    }

    /* Top Brand Banner */
    .brand-header {
      border-bottom: 2px solid #d97706;
      padding-bottom: 12px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand-title {
      font-size: 15pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .brand-title span {
      color: #d97706;
    }
    .brand-meta {
      font-size: 8pt;
      color: #64748b;
      text-align: right;
      line-height: 1.3;
    }
    .brand-badge {
      display: inline-block;
      background: #fef3c7;
      color: #92400e;
      font-weight: 700;
      font-size: 7.5pt;
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid #fde68a;
      margin-top: 3px;
    }

    /* Headings */
    h1 {
      font-size: 19pt;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.25;
      margin-top: 0;
      margin-bottom: 14px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
      page-break-after: avoid;
      break-after: avoid;
    }

    h2 {
      font-size: 13.5pt;
      font-weight: 700;
      color: #0f172a;
      margin-top: 22px;
      margin-bottom: 10px;
      padding-left: 10px;
      border-left: 4px solid #d97706;
      page-break-after: avoid;
      break-after: avoid;
    }

    h3 {
      font-size: 11pt;
      font-weight: 600;
      color: #334155;
      margin-top: 16px;
      margin-bottom: 8px;
      page-break-after: avoid;
      break-after: avoid;
    }

    p {
      margin-top: 0;
      margin-bottom: 10px;
      text-align: justify;
    }

    strong {
      color: #0f172a;
    }

    hr {
      border: 0;
      height: 1px;
      background: #e2e8f0;
      margin: 18px 0;
    }

    /* Lists */
    ul, ol {
      margin-top: 0;
      margin-bottom: 12px;
      padding-left: 22px;
    }
    li {
      margin-bottom: 5px;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 8.5pt;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 7px 10px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background-color: #0f172a;
      color: #ffffff;
      font-weight: 600;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    /* Custom Callouts / Alerts */
    .custom-alert {
      border-radius: 8px;
      margin: 16px 0;
      padding: 12px 14px;
      border-left: 5px solid;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .alert-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
      font-size: 9.5pt;
      margin-bottom: 6px;
    }
    .alert-content p {
      margin-bottom: 6px;
      font-size: 9pt;
      text-align: left;
    }
    .alert-content p:last-child {
      margin-bottom: 0;
    }

    .alert-note {
      background-color: #f0f9ff;
      border-color: #0284c7;
      color: #0c4a6e;
    }
    .alert-tip {
      background-color: #f0fdf4;
      border-color: #16a34a;
      color: #14532d;
    }
    .alert-important {
      background-color: #faf5ff;
      border-color: #9333ea;
      color: #581c87;
    }
    .alert-warning {
      background-color: #fffbeb;
      border-color: #d97706;
      color: #78350f;
    }
    .alert-caution {
      background-color: #fef2f2;
      border-color: #dc2626;
      color: #7f1d1d;
    }

    /* Figures and Screenshots */
    .doc-figure {
      margin: 18px 0;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .doc-figure img {
      max-width: 92%;
      max-height: 420px;
      height: auto;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      box-shadow: 0 3px 6px rgba(0,0,0,0.06);
    }
    .doc-figure figcaption {
      font-size: 8pt;
      color: #64748b;
      margin-top: 6px;
      font-style: italic;
    }

    /* Mermaid Diagrams */
    .mermaid-box {
      margin: 18px 0;
      padding: 16px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
      position: relative;
    }
    .mermaid-badge {
      display: inline-block;
      font-size: 7.5pt;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
      background: #e2e8f0;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .mermaid svg {
      max-width: 100% !important;
      height: auto !important;
      margin: 0 auto;
    }

    /* Code blocks */
    code {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 8.5pt;
      background: #f1f5f9;
      color: #0f172a;
      padding: 2px 5px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }
    pre {
      background: #0f172a;
      color: #f8fafc;
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 8pt;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    pre code {
      background: transparent;
      color: inherit;
      border: none;
      padding: 0;
    }
  </style>
</head>
<body>
  <div class="brand-header">
    <div class="brand-title">
      🐝 Api<span>Trace</span>
    </div>
    <div class="brand-meta">
      <div><strong>Sistema Integral de Trazabilidad Apícola</strong></div>
      <div>SENASA • ARCA / AFIP • República Argentina</div>
      <div class="brand-badge">DOCUMENTO OFICIAL DE USUARIO • VERSIÓN 2026</div>
    </div>
  </div>
  ${bodyHtml}
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'neutral',
      securityLevel: 'loose',
      fontFamily: '-apple-system, Segoe UI, sans-serif'
    });
  </script>
</body>
</html>`;
}

async function renderPdf(browser, htmlContent, outputPath) {
  const page = await browser.newPage();
  
  // Set content with networkidle0 so mermaid CDN loads
  await page.setContent(htmlContent, {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  // Check if there are mermaid diagrams and wait for them to render SVGs
  const hasMermaid = await page.evaluate(() => document.querySelectorAll('.mermaid').length > 0);
  if (hasMermaid) {
    try {
      await page.waitForSelector('.mermaid svg', { timeout: 12000 });
      // Small buffer for SVG sizing calculation
      await new Promise(res => setTimeout(res, 600));
    } catch (e) {
      console.warn('Timeout waiting for mermaid SVGs on page, continuing...');
    }
  }

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    margin: {
      top: '22mm',
      bottom: '22mm',
      left: '16mm',
      right: '16mm'
    },
    headerTemplate: `
      <div style="font-size: 7pt; font-family: -apple-system, Segoe UI, sans-serif; color: #94a3b8; width: 100%; display: flex; justify-content: space-between; padding: 0 16mm; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
        <span><strong>APITRACE</strong> &bull; MANUAL DE USUARIO OFICIAL</span>
        <span>NORMATIVA SENASA / ARCA</span>
      </div>
    `,
    footerTemplate: `
      <div style="font-size: 7.5pt; font-family: -apple-system, Segoe UI, sans-serif; color: #94a3b8; width: 100%; display: flex; justify-content: space-between; padding: 0 16mm; border-top: 1px solid #e2e8f0; padding-top: 4px;">
        <span>Trazabilidad Apícola Confiable de Origen a Destino</span>
        <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
      </div>
    `
  });

  await page.close();
}

async function main() {
  console.log('=== Generador de Manuales PDF de ApiTrace ===');
  console.log('Buscando archivos markdown en:', manualesDir);

  const files = fs.readdirSync(manualesDir).filter(f => f.endsWith('.md')).sort();
  console.log(`Encontrados ${files.length} manuales.`);

  console.log('Iniciando navegador Chromium en modo headless...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  for (const file of files) {
    const filePath = path.join(manualesDir, file);
    const pdfFileName = file.replace(/\.md$/, '.pdf');
    const outputPdfPath = path.join(outputPdfDir, pdfFileName);

    console.log(`\nProcesando: ${file} -> pdf/${pdfFileName}...`);
    const rawMd = fs.readFileSync(filePath, 'utf8');
    
    // Preprocess
    const preprocessed = preprocessMarkdown(rawMd, filePath);
    const htmlBody = marked.parse(preprocessed);

    // Extract title
    const firstH1 = rawMd.match(/^#\s+(.+)$/m);
    const title = firstH1 ? firstH1[1] : 'Manual de Usuario ApiTrace';

    const fullHtml = buildHtmlDocument(title, htmlBody);

    try {
      await renderPdf(browser, fullHtml, outputPdfPath);
      const stats = fs.statSync(outputPdfPath);
      console.log(`✓ Generado exitosamente: ${pdfFileName} (${Math.round(stats.size / 1024)} KB)`);
    } catch (err) {
      console.error(`✗ Error generando ${pdfFileName}:`, err.message);
    }
  }

  // Bonus: Generar un manual consolidado maestro (ApiTrace-Manual-Completo.pdf)
  console.log('\n--- Generando Manual Maestro Consolidado (ApiTrace-Manual-Completo.pdf) ---');
  try {
    const orderedFiles = [
      'README.md',
      '00-introduccion-y-conceptos-basicos.md',
      '01-manual-productor.md',
      '02-manual-sala-extraccion.md',
      '03-manual-acopiador-fraccionador.md',
      '04-manual-transportista.md',
      '05-manual-auditor-laboratorio.md',
      '06-manual-administrador.md'
    ];

    let consolidatedHtmlBodies = [];
    for (const file of orderedFiles) {
      const filePath = path.join(manualesDir, file);
      if (fs.existsSync(filePath)) {
        const rawMd = fs.readFileSync(filePath, 'utf8');
        const preprocessed = preprocessMarkdown(rawMd, filePath);
        const html = marked.parse(preprocessed);
        consolidatedHtmlBodies.push(`<div class="manual-section" style="page-break-before: always; break-before: always;">${html}</div>`);
      }
    }

    const masterHtml = buildHtmlDocument(
      'ApiTrace - Manual Completo de Usuario',
      consolidatedHtmlBodies.join('\n\n')
    );

    const masterPdfPath = path.join(outputPdfDir, 'ApiTrace-Manual-Completo.pdf');
    await renderPdf(browser, masterHtml, masterPdfPath);
    const masterStats = fs.statSync(masterPdfPath);
    console.log(`✓ Manual Maestro Completo generado: ApiTrace-Manual-Completo.pdf (${Math.round(masterStats.size / 1024)} KB)`);
  } catch (err) {
    console.error('Error generando manual consolidado:', err.message);
  }

  await browser.close();
  console.log('\n¡Todos los PDFs han sido generados con éxito en docs/manuales/pdf/!');
}

main().catch(err => {
  console.error('Error fatal en ejecución:', err);
  process.exit(1);
});
