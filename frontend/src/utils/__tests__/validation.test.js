/**
 * Comprehensive Unit Tests for Form Validation
 * Achieves high test coverage for validation utilities
 */
import {
  ValidationRules,
  FieldValidators,
  FormSchemas,
  validateField,
  validateForm,
  hasErrors,
  sanitizeInput,
  sanitizeFormData,
} from '@/utils/validation';

describe('ValidationRules', () => {
  describe('required', () => {
    it('returns error for null value', () => {
      expect(ValidationRules.required(null, 'Field')).toBe('Field is required');
    });

    it('returns error for undefined value', () => {
      expect(ValidationRules.required(undefined, 'Field')).toBe('Field is required');
    });

    it('returns error for empty string', () => {
      expect(ValidationRules.required('', 'Name')).toBe('Name is required');
    });

    it('returns error for whitespace-only string', () => {
      expect(ValidationRules.required('   ', 'Field')).toBe('Field is required');
    });

    it('returns null for valid value', () => {
      expect(ValidationRules.required('John', 'Name')).toBeNull();
    });

    it('returns null for zero (valid number)', () => {
      expect(ValidationRules.required(0, 'Amount')).toBeNull();
    });
  });

  describe('minLength', () => {
    const minLength3 = ValidationRules.minLength(3);

    it('returns error for short string', () => {
      expect(minLength3('ab', 'Name')).toBe('Name must be at least 3 characters');
    });

    it('returns null for exact length', () => {
      expect(minLength3('abc', 'Name')).toBeNull();
    });

    it('returns null for longer string', () => {
      expect(minLength3('abcdef', 'Name')).toBeNull();
    });

    it('returns null for empty value (use required for that)', () => {
      expect(minLength3('', 'Name')).toBeNull();
    });
  });

  describe('maxLength', () => {
    const maxLength5 = ValidationRules.maxLength(5);

    it('returns error for too long string', () => {
      expect(maxLength5('abcdefg', 'Code')).toBe('Code must not exceed 5 characters');
    });

    it('returns null for exact length', () => {
      expect(maxLength5('abcde', 'Code')).toBeNull();
    });

    it('returns null for shorter string', () => {
      expect(maxLength5('abc', 'Code')).toBeNull();
    });
  });

  describe('email', () => {
    it('returns error for invalid email', () => {
      expect(ValidationRules.email('invalid', 'Email')).toBe('Email must be a valid email address');
    });

    it('returns error for email without @', () => {
      expect(ValidationRules.email('test.com', 'Email')).not.toBeNull();
    });

    it('returns error for email without domain', () => {
      expect(ValidationRules.email('test@', 'Email')).not.toBeNull();
    });

    it('returns null for valid email', () => {
      expect(ValidationRules.email('test@example.com', 'Email')).toBeNull();
    });

    it('returns null for empty (use required for that)', () => {
      expect(ValidationRules.email('', 'Email')).toBeNull();
    });
  });

  describe('phone', () => {
    it('returns error for invalid phone', () => {
      expect(ValidationRules.phone('abc', 'Phone')).toBe('Phone must be a valid phone number');
    });

    it('returns error for too short phone', () => {
      expect(ValidationRules.phone('123', 'Phone')).not.toBeNull();
    });

    it('returns null for valid phone with digits', () => {
      expect(ValidationRules.phone('1234567890', 'Phone')).toBeNull();
    });

    it('returns null for phone with formatting', () => {
      expect(ValidationRules.phone('+1 (555) 123-4567', 'Phone')).toBeNull();
    });
  });

  describe('numeric', () => {
    it('returns error for non-numeric', () => {
      expect(ValidationRules.numeric('abc', 'Amount')).toBe('Amount must be a number');
    });

    it('returns null for integer string', () => {
      expect(ValidationRules.numeric('123', 'Amount')).toBeNull();
    });

    it('returns null for decimal string', () => {
      expect(ValidationRules.numeric('123.45', 'Amount')).toBeNull();
    });

    it('returns null for negative number', () => {
      expect(ValidationRules.numeric('-50', 'Amount')).toBeNull();
    });
  });

  describe('positiveNumber', () => {
    it('returns error for zero', () => {
      expect(ValidationRules.positiveNumber(0, 'Quantity')).toBe('Quantity must be a positive number');
    });

    it('returns error for negative', () => {
      expect(ValidationRules.positiveNumber(-5, 'Quantity')).not.toBeNull();
    });

    it('returns error for non-numeric', () => {
      expect(ValidationRules.positiveNumber('abc', 'Quantity')).not.toBeNull();
    });

    it('returns null for positive number', () => {
      expect(ValidationRules.positiveNumber(10, 'Quantity')).toBeNull();
    });
  });

  describe('min', () => {
    const min10 = ValidationRules.min(10);

    it('returns error for value below min', () => {
      expect(min10(5, 'Age')).toBe('Age must be at least 10');
    });

    it('returns null for exact min', () => {
      expect(min10(10, 'Age')).toBeNull();
    });

    it('returns null for value above min', () => {
      expect(min10(15, 'Age')).toBeNull();
    });
  });

  describe('max', () => {
    const max100 = ValidationRules.max(100);

    it('returns error for value above max', () => {
      expect(max100(150, 'Score')).toBe('Score must not exceed 100');
    });

    it('returns null for exact max', () => {
      expect(max100(100, 'Score')).toBeNull();
    });

    it('returns null for value below max', () => {
      expect(max100(50, 'Score')).toBeNull();
    });
  });

  describe('validDate', () => {
    it('returns error for invalid date string', () => {
      expect(ValidationRules.validDate('not-a-date', 'Date')).toBe('Date must be a valid date');
    });

    it('returns null for valid ISO date', () => {
      expect(ValidationRules.validDate('2024-01-15', 'Date')).toBeNull();
    });

    it('returns null for valid date format', () => {
      expect(ValidationRules.validDate('2024/01/15', 'Date')).toBeNull();
    });
  });

  describe('notPastDate', () => {
    it('returns error for past date', () => {
      expect(ValidationRules.notPastDate('2020-01-01', 'Date')).toBe('Date cannot be in the past');
    });

    it('returns null for future date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      expect(ValidationRules.notPastDate(futureDate.toISOString().split('T')[0], 'Date')).toBeNull();
    });
  });

  describe('notFutureDate', () => {
    it('returns error for future date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      expect(ValidationRules.notFutureDate(futureDate.toISOString().split('T')[0], 'Date')).toBe('Date cannot be in the future');
    });

    it('returns null for past date', () => {
      expect(ValidationRules.notFutureDate('2020-01-01', 'Date')).toBeNull();
    });
  });

  describe('differentFrom', () => {
    const differentFromPhone = ValidationRules.differentFrom('1234567890', 'Phone');

    it('returns error for matching values', () => {
      expect(differentFromPhone('1234567890', 'Emergency Contact')).toBe('Emergency Contact must be different from Phone');
    });

    it('returns null for different values', () => {
      expect(differentFromPhone('0987654321', 'Emergency Contact')).toBeNull();
    });
  });

  describe('noScriptTags', () => {
    it('detects script tags', () => {
      expect(ValidationRules.noScriptTags('<script>alert(1)</script>', 'Input')).toBe('Input contains invalid characters');
    });

    it('detects javascript: protocol', () => {
      expect(ValidationRules.noScriptTags('javascript:alert(1)', 'Input')).not.toBeNull();
    });

    it('detects event handlers', () => {
      expect(ValidationRules.noScriptTags('<img onerror=alert(1)>', 'Input')).not.toBeNull();
    });

    it('returns null for safe input', () => {
      expect(ValidationRules.noScriptTags('Hello World', 'Input')).toBeNull();
    });
  });

  describe('noSqlInjection', () => {
    it('detects OR injection', () => {
      expect(ValidationRules.noSqlInjection("' OR 1=1", 'Input')).toBe('Input contains invalid characters');
    });

    it('detects DROP statement', () => {
      expect(ValidationRules.noSqlInjection("'; DROP TABLE users", 'Input')).not.toBeNull();
    });

    it('returns null for safe input', () => {
      expect(ValidationRules.noSqlInjection('John Doe', 'Input')).toBeNull();
    });
  });
});

