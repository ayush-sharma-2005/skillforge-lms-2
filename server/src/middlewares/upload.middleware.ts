import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import type { Request } from "express";

// Upload directory
const uploadDir = path.resolve(process.cwd(), "uploads", "resources");

// Create directory if it does not exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Allowed file types
const allowedMimeTypes = [
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/x-7z-compressed",
];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },

  filename: (_req, file, cb) => {
    const uniqueName = `${crypto.randomUUID()}${path.extname(
      file.originalname
    ).toLowerCase()}`;

    cb(null, uniqueName);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(
      new Error("Invalid file type. Only PDF, ZIP, DOC, DOCX, PPT, PPTX, TXT, CSV and 7Z are allowed.")
    );
  }

  cb(null, true);
};

export const uploadResource = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB
    files: 1,
  },
});