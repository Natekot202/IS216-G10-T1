import multer from 'multer'

const upload = multer({
  storage: multer.memoryStorage(),                
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
    cb(ok ? null : new Error('Please upload a JPG, PNG or WebP image.'), ok)
  }
})

export function uploadPhoto(req, res, next) {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be under 2 MB.' : err.message
      return res.status(400).json({ message })
    }
    next()
  })
}