/**
 * Helper to generate clean, SEO-friendly slugs.
 * Rules followed:
 * - Use lowercase letters
 * - Separate words with hyphens (-)
 * - Remove special characters
 */
const slugify = (text) => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars except hyphens
    .replace(/\-\-+/g, '-')         // Rep lace multiple - with single -
    .replace(/^-+/, '')             // Trim -from start
    .replace(/-+$/, '');            // Trim - from end
};

module.exports = slugify;
