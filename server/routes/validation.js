import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse';
import { createReadStream, unlinkSync } from 'fs';
import { validateEmail } from '../validators/email.js';

const router = express.Router();
const BATCH_SIZE = 5; // Reduced batch size to prevent detection
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;
const BATCH_DELAY = 2000; // Delay between batches

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.(csv)$/)) {
      return cb(new Error('Only CSV files are allowed'));
    }
    cb(null, true);
  }
});

async function validateEmailWithRetry(email, retryCount = 0) {
  try {
    return await validateEmail(email);
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
      return validateEmailWithRetry(email, retryCount + 1);
    }
    throw error;
  }
}

router.post('/validate', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        valid: false,
        reason: 'Email is required'
      });
    }

    const result = await validateEmailWithRetry(email);
    res.json(result);
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      valid: false,
      reason: 'Validation service error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.post('/validate/batch', async (req, res) => {
  try {
    const { emails } = req.body;
    
    if (!emails || !Array.isArray(emails)) {
      return res.status(400).json({
        error: 'Invalid request format. Expected array of emails.'
      });
    }

    const results = [];
    const batchSize = BATCH_SIZE;
    
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchPromises = batch.map(email => validateEmailWithRetry(email));
      
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults.map(result => 
          result.status === 'fulfilled' ? result.value : {
            valid: false,
            reason: result.reason?.message || 'Validation failed',
            checks: {
              format: false,
              dns: false,
              mx: false,
              spf: false,
              smtp: false,
              mailbox: false
            }
          }
        ));

        // Add delay between batches
        if (i + batchSize < emails.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      } catch (error) {
        console.error(`Batch error at index ${i}:`, error);
        results.push(...batch.map(() => ({
          valid: false,
          reason: 'Batch processing error',
          checks: {
            format: false,
            dns: false,
            mx: false,
            spf: false,
            smtp: false,
            mailbox: false
          }
        })));
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Batch validation error:', error);
    res.status(500).json({
      error: 'Failed to validate batch',
      details: error.message
    });
  }
});

router.post('/validate/bulk', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'CSV file is required' });
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Transfer-Encoding', 'chunked');

  const results = [];
  let processed = 0;
  let total = 0;

  try {
    // First pass: count total rows
    await new Promise((resolve, reject) => {
      createReadStream(req.file.path)
        .pipe(parse({ columns: true }))
        .on('data', () => { total++; })
        .on('error', reject)
        .on('end', resolve);
    });

    const parser = createReadStream(req.file.path).pipe(parse({ columns: true }));
    let batch = [];

    for await (const record of parser) {
      const email = record.email || record.Email || record.EMAIL;
      
      if (email) {
        batch.push(email);
        
        if (batch.length === BATCH_SIZE || processed + batch.length === total) {
          try {
            const batchResults = await Promise.all(
              batch.map(email => validateEmailWithRetry(email))
            );
            
            results.push(...batchResults);
            processed += batch.length;
            
            res.write(JSON.stringify({
              type: 'progress',
              progress: (processed / total) * 100,
              results: batchResults
            }) + '\n');
            
            // Add significant delay between batches
            if (processed < total) {
              await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
            }
          } catch (error) {
            console.error('Batch processing error:', error);
            const errorResults = batch.map(() => ({
              valid: false,
              reason: 'Batch processing error',
              checks: {
                format: false,
                dns: false,
                mx: false,
                spf: false,
                smtp: false,
                mailbox: false
              }
            }));
            results.push(...errorResults);
            processed += batch.length;
            
            res.write(JSON.stringify({
              type: 'progress',
              progress: (processed / total) * 100,
              results: errorResults
            }) + '\n');
          }
          
          batch = [];
        }
      }
    }

    res.write(JSON.stringify({
      type: 'complete',
      results
    }) + '\n');
    
    res.end();
  } catch (error) {
    console.error('Bulk validation error:', error);
    if (!res.headersSent) {
      res.status(500);
    }
    res.write(JSON.stringify({
      type: 'error',
      error: 'Failed to process CSV file'
    }) + '\n');
    res.end();
  } finally {
    try {
      unlinkSync(req.file.path);
    } catch (error) {
      console.error('Failed to cleanup file:', error);
    }
  }
});

export default router;