describe('validateField', () => {
  it('returns first error from multiple validators', () => {
    const validators = [
      ValidationRules.required,
      ValidationRules.minLength(5),
    ];
    expect(validateField('', validators, 'Name')).toBe('Name is required');
  });

  it('returns second error when first passes', () => {
    const validators = [
      ValidationRules.required,
      ValidationRules.minLength(5),
    ];
    expect(validateField('abc', validators, 'Name')).toBe('Name must be at least 5 characters');
  });

  it('returns null when all validators pass', () => {
    const validators = [
      ValidationRules.required,
      ValidationRules.minLength(5),
    ];
    expect(validateField('Hello World', validators, 'Name')).toBeNull();
  });
});

describe('validateForm', () => {
  const schema = {
    name: { validators: [ValidationRules.required, ValidationRules.minLength(2)], label: 'Name' },
    email: { validators: [ValidationRules.required, ValidationRules.email], label: 'Email' },
  };

  it('returns all field errors', () => {
    const errors = validateForm({ name: '', email: 'invalid' }, schema);
    expect(errors.name).toBe('Name is required');
    expect(errors.email).toBe('Email must be a valid email address');
  });

  it('returns empty object for valid form', () => {
    const errors = validateForm({ name: 'John', email: 'john@example.com' }, schema);
    expect(errors).toEqual({});
  });

  it('handles partial validation', () => {
    const errors = validateForm({ name: 'Jo', email: 'john@example.com' }, schema);
    expect(errors.name).toBeUndefined();
    expect(errors.email).toBeUndefined();
  });
});

