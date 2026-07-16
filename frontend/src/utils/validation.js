/**
 * Enterprise-grade Form Validation Utilities
 * Provides consistent validation across all forms
 */

// ==========================================
// VALIDATION RULES
// ==========================================

export const ValidationRules = {
  // String validations
  required: (value, fieldName = 'Field') => {
    if (value === null || value === undefined || String(value).trim() === '') {
      return `${fieldName} is required`;
    }
    return null;
  },

  minLength: (min) => (value, fieldName = 'Field') => {
    if (value && String(value).length < min) {
      return `${fieldName} must be at least ${min} characters`;
    }
    return null;
  },

  maxLength: (max) => (value, fieldName = 'Field') => {
    if (value && String(value).length > max) {
      return `${fieldName} must not exceed ${max} characters`;
    }
    return null;
  },

  // Pattern validations
  email: (value, fieldName = 'Email') => {
    if (!value) return null;
    const v = value.trim().toLowerCase();
    // Require valid TLD (2+ chars after last dot)
    if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(v)) {
      return `${fieldName} must be a valid email address with a proper domain (e.g. user@example.com)`;
    }
    // Reject consecutive dots in local part
    const local = v.split('@')[0];
    if (local.includes('..')) {
      return `${fieldName} local part cannot contain consecutive dots`;
    }
    // Reject fake patterns where local == domain label with short names
    const domainLabel = v.split('@')[1].split('.')[0];
    if (local === domainLabel && local.length <= 4) {
      return `${fieldName} appears to be a test/fake address`;
    }
    return null;
  },

  phone: (value, fieldName = 'Phone') => {
    if (!value) return null;
    const digits = String(value).replace(/^\+91/, '').trim();
    if (!/^\d{10}$/.test(digits)) {
      return `${fieldName} must be exactly 10 digits (optional +91 prefix)`;
    }
    if (!/^[6-9]/.test(digits)) {
      return `${fieldName} must start with 6, 7, 8, or 9`;
    }
    if (new Set(digits).size === 1) {
      return `${fieldName} cannot be all identical digits`;
    }
    // Sequential ascending check
    const ascending = Array.from({ length: 10 }, (_, i) => (parseInt(digits[0]) + i) % 10).join('');
    if (digits === ascending) {
      return `${fieldName} cannot be a sequential pattern`;
    }
    // Entropy: at least 4 unique digits
    if (new Set(digits).size < 4) {
      return `${fieldName} must contain at least 4 different digits`;
    }
    return null;
  },

  // Number validations
  numeric: (value, fieldName = 'Field') => {
    if (value && isNaN(Number(value))) {
      return `${fieldName} must be a number`;
    }
    return null;
  },

  positiveNumber: (value, fieldName = 'Field') => {
    const num = Number(value);
    if (value && (isNaN(num) || num <= 0)) {
      return `${fieldName} must be a positive number`;
    }
    return null;
  },

  min: (minVal) => (value, fieldName = 'Field') => {
    if (value !== '' && value !== null && value !== undefined && Number(value) < minVal) {
      return `${fieldName} must be at least ${minVal}`;
    }
    return null;
  },

  max: (maxVal) => (value, fieldName = 'Field') => {
    if (value && Number(value) > maxVal) {
      return `${fieldName} must not exceed ${maxVal}`;
    }
    return null;
  },

  // Date validations
  validDate: (value, fieldName = 'Date') => {
    if (value && isNaN(Date.parse(value))) {
      return `${fieldName} must be a valid date`;
    }
    return null;
  },

  notPastDate: (value, fieldName = 'Date') => {
    if (value) {
      const date = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) {
        return `${fieldName} cannot be in the past`;
      }
    }
    return null;
  },

  notFutureDate: (value, fieldName = 'Date') => {
    if (value) {
      const date = new Date(value);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (date > today) {
        return `${fieldName} cannot be in the future`;
      }
    }
    return null;
  },

  ageMin: (minAge) => (value, fieldName = 'Date of Birth') => {
    if (value) {
      const birthDate = new Date(value);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age < minAge) {
        return `${fieldName} indicates age must be at least ${minAge}`;
      }
    }
    return null;
  },

  // Custom validations
  differentFrom: (otherValue, otherFieldName) => (value, fieldName) => {
    if (value && otherValue && value === otherValue) {
      return `${fieldName} must be different from ${otherFieldName}`;
    }
    return null;
  },

  matchesField: (otherValue, otherFieldName) => (value, fieldName) => {
    if (value !== otherValue) {
      return `${fieldName} must match ${otherFieldName}`;
    }
    return null;
  },

  // Security validations
  noScriptTags: (value, fieldName = 'Field') => {
    if (value && /<script|javascript:|on\w+=/i.test(value)) {
      return `${fieldName} contains invalid characters`;
    }
    return null;
  },

  noSqlInjection: (value, fieldName = 'Field') => {
    if (value && /('|"|;|--|\bOR\b|\bAND\b|\bDROP\b|\bDELETE\b|\bINSERT\b|\bUPDATE\b)/i.test(value)) {
      return `${fieldName} contains invalid characters`;
    }
    return null;
  },
};

