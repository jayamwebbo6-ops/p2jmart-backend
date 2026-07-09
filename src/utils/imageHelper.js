const fs = require('fs');
const path = require('path');

/**
 * Save a base64 string image as a physical file on the server.
 * @param {string} base64Str - The base64 data string.
 * @param {string} subFolder - Folder within uploads directory (e.g. 'avathar', 'user').
 * @param {string} prefix - Filename prefix (e.g. 'avatar', 'user').
 * @returns {string} - Relative path to the saved file.
 */
const saveBase64Image = (base64Str, subFolder = 'avathar', prefix = 'avatar') => {
  if (!base64Str) return '';

  // If it's already a saved path/URL, don't overwrite it
  if (!base64Str.startsWith('data:image')) {
    // Strip base URL if present to store clean relative path
    const relativePart = base64Str.indexOf(`uploads/${subFolder}/`);
    if (relativePart !== -1) {
      return base64Str.substring(relativePart);
    }
    return base64Str;
  }

  const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return base64Str;
  }

  const ext = matches[1].split('/')[1] || 'png';
  const dataBuffer = Buffer.from(matches[2], 'base64');

  // Create folder if not exists
  const uploadDir = path.join(__dirname, `../../uploads/${subFolder}`);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filename = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1E9)}.${ext}`;
  const filepath = path.join(uploadDir, filename);

  fs.writeFileSync(filepath, dataBuffer);

  return `uploads/${subFolder}/${filename}`;
};

/**
 * Strips backend URL from an image path/URL and returns just the relative path.
 * If path is already relative, returns as-is. External URLs are returned unchanged.
 * @param {string} imagePath - Full URL or relative path.
 * @returns {string} - Relative path for storage in database.
 */
const getRelativeImagePath = (imagePath) => {
  if (!imagePath) return '';

  // If it's a data URI or external URL, return as-is
  if (imagePath.startsWith('data:image') || imagePath.startsWith('https://') || imagePath.startsWith('http://')) {
    // Try to extract relative path if it contains the uploads directory
    const uploadsIndex = imagePath.indexOf('uploads/');
    if (uploadsIndex !== -1) {
      return imagePath.substring(uploadsIndex);
    }
    // If it's an external URL, return as-is
    return imagePath;
  }

  // Already a relative path
  return imagePath;
};

/**
 * Formats relative database image path into a fully qualified URL.
 * @param {string} photoPath - Relative image path.
 * @returns {string} - Full URL.
 */
const getImageUrl = (photoPath) => {
  if (!photoPath) return '';
  if (photoPath.startsWith('http://') || photoPath.startsWith('https://') || photoPath.startsWith('data:image')) {
    return photoPath;
  }
  const baseUrl = process.env.BACKEND_URL;
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = photoPath.replace(/^\/+/, '');
  return `${cleanBase}/${cleanPath}`;
};

/**
 * Deletes a file from the uploads directory.
 * @param {string} relativePath - The relative path of the file to delete (e.g. 'uploads/user/filename.png').
 */
const deleteImageFile = (relativePath) => {
  if (!relativePath) return;
  try {
    const fullPath = path.join(__dirname, '../../', relativePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.error(`Failed to delete old image file: ${relativePath}`, err);
  }
};

/**
 * Resolves a product or cart item image path, checking if the file actually exists on disk.
 * If the file doesn't exist, it falls back to the first variant's image that does exist.
 * If no valid variant image exists, it falls back to a default placeholder URL.
 * @param {string} imagePath - Stored image path.
 * @param {Object} product - Product object/document containing variants.
 * @returns {string} - A valid relative image path or URL.
 */
const getValidProductImage = (imagePath, product = null) => {
  if (!imagePath) {
    if (product) {
      const fallback = getFirstValidVariantImage(product);
      if (fallback) return fallback;
    }
    return 'https://via.placeholder.com/500?text=No+Image+Available';
  }

  if (imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('data:image')) {
    return imagePath;
  }

  // Check if file exists on disk
  const fullPath = path.join(__dirname, '../../', imagePath);
  if (fs.existsSync(fullPath)) {
    return imagePath;
  }

  // File doesn't exist, try to find a variant image from product
  if (product) {
    const fallback = getFirstValidVariantImage(product);
    if (fallback) return fallback;
  }

  // If no fallback works, return a placeholder
  return 'https://via.placeholder.com/500?text=No+Image+Available';
};

const getFirstValidVariantImage = (product) => {
  if (!product || !product.variants || !Array.isArray(product.variants)) {
    return null;
  }
  for (const variant of product.variants) {
    // Check variant.image
    if (variant.image && typeof variant.image === 'string' && !variant.image.startsWith('data:image') && !variant.image.startsWith('http')) {
      const fullPath = path.join(__dirname, '../../', variant.image);
      if (fs.existsSync(fullPath)) {
        return variant.image;
      }
    }
    // Check variant.images
    if (variant.images && Array.isArray(variant.images)) {
      for (const img of variant.images) {
        if (img && typeof img === 'string' && !img.startsWith('data:image') && !img.startsWith('http')) {
          const fullPath = path.join(__dirname, '../../', img);
          if (fs.existsSync(fullPath)) {
            return img;
          }
        }
      }
    }
  }
  return null;
};

module.exports = {
  saveBase64Image,
  getImageUrl,
  getRelativeImagePath,
  deleteImageFile,
  getValidProductImage
};
