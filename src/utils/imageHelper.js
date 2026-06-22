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
 * Formats relative database image path into a fully qualified URL.
 * @param {string} photoPath - Relative image path.
 * @returns {string} - Full URL.
 */
const getImageUrl = (photoPath) => {
  if (!photoPath) return '';
  if (photoPath.startsWith('http://') || photoPath.startsWith('https://') || photoPath.startsWith('data:image')) {
    return photoPath;
  }
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
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

module.exports = {
  saveBase64Image,
  getImageUrl,
  deleteImageFile
};
