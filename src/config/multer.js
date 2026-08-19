const multer = require('multer');
const path = require('path');

// Configuration du stockage temporaire des fichiers uploadés
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    // Nom unique du fichier avec horodatage
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `csv-import-${uniqueSuffix}${ext}`);
  }
});

// Filtre pour n'accepter que les fichiers CSV
const fileFilter = (req, file, cb) => {
  const isCsvMime = file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel' || file.mimetype === 'text/plain';
  const isCsvExtension = path.extname(file.originalname).toLowerCase() === '.csv';

  if (isCsvMime || isCsvExtension) {
    cb(null, true);
  } else {
    cb(new Error('Seuls les fichiers avec l\'extension .csv sont autorisés !'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // Limite de 10 MB par fichier
  }
});

module.exports = upload;
