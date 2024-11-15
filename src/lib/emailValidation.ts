import { ValidationResult } from '../types/validation';

export async function validateEmail(email: string): Promise<ValidationResult> {
  try {
    const response = await fetch('/api/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      throw new Error('Validation service unavailable');
    }

    const result = await response.json();
    
    return {
      email,
      valid: result.valid,
      reason: result.reason || 'Validation completed',
      checks: {
        format: result.checks?.format || false,
        dns: result.checks?.dns || false,
        mx: result.checks?.mx || false,
        spf: result.checks?.spf || false,
        smtp: result.checks?.smtp || false,
        mailbox: result.checks?.mailbox || false,
      }
    };
  } catch (error) {
    return {
      email,
      valid: false,
      reason: error instanceof Error ? error.message : 'Validation failed',
      checks: {
        format: false,
        dns: false,
        mx: false,
        spf: false,
        smtp: false,
        mailbox: false,
      }
    };
  }
}