// ==========================================
// SHARED STRICT VALIDATORS (Admin / Staff / Doctor)
// Mirror backend rules exactly
// ==========================================

/**
 * Username: 4-7 chars, only letters + '.', no numbers,
 * max 2 consecutive identical, no dot-only, no leading/trailing/double dot.
 */
export function validateUsername(value) {
  const v = (value || '').trim();
  if (!v) return 'Username is required.';
  if (v.length < 4 || v.length > 7) return 'Username must be between 4 and 7 characters.';
  if (!/^[A-Za-z.]+$/.test(v)) return 'Username may only contain letters (a–z, A–Z) and dots (.).';
  if (!/[A-Za-z]/.test(v)) return 'Username must contain at least one letter.';
  if (v.startsWith('.') || v.endsWith('.')) return 'Username cannot start or end with a dot.';
  if (v.includes('..')) return 'Username cannot contain consecutive dots.';
  if (/(.)\1{2,}/i.test(v)) return 'Username cannot have more than 2 consecutive identical characters.';
  return null;
}

/**
 * Email: valid format with TLD, no fake patterns, no consecutive dots in local.
 */
export function validateEmail(value) {
  const v = (value || '').trim().toLowerCase();
  if (!v) return 'Email is required.';
  if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(v)) {
    return 'Enter a valid email address with a proper domain (e.g. user@example.com).';
  }
  const local = v.split('@')[0];
  if (local.includes('..')) return 'Email local part cannot contain consecutive dots.';
  const domainLabel = v.split('@')[1].split('.')[0];
  if (local === domainLabel && local.length <= 4) {
    return 'Email appears to be a test/fake address. Please use a real email.';
  }
  return null;
}

/**
 * Indian phone: 10 digits, starts with 6-9, no all-identical,
 * no sequential, min 4 unique digits.
 */
export function validateIndianPhone(value) {
  const raw = (value || '').trim();
  const digits = raw.replace(/^\+91/, '');
  if (!digits) return 'Phone number is required.';
  if (!/^\d{10}$/.test(digits)) return 'Phone must be exactly 10 digits (optional +91 prefix).';
  if (!/^[6-9]/.test(digits)) return 'Phone must start with 6, 7, 8, or 9.';
  if (new Set(digits).size === 1) return 'Phone number cannot be all identical digits.';
  const ascending = Array.from({ length: 10 }, (_, i) => (parseInt(digits[0]) + i) % 10).join('');
  if (digits === ascending) return 'Phone number cannot be a sequential pattern.';
  if (new Set(digits).size < 4) return 'Phone number must contain at least 4 different digits.';
  return null;
}

/**
 * Name (first/last): 3-50 chars, letters only, max 2 consecutive identical.
 */
