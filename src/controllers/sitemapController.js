const Product = require('../models/Product');
const Subcategory = require('../models/Subcategory');

exports.getSitemap = async (req, res) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || 'https://p2jmart.com';
    
    // Fetch all subcategories and products
    const [subcategories, products] = await Promise.all([
      Subcategory.find().lean(),
      Product.find({ isActive: { $ne: false } }).populate('subcategory', 'slug').lean()
    ]);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // 1. Homepage
    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}/</loc>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>1.0</priority>\n`;
    xml += `  </url>\n`;

    // 2. Static pages
    const staticPages = [
      '/products',
      '/customized',
      '/contact',
      '/privacy-policy',
      '/terms',
      '/cancellation-return-policy',
      '/delivery-policy',
      '/returns-policy'
    ];
    for (const page of staticPages) {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${page}</loc>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.6</priority>\n`;
      xml += `  </url>\n`;
    }

    // 3. Subcategories
    for (const sub of subcategories) {
      if (sub.slug) {
        const lastMod = sub.updatedAt ? new Date(sub.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        xml += `  <url>\n`;
        xml += `    <loc>${baseUrl}/${sub.slug}</loc>\n`;
        xml += `    <lastmod>${lastMod}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.8</priority>\n`;
        xml += `  </url>\n`;
      }
    }

    // 4. Products
    for (const prod of products) {
      if (prod.slug) {
        const lastMod = prod.updatedAt ? new Date(prod.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        const subSlug = prod.subcategory?.slug || 'product';
        
        xml += `  <url>\n`;
        if (prod.customizeProduct === 'Yes') {
          xml += `    <loc>${baseUrl}/customizedProductDetail/${prod.slug}</loc>\n`;
        } else {
          xml += `    <loc>${baseUrl}/${subSlug}/${prod.slug}</loc>\n`;
        }
        xml += `    <lastmod>${lastMod}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.7</priority>\n`;
        xml += `  </url>\n`;
      }
    }

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.status(200).send(xml);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSitemapStyle = (req, res) => {
  const xsl = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" 
                xmlns:html="http://www.w3.org/TR/REC-html40"
                xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <title>XML Sitemap - P2J Mart</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <style type="text/css">
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px;
            color: #334155;
            background-color: #f8fafc;
            margin: 0;
            padding: 0;
          }
          a {
            color: #0284c7;
            text-decoration: none;
            font-weight: 500;
          }
          a:hover {
            text-decoration: underline;
          }
          .header {
            background-color: #b9d5e8;
            padding: 24px 40px;
            margin-bottom: 30px;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
            color: #1e3a5f;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px 40px;
          }
          .card {
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
            border: 1px solid #e2e8f0;
            overflow: hidden;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
          }
          th {
            background-color: #ffffff;
            color: #64748b;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 16px 24px;
            border-bottom: 2px solid #f1f5f9;
          }
          td {
            padding: 16px 24px;
            border-bottom: 1px solid #f1f5f9;
            vertical-align: middle;
          }
          tr:hover td {
            background-color: #f8fafc;
          }
          .badge-freq {
            display: inline-block;
            padding: 4px 12px;
            font-size: 12px;
            font-weight: 500;
            color: #64748b;
            background-color: #f1f5f9;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            text-transform: lowercase;
          }
          .badge-priority {
            display: inline-block;
            padding: 4px 12px;
            font-size: 12px;
            font-weight: 500;
            color: #0f172a;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            text-align: center;
            min-width: 32px;
          }
          .url-column {
            word-break: break-all;
          }
          .date-column {
            color: #64748b;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="max-width: 1200px; margin: 0 auto; padding: 0 20px;">
            <h1>XML Sitemap</h1>
          </div>
        </div>
        <div class="container">
          <div class="card">
            <table>
              <thead>
                <tr>
                  <th width="60%">Target URL</th>
                  <th width="15%">Change Freq</th>
                  <th width="10%">Priority</th>
                  <th width="15%">Last Modified</th>
                </tr>
              </thead>
              <tbody>
                <xsl:for-each select="sitemap:urlset/sitemap:url">
                  <tr>
                    <td class="url-column">
                      <a href="{sitemap:loc}">
                        <xsl:value-of select="sitemap:loc"/>
                      </a>
                    </td>
                    <td>
                      <span class="badge-freq">
                        <xsl:value-of select="sitemap:changefreq"/>
                      </span>
                    </td>
                    <td>
                      <span class="badge-priority">
                        <xsl:value-of select="sitemap:priority"/>
                      </span>
                    </td>
                    <td class="date-column">
                      <xsl:value-of select="sitemap:lastmod"/>
                    </td>
                  </tr>
                </xsl:for-each>
              </tbody>
            </table>
          </div>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>`;

  res.header('Content-Type', 'application/xml');
  res.status(200).send(xsl);
};
