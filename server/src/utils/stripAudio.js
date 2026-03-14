import { execFile } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, readFile, unlink } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';

/**
 * Strips audio from a video multer file object (in-memory buffer).
 * Returns a new file object with the muted video buffer.
 * If FFmpeg fails, returns the original file unchanged.
 */
export const stripAudio = async (file) => {
  if (!file || !file.mimetype?.startsWith('video/')) return file;

  const id = uuidv4();
  const ext = file.originalname?.match(/\.\w+$/)?.[0] || '.mp4';
  const inputPath = join(tmpdir(), `in-${id}${ext}`);
  const outputPath = join(tmpdir(), `out-${id}${ext}`);

  try {
    const inputBuffer = file.buffer || file.path
      ? file.buffer || await readFile(file.path)
      : null;

    if (!inputBuffer) return file;

    await writeFile(inputPath, inputBuffer);

    await new Promise((resolve, reject) => {
      execFile(
        ffmpegPath.path,
        ['-i', inputPath, '-an', '-c:v', 'copy', '-y', outputPath],
        { timeout: 30000 },
        (error, _stdout, stderr) => {
          if (error) {
            console.error('FFmpeg strip audio error:', stderr || error.message);
            reject(error);
          } else {
            resolve();
          }
        },
      );
    });

    const strippedBuffer = await readFile(outputPath);

    return {
      ...file,
      buffer: strippedBuffer,
      size: strippedBuffer.length,
    };
  } catch (error) {
    console.warn('Strip audio failed, using original file:', error.message);
    return file;
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
};