describe('hasErrors', () => {
  it('returns true for object with errors', () => {
    expect(hasErrors({ name: 'Required' })).toBe(true);
  });

  it('returns false for empty object', () => {
    expect(hasErrors({})).toBe(false);
  });
});

describe('sanitizeInput', () => {
  it('escapes HTML brackets', () => {
    expect(sanitizeInput('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes quotes', () => {
    expect(sanitizeInput('"test"')).toBe('&quot;test&quot;');
  });

  it('escapes single quotes', () => {
    expect(sanitizeInput("'test'")).toBe('&#x27;test&#x27;');
  });

  it('trims whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  it('returns non-strings unchanged', () => {
    expect(sanitizeInput(123)).toBe(123);
    expect(sanitizeInput(null)).toBe(null);
  });
});

describe('sanitizeFormData', () => {
  it('sanitizes all string values', () => {
    const data = { name: '<script>alert(1)</script>', age: 25 };
    const sanitized = sanitizeFormData(data);
    expect(sanitized.name).not.toContain('<script>');
    expect(sanitized.age).toBe(25);
  });

  it('handles nested objects', () => {
    const data = { user: { name: '<b>Test</b>' } };
    const sanitized = sanitizeFormData(data);
    expect(sanitized.user.name).not.toContain('<b>');
  });

  it('handles arrays', () => {
    const data = { items: ['<script>a</script>', 'safe'] };
    const sanitized = sanitizeFormData(data);
    expect(sanitized.items[0]).not.toContain('<script>');
    expect(sanitized.items[1]).toBe('safe');
  });
});

describe('FormSchemas', () => {
  it('has patient schema defined', () => {
    expect(FormSchemas.patient).toBeDefined();
    expect(FormSchemas.patient.first_name).toBeDefined();
    expect(FormSchemas.patient.last_name).toBeDefined();
  });

  it('has appointment schema defined', () => {
    expect(FormSchemas.appointment).toBeDefined();
    expect(FormSchemas.appointment.patient).toBeDefined();
    expect(FormSchemas.appointment.doctor).toBeDefined();
  });

  it('has prescription schema defined', () => {
    expect(FormSchemas.prescription).toBeDefined();
  });

  it('has all required schemas', () => {
    expect(FormSchemas.prescriptionItem).toBeDefined();
    expect(FormSchemas.medicine).toBeDefined();
    expect(FormSchemas.inventory).toBeDefined();
    expect(FormSchemas.labTest).toBeDefined();
    expect(FormSchemas.staff).toBeDefined();
  });
});

describe('FieldValidators', () => {
  it('firstName validators work correctly', () => {
    const error = validateField('', FieldValidators.firstName, 'First Name');
    expect(error).toBe('First Name is required');
  });

  it('phone validators work correctly', () => {
    const error = validateField('invalid', FieldValidators.phone, 'Phone');
    expect(error).not.toBeNull();
  });

  it('quantity validators work correctly', () => {
    const error = validateField(0, FieldValidators.quantity, 'Quantity');
    expect(error).toBe('Quantity is required');
  });

  it('valid quantity passes', () => {
    const error = validateField(10, FieldValidators.quantity, 'Quantity');
    expect(error).toBeNull();
  });
});
