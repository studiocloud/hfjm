import { supabase, ensureUserBucket } from './supabase';
import { ValidationResult } from '../types/validation';

const BATCH_SIZE = 50; // Reduced batch size for better reliability
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function uploadAndProcessCSV(file: File): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    await ensureUserBucket(user.id);

    const timestamp = new Date().getTime();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${user.id}/processing/${timestamp}_${sanitizedFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('csv-uploads')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;
    return filePath;
  } catch (error) {
    console.error('Upload error:', error);
    throw new Error('Failed to upload file');
  }
}

export async function downloadProcessedCSV(filePath: string): Promise<Blob> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    if (!filePath.startsWith(`${user.id}/`)) {
      throw new Error('Unauthorized access to file');
    }

    const { data, error } = await supabase.storage
      .from('csv-uploads')
      .download(filePath);

    if (error) throw error;
    if (!data) throw new Error('No data found');

    return data;
  } catch (error) {
    console.error('Download error:', error);
    throw new Error('Failed to download file');
  }
}

interface CSVData {
  headers: string[];
  rows: string[][];
  emailIndex: number;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let inQuotes = false;
  let currentValue = '';
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        currentValue += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(currentValue);
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  
  result.push(currentValue);
  
  return result.map(value => value.trim());
}

async function parseCSV(file: Blob): Promise<CSVData> {
  const text = await file.text();
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  const headers = parseCSVLine(lines[0]);
  const emailIndex = headers.findIndex(h => 
    h.toLowerCase().includes('email') || 
    h.toLowerCase() === 'address' || 
    h.toLowerCase() === 'mail'
  );

  if (emailIndex === -1) {
    throw new Error('No email column found in CSV');
  }

  const rows = lines.slice(1).map(parseCSVLine);

  return { headers, rows, emailIndex };
}

async function validateEmailBatch(emails: string[], retryCount = 0): Promise<ValidationResult[]> {
  try {
    const response = await fetch('/api/validate/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emails }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      await sleep(RETRY_DELAY * (retryCount + 1));
      return validateEmailBatch(emails, retryCount + 1);
    }
    throw error;
  }
}

function escapeCSVValue(value: string | boolean): string {
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

async function updateValidatedFile(
  filePath: string,
  headers: string[],
  validationHeaders: string[],
  allRows: string[][]
): Promise<void> {
  const csvContent = [
    [...headers, ...validationHeaders].map(escapeCSVValue).join(','),
    ...allRows.map(row => row.map(escapeCSVValue).join(','))
  ].join('\n');

  const validatedPath = filePath.replace('/processing/', '/validated/');

  const { error: uploadError } = await supabase.storage
    .from('csv-uploads')
    .upload(validatedPath, new Blob([csvContent], { type: 'text/csv' }), {
      upsert: true
    });

  if (uploadError) throw uploadError;

  const { error: deleteError } = await supabase.storage
    .from('csv-uploads')
    .remove([filePath]);

  if (deleteError) {
    console.error('Error deleting processing file:', deleteError);
  }
}

export async function updateCSVWithValidation(
  filePath: string,
  onProgress: (progress: number) => void
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    if (!filePath.startsWith(`${user.id}/`)) {
      throw new Error('Unauthorized access to file');
    }

    const { data: originalFile, error: downloadError } = await supabase.storage
      .from('csv-uploads')
      .download(filePath);

    if (downloadError) throw downloadError;
    if (!originalFile) throw new Error('No file data found');

    const { headers, rows, emailIndex } = await parseCSV(originalFile);

    const validationHeaders = [
      'validation_result',
      'validation_reason',
      'mx_check',
      'dns_check',
      'spf_check',
      'mailbox_check',
      'smtp_check',
      'catch_all'
    ];

    const totalRows = rows.length;
    let processedCount = 0;
    let failedBatches = 0;

    for (let i = 0; i < totalRows; i += BATCH_SIZE) {
      const batchRows = rows.slice(i, Math.min(i + BATCH_SIZE, totalRows));
      const batchEmails = batchRows.map(row => row[emailIndex]);

      let batchSuccess = false;
      let retryCount = 0;

      while (!batchSuccess && retryCount < MAX_RETRIES) {
        try {
          const validationResults = await validateEmailBatch(batchEmails);

          batchRows.forEach((row, index) => {
            const result = validationResults[index];
            if (result) {
              row.push(
                result.valid ? 'Valid' : 'Invalid',
                (result.reason || '').replace(/,/g, ';'),
                String(result.checks.mx),
                String(result.checks.dns),
                String(result.checks.spf),
                String(result.checks.mailbox),
                String(result.checks.smtp),
                String(result.checks.catchAll || false)
              );
            } else {
              row.push(...Array(validationHeaders.length).fill(''));
            }
          });

          batchSuccess = true;
        } catch (error) {
          retryCount++;
          if (retryCount === MAX_RETRIES) {
            failedBatches++;
            console.error(`Failed to process batch at index ${i} after ${MAX_RETRIES} retries:`, error);
            
            // Add empty results for failed batch
            batchRows.forEach(row => {
              row.push(...Array(validationHeaders.length).fill('Error: Failed to validate'));
            });
          } else {
            await sleep(RETRY_DELAY * retryCount);
          }
        }
      }

      processedCount += batchRows.length;
      onProgress((processedCount / totalRows) * 100);

      // Update file after each successful batch
      try {
        await updateValidatedFile(filePath, headers, validationHeaders, rows);
      } catch (error) {
        console.error('Error updating file:', error);
        throw new Error('Failed to save validation results');
      }
    }

    if (failedBatches > 0) {
      console.warn(`Completed with ${failedBatches} failed batches`);
    }
  } catch (error) {
    console.error('CSV Update Error:', error);
    throw new Error(
      error instanceof Error 
        ? `Failed to update CSV: ${error.message}`
        : 'Failed to update CSV with validation results'
    );
  }
}