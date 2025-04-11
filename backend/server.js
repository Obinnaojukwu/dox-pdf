require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const libre = require('libreoffice-convert'); // Import libreoffice-convert

const app = express();
app.use(cors());

// Serve static frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve converted PDFs
app.use('/converted', express.static(path.join(__dirname, 'converted')));

// Handle uploads
const upload = multer({
  dest: 'backend/uploads/',
  fileFilter: (req, file, cb) => {
    // Validate file type (only .docx allowed)
    if (path.extname(file.originalname).toLowerCase() !== '.docx') {
      return cb(new Error('Only .docx files are allowed!'));
    }
    cb(null, true);
  },
});

app.post('/convert', upload.single('docxFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded or invalid file type.');
  }

  const inputPath = req.file.path;


  const originalFileName = path.basename(req.file.originalname, path.extname(req.file.originalname));
  const outputFileName = `${originalFileName}.pdf`;
  const outputPath = path.join(__dirname, 'converted', outputFileName);

  try {
   
    const fileBuffer = await fs.promises.readFile(inputPath);

    // Convert the file to PDF
    const convertedBuffer = await new Promise((resolve, reject) => {
      libre.convert(fileBuffer, '.pdf', undefined, (err, done) => {
        if (err) return reject(err);
        resolve(done);
      });
    });

    // Write the converted file asynchronously
    await fs.promises.writeFile(outputPath, convertedBuffer);

    // Return the download URL
    res.json({ downloadUrl: `/converted/${outputFileName}` });

    // Schedule cleanup
    setTimeout(async () => {
      try {
        await fs.promises.unlink(inputPath);
        await fs.promises.unlink(outputPath);
      } catch (err) {
        console.error('Error during cleanup:', err);
      }
    }, 5 * 60 * 1000); // Clean up after 5 minutes
  } catch (err) {
    console.error('Error during conversion:', err);
    res.status(500).send('Conversion failed.');
  }
});

// Fallback to frontend index.html for unknown routes (optional)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));