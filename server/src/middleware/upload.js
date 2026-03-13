import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/index.js';
import fs from 'fs';
import { isR2Active } from '../utils/storage.js';

const useR2 = isR2Active('manager');
let uploadDir = null;
if (!useR2) {
  // Ensure upload directory exists
  uploadDir = path.join(process.cwd(), config.upload.path);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}

// Configure storage
const storage = useR2
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
      },
    });

// File filter for images and short videos
const mediaFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP images, or MP4/WebM/MOV videos are allowed'), false);
  }
};

// Create multer upload instance
export const upload = multer({
  storage,
  fileFilter: mediaFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
});

// Error handler for multer
const formatMaxFileSize = (bytes) => {
  if (!bytes) return 'unknown';
  const mb = bytes / (1024 * 1024);
  return `${mb % 1 === 0 ? mb.toFixed(0) : mb.toFixed(1)}MB`;
};

export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer error during file upload:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: `File too large. Maximum size is ${formatMaxFileSize(config.upload.maxFileSize)}.`,
      });
    }
    return res.status(400).json({ message: err.message });
  }
  
  if (err) {
    console.error('Upload error:', err);
    return res.status(400).json({ message: err.message });
  }
  
  next();
};
