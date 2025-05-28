const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Add a random string to ensure unique filenames
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const uniqueFilename = `${uniqueSuffix}${path.extname(file.originalname)}`;
    console.log(`Saving file as: ${uniqueFilename}`);
    cb(null, uniqueFilename);
  },
});

const upload = multer({
  storage: storage,
  // No file size limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Images only (jpeg, jpg, png)!'));
    }
  },
});

module.exports = upload;