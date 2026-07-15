const Product = require('../models/Product');
const Subcategory = require('../models/Subcategory');

exports.getSitemap = async (req, res) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || 'https://www.p2jmart.com';
    
    // Fetch all subcategories and products
    const [subcategories, products] = await Promise.all([
      Subcategory.find().lean(),
      Product.find({ isActive: { $ne: false } }).populate('subcategory', 'slug').lean()
    ]);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
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
