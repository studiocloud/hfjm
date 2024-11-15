import React, { useState, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import { EmailInput } from './EmailInput';
import { BulkUpload } from './BulkUpload';
import { ValidationResults } from './ValidationResults';
import { validateEmail } from '../lib/emailValidation';
import { uploadAndProcessCSV, updateCSVWithValidation, downloadProcessedCSV } from '../lib/csvProcessing';
import type { ValidationResult } from '../types/validation';

export function ValidationForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);

  const handleSingleValidation = async () => {
    if (!email) return;
    
    setLoading(true);
    setError(null);
    setResults([]);
    
    try {
      const result = await validateEmail(email);
      setResults([result]);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to validate email');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!file || file.type !== 'text/csv') {
      setError('Please select a valid CSV file');
      return;
    }

    setLoading(true);
    setProgress(0);
    setError(null);
    setResults([]);

    try {
      // Upload file to Supabase
      const filePath = await uploadAndProcessCSV(file);
      setCurrentFilePath(filePath);

      // Process CSV in batches and update progress
      await updateCSVWithValidation(filePath, (progress) => {
        setProgress(progress);
      });

      // Update the file path to point to the validated file
      setCurrentFilePath(filePath.replace('/processing/', '/validated/'));
      setProgress(100);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to process CSV file');
      setCurrentFilePath(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = useCallback(async () => {
    if (!currentFilePath) return;

    try {
      const blob = await downloadProcessedCSV(currentFilePath);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `validated-${currentFilePath.split('/').pop()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to download results');
    }
  }, [currentFilePath]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <EmailInput
        email={email}
        onEmailChange={setEmail}
        onValidate={handleSingleValidation}
        loading={loading}
        disabled={loading}
      />

      <BulkUpload
        onFileSelect={handleFileSelect}
        loading={loading}
        progress={progress}
      />

      {error && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {progress === 100 && currentFilePath && (
        <div className="flex justify-center">
          <button
            onClick={handleDownload}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            Download Validated CSV
          </button>
        </div>
      )}

      <ValidationResults 
        results={results}
        onDownload={results.length > 1 ? handleDownload : undefined}
      />
    </div>
  );
}