export function validateName(value, label = 'Name') {
  const v = (value || '').trim();
  if (!v) return `${label} is required.`;
  if (v.length < 3) return `${label} must be at least 3 characters.`;
  if (v.length > 50) return `${label} must not exceed 50 characters.`;
  if (!/^[A-Za-z]+$/.test(v)) return `${label} must contain letters only.`;
  if (/(.)\1{2,}/i.test(v)) return `${label} cannot have more than 2 consecutive identical characters.`;
  return null;
}

/**
 * Qualification: 3-255 chars, letters/spaces/dots/commas,
 * must have ≥1 letter, max 2 consecutive identical chars.
 */
export function validateQualification(value) {
  const v = (value || '').trim();
  if (!v) return 'Qualification is required.';
  if (v.length < 3) return 'Qualification must be at least 3 characters.';
  if (v.length > 255) return 'Qualification must not exceed 255 characters.';
  if (!/^[A-Za-z\s.,]+$/.test(v)) return 'Qualification may only contain letters, spaces, dots and commas.';
  if (!/[A-Za-z]/.test(v)) return 'Qualification must contain at least one letter.';
  if (/(.)\1{2,}/i.test(v)) return 'Qualification cannot have more than 2 consecutive identical characters.';
  return null;
}

/**
 * Address: 5-100 chars, letters/numbers/spaces/.,-()',
 * must have ≥1 letter, max 3 consecutive identical chars.
 */
