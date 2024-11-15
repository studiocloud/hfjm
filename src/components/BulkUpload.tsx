import React, { useRef, useState } from 'react';
import { Upload, FileText, X, Loader2 } from 'lucide-react';

interface BulkUploadProps {
  onFileSelect: (file: File) => void;
  loading: boolean;
  progress: number;
}

export function BulkUpload({ onFileSelect, loading, progress }: BulkUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setSelectedFile(file);
      onFileSelect(file);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-t border-gray-700 my-6"></div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        Bulk Email Validation (CSV)
      </label>
      <div className="relative">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept=".csv"
          className="hidden"
          disabled={loading}
        />
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="flex-1 bg-gray-700 text-white py-2 px-4 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <Upload className="w-5 h-5" />
            <span>Upload CSV</span>
          </button>
          {selectedFile && !loading && (
            <button
              onClick={clearFile}
              className="sm:self-stretch p-2 text-gray-400 hover:text-gray-300 bg-gray-700 rounded-md"
              disabled={loading}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {selectedFile && (
        <div className="bg-gray-700/50 rounded-md p-4">
          <div className="flex items-center gap-3 mb-3">
            <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-300 truncate">{selectedFile.name}</p>
            </div>
          </div>
          {loading && (
            <div className="space-y-2">
              <div className="w-full bg-gray-600 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Validating... {Math.round(progress)}%</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}