import React from 'react';
import { Download, CheckCircle2, XCircle } from 'lucide-react';
import { ValidationResult } from '../types/validation';

interface ValidationResultsProps {
  results: ValidationResult[];
  onDownload?: () => void;
}

export function ValidationResults({ results, onDownload }: ValidationResultsProps) {
  if (results.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-xl shadow-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Validation Results</h2>
        {results.length > 1 && onDownload && (
          <button
            onClick={onDownload}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
        )}
      </div>
      <div className="space-y-4">
        {results.map((result, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg ${
              result.valid ? 'bg-green-900/30' : 'bg-red-900/30'
            }`}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                {result.valid ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
                <div>
                  <p className="font-medium">{result.email}</p>
                  <p className={`text-sm ${
                    result.valid ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {result.reason}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.checks).map(([key, value]) => (
                  <div
                    key={key}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      value
                        ? 'bg-green-900/50 text-green-400'
                        : 'bg-red-900/50 text-red-400'
                    }`}
                  >
                    {key.toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}