export function validateAddress(value) {
  const v = (value || '').trim().replace(/  +/g, ' ');
  if (!v) return 'Address is required.';
  if (v.length < 5) return 'Address must be at least 5 characters.';
  if (v.length > 100) return 'Address must not exceed 100 characters.';
  if (!/^[A-Za-z0-9\s.,\-()']+$/.test(v)) {
    return "Address may only contain letters, numbers, spaces, and . , - ( ) '";
  }
  if (!/[A-Za-z]/.test(v)) return 'Address must contain at least one letter.';
  if (/(.)\1{3,}/.test(v)) return 'Address cannot have more than 3 consecutive identical characters.';
  return null;
}

/**
 * Salary: must be a number, min ₹1000, max ₹10,00,000.
 */
export function validateSalary(value) {
  if (value === '' || value === null || value === undefined) return 'Salary is required.';
  const num = Number(value);
  if (isNaN(num)) return 'Salary must be a valid number.';
  if (num < 1000) return 'Salary must be at least ₹1,000.';
  if (num > 1_000_000) return 'Salary must not exceed ₹10,00,000.';
  return null;
}

// ==========================================
// PHARMACY VALIDATORS
// Mirror backend pharmacist/serializers.py rules exactly
// ==========================================

/**
 * Check for more than max_repeat consecutive identical characters.
 * Spaces are ignored in the consecutive check (matches backend behaviour).
 */
function _hasExcessiveConsecutive(value, maxRepeat = 3) {
  return new RegExp(`(.)\\1{${maxRepeat},}`).test(value.replace(/ /g, ''));
}

/**
 * Medicine Name: letters + spaces ONLY (no numbers), 2–20 chars, max 3 consecutive.
 */
export function validateMedicineName(value) {
  const v = (value || '').trim();
  if (!v) return 'Medicine name is required.';
  if (v.includes('  ')) return 'Medicine name cannot contain multiple consecutive spaces.';
  if (v.length < 2) return 'Medicine name must be at least 2 characters.';
  if (v.length > 20) return 'Medicine name must not exceed 20 characters.';
  if (!/^[A-Za-z ]+$/.test(v)) return 'Medicine name should contain only letters.';
  if (_hasExcessiveConsecutive(v)) return 'Medicine name: same character cannot be repeated more than 3 times consecutively.';
  return null;
}

/**
 * Company Name: letters + spaces only, 2–20 chars, max 3 consecutive.
 */
export function validateCompanyName(value) {
  const v = (value || '').trim();
  if (!v) return 'Company name is required.';
  if (v.includes('  ')) return 'Company name cannot contain multiple consecutive spaces.';
  if (v.length < 2) return 'Company name must be at least 2 characters.';
  if (v.length > 20) return 'Company name must not exceed 20 characters.';
  if (!/^[A-Za-z ]+$/.test(v)) return 'Company name may only contain letters and spaces.';
  if (_hasExcessiveConsecutive(v)) return 'Company name: same character cannot be repeated more than 3 times consecutively.';
  return null;
}

/**
 * Generic Name: same rules as Company Name.
 */
export function validateGenericName(value) {
  const v = (value || '').trim();
  if (!v) return 'Generic name is required.';
  if (v.includes('  ')) return 'Generic name cannot contain multiple consecutive spaces.';
  if (v.length < 2) return 'Generic name must be at least 2 characters.';
  if (v.length > 20) return 'Generic name must not exceed 20 characters.';
  if (!/^[A-Za-z ]+$/.test(v)) return 'Generic name may only contain letters and spaces.';
  if (_hasExcessiveConsecutive(v)) return 'Generic name: same character cannot be repeated more than 3 times consecutively.';
  return null;
}

/**
 * Supplier Name: required, letters + spaces only, 3–20 chars, max 3 consecutive.
 */
export function validateSupplierName(value) {
  const v = (value || '').trim();
  if (!v) return 'Supplier name is required.';
  if (v.includes('  ')) return 'Supplier name cannot contain multiple consecutive spaces.';
  if (v.length < 3) return 'Supplier name must be at least 3 characters.';
  if (v.length > 20) return 'Supplier name must not exceed 20 characters.';
  if (!/^[A-Za-z ]+$/.test(v)) return 'Supplier name may only contain letters and spaces.';
  if (_hasExcessiveConsecutive(v)) return 'Supplier name: same character cannot be repeated more than 3 times consecutively.';
  return null;
}

/**
 * Inventory Unit Price: numeric, 10–1000.
 */
export function validateInventoryUnitPrice(value) {
  if (value === '' || value === null || value === undefined) return 'Unit price is required.';
  const num = Number(value);
  if (isNaN(num)) return 'Unit price must be a valid number.';
  if (num < 10) return 'Unit price must be at least ₹10.';
  if (num > 1000) return 'Unit price must not exceed ₹1,000.';
  return null;
}

/**
 * Inventory Quantity: integer, 5–500.
 */
export function validateInventoryQuantity(value) {
  if (value === '' || value === null || value === undefined) return 'Quantity is required.';
  const num = Number(value);
  if (isNaN(num) || !Number.isInteger(num)) return 'Quantity must be a whole number.';
  if (num < 5) return 'Quantity must be at least 5.';
  if (num > 500) return 'Quantity must not exceed 500.';
  return null;
}

/**
 * Inventory Expiry Date: must be at least 6 months from today.
 * Used when adding a new batch to the inventory.
 */
export function validateInventoryExpiryDate(value) {
  if (!value) return 'Expiry date is required.';
  const expiry = new Date(value);
  if (isNaN(expiry.getTime())) return 'Expiry date must be a valid date.';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minExpiry = new Date(today);
  // Add 6 months
  minExpiry.setMonth(minExpiry.getMonth() + 6);
  if (expiry < minExpiry) return 'Expiry date must be at least 6 months from today.';
  return null;
}

/**
 * Schedule duration: end must be at least 4 hours 30 minutes after start.
 * Returns an error string or null.
 */
export function validateScheduleDuration(startTime, endTime) {
  if (!startTime || !endTime) return null;

  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const startMinutes = sh * 60 + sm;
  const endMinutes   = eh * 60 + em;
  const diff         = endMinutes - startMinutes;

  if (diff <= 0) return "End time must be after start time.";

  const MIN_DURATION = 4 * 60 + 30; // 270 minutes
  if (diff < MIN_DURATION) return "Schedule must be at least 4 hours 30 minutes long.";

  return null;
}

/**
 * Consultation fee: min ₹100, max ₹5000.
 */
export function validateConsultationFee(value) {
  if (value === '' || value === null || value === undefined) return 'Consultation fee is required.';
  const num = Number(value);
  if (isNaN(num)) return 'Consultation fee must be a valid number.';
  if (num < 100) return 'Consultation fee must be at least ₹100.';
  if (num > 5000) return 'Consultation fee must not exceed ₹5,000.';
  return null;
}

/**
 * Specialization: 3-100 chars, letters + spaces only,
 * max 2 consecutive identical, no repeating short patterns.
 */
export function validateSpecialization(value) {
  const v = (value || '').trim();
  if (!v) return 'Specialization is required.';
  if (v.length < 3) return 'Specialization must be at least 3 characters.';
  if (v.length > 100) return 'Specialization must not exceed 100 characters.';
  if (!/^[A-Za-z\s]+$/.test(v)) return 'Specialization must contain letters and spaces only.';
  if (/(.)\1{2,}/i.test(v)) return 'Specialization cannot have more than 2 consecutive identical characters.';
  if (/(.{2,4})\1{2,}/i.test(v)) return 'Specialization appears to be a meaningless repeated pattern.';
  return null;
}

// ==========================================
// FIELD VALIDATORS (legacy/shared)
// ==========================================

export const FieldValidators = {
  // Patient fields
  firstName: [
    ValidationRules.required,
    ValidationRules.minLength(2),
    ValidationRules.maxLength(50),
    ValidationRules.noScriptTags,
  ],
  lastName: [
    ValidationRules.required,
    ValidationRules.minLength(2),
    ValidationRules.maxLength(50),
    ValidationRules.noScriptTags,
  ],
  phone: [
    ValidationRules.required,
    ValidationRules.phone,
  ],
  email: [
    ValidationRules.email,
  ],
  dateOfBirth: [
    ValidationRules.required,
    ValidationRules.validDate,
    ValidationRules.notFutureDate,
  ],
  address: [
    ValidationRules.required,
    ValidationRules.minLength(10),
    ValidationRules.maxLength(500),
    ValidationRules.noScriptTags,
  ],

  // Medical fields
  symptoms: [
    ValidationRules.minLength(5),
    ValidationRules.maxLength(2000),
    ValidationRules.noScriptTags,
  ],
  diagnosis: [
    ValidationRules.minLength(5),
    ValidationRules.maxLength(2000),
    ValidationRules.noScriptTags,
  ],
  dosage: [
    ValidationRules.required,
    ValidationRules.minLength(2),
    ValidationRules.maxLength(100),
  ],
  quantity: [
    ValidationRules.required,
    ValidationRules.positiveNumber,
    ValidationRules.max(999),
  ],

  // Billing fields
  amount: [
    ValidationRules.required,
    ValidationRules.positiveNumber,
    ValidationRules.max(9999999),
  ],

  // Appointment fields
  appointmentDate: [
    ValidationRules.required,
    ValidationRules.validDate,
    ValidationRules.notPastDate,
  ],
  appointmentTime: [
    ValidationRules.required,
  ],
};

// ==========================================
// VALIDATION HELPERS
// ==========================================

/**
 * Validate a single field
 */
export const validateField = (value, validators, fieldName = 'Field') => {
  for (const validator of validators) {
    const error = validator(value, fieldName);
    if (error) return error;
  }
  return null;
};

/**
 * Validate entire form
 */
export const validateForm = (formData, validationSchema) => {
  const errors = {};

  for (const [fieldName, config] of Object.entries(validationSchema)) {
    const value = formData[fieldName];
    const validators = config.validators || [];
    const label = config.label || fieldName;

    const error = validateField(value, validators, label);
    if (error) {
      errors[fieldName] = error;
    }
  }

  return errors;
};

/**
 * Check if form has any errors
 */
export const hasErrors = (errors) => {
  return Object.keys(errors).length > 0;
};

// ==========================================
// FORM SCHEMAS
// ==========================================

export const FormSchemas = {
  patient: {
    first_name: { validators: FieldValidators.firstName, label: 'First Name' },
    last_name: { validators: FieldValidators.lastName, label: 'Last Name' },
    phone: { validators: FieldValidators.phone, label: 'Phone Number' },
    date_of_birth: { validators: FieldValidators.dateOfBirth, label: 'Date of Birth' },
    address: { validators: FieldValidators.address, label: 'Address' },
    gender: { validators: [ValidationRules.required], label: 'Gender' },
    blood_group: { validators: [ValidationRules.required], label: 'Blood Group' },
  },

  appointment: {
    patient: { validators: [ValidationRules.required], label: 'Patient' },
    doctor: { validators: [ValidationRules.required], label: 'Doctor' },
    appointment_date: { validators: FieldValidators.appointmentDate, label: 'Appointment Date' },
    appointment_time: { validators: FieldValidators.appointmentTime, label: 'Appointment Time' },
  },

  prescription: {
    appointment: { validators: [ValidationRules.required], label: 'Appointment' },
    symptoms: { validators: FieldValidators.symptoms, label: 'Symptoms' },
    diagnosis: { validators: FieldValidators.diagnosis, label: 'Diagnosis' },
  },

  prescriptionItem: {
    medicine: { validators: [ValidationRules.required], label: 'Medicine' },
    dosage: { validators: FieldValidators.dosage, label: 'Dosage' },
    frequency: { validators: [ValidationRules.required], label: 'Frequency' },
    quantity: { validators: FieldValidators.quantity, label: 'Quantity' },
  },

  medicine: {
    med_name: { validators: [ValidationRules.required, ValidationRules.minLength(2)], label: 'Medicine Name' },
    generic_name: { validators: [ValidationRules.required], label: 'Generic Name' },
    company_name: { validators: [ValidationRules.required], label: 'Company Name' },
  },

  inventory: {
    medicine: { validators: [ValidationRules.required], label: 'Medicine' },
    batch_number: { validators: [ValidationRules.required], label: 'Batch Number' },
    quantity_available: { validators: FieldValidators.quantity, label: 'Quantity' },
    unit_price: { validators: FieldValidators.amount, label: 'Unit Price' },
    expiry_date: { validators: [ValidationRules.required, ValidationRules.validDate], label: 'Expiry Date' },
  },

  labTest: {
    test_name: { validators: [ValidationRules.required, ValidationRules.minLength(3)], label: 'Test Name' },
    test_charge: { validators: FieldValidators.amount, label: 'Test Charge' },
  },

  staff: {
    first_name: { validators: FieldValidators.firstName, label: 'First Name' },
    last_name: { validators: FieldValidators.lastName, label: 'Last Name' },
    email: { validators: [ValidationRules.required, ValidationRules.email], label: 'Email' },
    phone: { validators: FieldValidators.phone, label: 'Phone' },
    role: { validators: [ValidationRules.required], label: 'Role' },
  },
};

// ==========================================
// SANITIZATION
// ==========================================

export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;

  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
};

export const sanitizeFormData = (data) => {
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'object' ? sanitizeFormData(item) : sanitizeInput(item)
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeFormData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

export default {
  ValidationRules,
  FieldValidators,
  FormSchemas,
  validateField,
  validateForm,
  hasErrors,
  sanitizeInput,
  sanitizeFormData,
  // Strict validators — Admin / Staff / Doctor
  validateUsername,
  validateEmail,
  validateIndianPhone,
  validateName,
  validateQualification,
  validateAddress,
  validateSalary,
  validateConsultationFee,
  validateSpecialization,
  validateScheduleDuration,
  // Strict validators — Pharmacist
  validateMedicineName,
  validateCompanyName,
  validateGenericName,
  validateSupplierName,
  validateInventoryUnitPrice,
  validateInventoryQuantity,
  validateInventoryExpiryDate,
};
