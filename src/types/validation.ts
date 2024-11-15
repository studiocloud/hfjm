export interface ValidationChecks {
  format: boolean;
  dns: boolean;
  mx: boolean;
  spf: boolean;
  smtp: boolean;
  mailbox: boolean;
}

export interface ValidationResult {
  email: string;
  valid: boolean;
  reason: string;
  checks: ValidationChecks;
}

export interface BulkValidationResponse {
  type: 'progress' | 'complete' | 'error';
  progress?: number;
  results?: ValidationResult[];
  error?: string;
}