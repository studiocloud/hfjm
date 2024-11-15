# Email Validator Pro

A professional email validation system with real-time MX, DNS, SPF, and mailbox verification capabilities. The system performs deep validation checks while being appropriately lenient for generic email providers.

## Features

- ✨ Single email validation
- 📦 Bulk validation via CSV upload with batch processing
- 🔍 Deep validation checks:
  - Format validation (RFC 5322)
  - DNS record verification
  - MX record validation
  - SMTP server verification
  - Mailbox existence validation
  - Catch-all detection
- 🚀 Real-time progress tracking
- 📊 Detailed validation reports
- 💾 Secure file storage with Supabase
- 🔒 User authentication
- 🎯 Rate limiting protection
- 🌐 Production-ready deployment
- 🔄 Smart retry mechanism
- 🛡️ Provider-specific optimizations

## Validation Process

### 1. Format Check
- RFC 5322 compliance
- Length restrictions (64 chars local part, 255 chars domain)
- Character validation
- Local part and domain validation

### 2. DNS Check
- Domain existence verification
- A/AAAA record verification
- CNAME resolution

### 3. MX Check
- MX record existence
- Priority handling
- Server availability

### 4. SMTP Check
- Server connection establishment
- HELO/EHLO handshake
- TLS support detection
- Dynamic MAIL FROM selection
- Smart retry mechanism
- Response code analysis

### 5. Mailbox Check
- RCPT TO verification
- Smart response code interpretation
- Provider-specific validation rules
- Smart retry mechanism

## Provider-Specific Handling

### Major Providers (Gmail, Outlook, Yahoo)
- Strict validation rules
- Adaptive TLS requirements
- Full SMTP verification
- Comprehensive mailbox checks
- Smart retry mechanism
- Custom timeouts:
  - Gmail: 15s
  - Outlook: 30s
  - Yahoo: 12s
- Provider-specific optimizations:
  - Outlook: Multiple MAIL FROM attempts
  - Gmail: Mandatory TLS
  - Yahoo: Enhanced retry logic

### Generic Providers
- Adaptive validation rules
- Flexible TLS requirements
- Multiple MAIL FROM attempts
- Smart SMTP response interpretation
- Multiple MX record support
- Smart retry mechanism

## File Processing

### CSV Upload
- Secure file storage in Supabase
- Automatic user bucket creation
- File sanitization
- Progress tracking
- Batch processing with error recovery
- Automatic retries

### Batch Processing
- 50 emails per batch
- Parallel validation within batches
- Real-time progress updates
- Automatic cleanup
- Smart retry mechanism
- Error recovery per batch

### Results Storage
- Separate processing and validated folders
- Secure file access
- User-specific storage
- Validation columns added:
  - validation_result
  - validation_reason
  - mx_check
  - dns_check
  - spf_check
  - mailbox_check
  - smtp_check

## API Endpoints

### Single Email Validation
```http
POST /api/validate
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### Batch Validation
```http
POST /api/validate/batch
Content-Type: application/json

{
  "emails": ["email1@domain.com", "email2@domain.com"]
}
```

### Bulk CSV Validation
```http
POST /api/validate/bulk
Content-Type: multipart/form-data

file: emails.csv
```

## Response Format

### Single/Batch Validation
```typescript
interface ValidationResult {
  email: string;
  valid: boolean;
  reason: string;
  checks: {
    format: boolean;
    dns: boolean;
    mx: boolean;
    spf: boolean;
    smtp: boolean;
    mailbox: boolean;
  };
  details?: {
    mxRecords: string[];
    smtpResponse: string;
  };
}
```

### Bulk Validation Stream
```typescript
interface ValidationProgress {
  type: 'progress' | 'complete';
  progress?: number;
  results: ValidationResult[];
}
```

## Configuration

### Environment Variables
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Rate Limiting
- 100 requests per 15 minutes per IP
- 10MB file size limit for CSV uploads
- Batch size: 50 emails

## Development

1. Install dependencies:
```bash
npm install
cd server && npm install
```

2. Set up environment variables:
- Copy `.env.example` to `.env`
- Add your Supabase credentials

3. Start development servers:
```bash
# Frontend
npm run dev

# Backend
cd server && npm run dev
```

## Security Features

- CORS protection
- Rate limiting
- File size restrictions
- Secure file storage
- Error sanitization
- User authentication
- File access control
- TLS support detection
- Smart retry mechanism

## Best Practices

### Email Validation
- Progressive validation steps
- Provider-specific optimizations
- Smart response interpretation
- Dynamic MAIL FROM
- Provider-specific optimizations
- Smart retry mechanism

### File Processing
- Batch processing
- Progress tracking
- Secure storage
- Smart retry mechanism
- Error recovery
- Parallel validation

### Security
- User authentication
- File access control
- Input sanitization
- Error handling
- Rate limiting
- Smart retries
- Dynamic MAIL FROM
- Multiple retry strategies

### Performance Optimizations
- Batch processing
- Parallel validation
- Progress streaming
- Efficient file handling
- Memory management
- Connection pooling
- Dynamic MAIL FROM
- Provider-specific optimizations

## License

MIT License - See [LICENSE](LICENSE) for details