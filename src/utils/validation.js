/**
 * validation.js
 * Input validation utilities for passenger details forms.
 * Handles edge cases for keyboard input, touch, and submission.
 */

// Name regex: Allows letters (including Unicode/accented letters), spaces, hyphens, apostrophes, periods (for titles)
// Rejects digits, HTML tags, script tags, SQL symbols, special chars.
const NAME_REGEX = /^[A-Za-z\u00C0-\u024F\u1E00-\u1EFF\s'\-\.]+$/;

// Phone regex: Digits, optional leading +, spaces, hyphens, parentheses
const PHONE_REGEX = /^\+?[0-9\s\-\(\)]+$/;

// Standard email regex
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

/**
 * Validates a first name or given name field.
 * @param {string} firstName 
 * @returns {string|null} Error message or null if valid
 */
export function validateFirstName(firstName) {
  if (!firstName || typeof firstName !== 'string') {
    return 'First name is required.';
  }
  const trimmed = firstName.trim();
  if (trimmed.length === 0) {
    return 'First name cannot be blank or spaces only.';
  }
  if (trimmed.length < 2) {
    return 'First name must be at least 2 characters.';
  }
  if (trimmed.length > 50) {
    return 'First name cannot exceed 50 characters.';
  }
  if (!NAME_REGEX.test(trimmed)) {
    if (/<[^>]*>/.test(trimmed) || /script/i.test(trimmed)) {
      return 'First name contains invalid or unsafe characters.';
    }
    if (/\d/.test(trimmed)) {
      return 'First name cannot contain numbers.';
    }
    return 'First name can only contain letters, hyphens, spaces, and apostrophes.';
  }
  if (/[\-\'\s]{2,}/.test(trimmed)) {
    return 'First name cannot contain consecutive spaces, hyphens, or apostrophes.';
  }
  return null;
}

/**
 * Validates a last name or surname field.
 * @param {string} lastName 
 * @returns {string|null} Error message or null if valid
 */
export function validateLastName(lastName) {
  if (!lastName || typeof lastName !== 'string') {
    return 'Last name is required.';
  }
  const trimmed = lastName.trim();
  if (trimmed.length === 0) {
    return 'Last name cannot be blank or spaces only.';
  }
  if (trimmed.length < 2) {
    return 'Last name must be at least 2 characters.';
  }
  if (trimmed.length > 50) {
    return 'Last name cannot exceed 50 characters.';
  }
  if (!NAME_REGEX.test(trimmed)) {
    if (/<[^>]*>/.test(trimmed) || /script/i.test(trimmed)) {
      return 'Last name contains invalid or unsafe characters.';
    }
    if (/\d/.test(trimmed)) {
      return 'Last name cannot contain numbers.';
    }
    return 'Last name can only contain letters, hyphens, spaces, and apostrophes.';
  }
  if (/[\-\'\s]{2,}/.test(trimmed)) {
    return 'Last name cannot contain consecutive spaces, hyphens, or apostrophes.';
  }
  return null;
}

/**
 * Validates a phone number field.
 * @param {string} phone 
 * @returns {string|null} Error message or null if valid
 */
export function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return 'Phone number is required.';
  }
  const trimmed = phone.trim();
  if (trimmed.length === 0) {
    return 'Phone number cannot be blank or spaces only.';
  }
  if (!PHONE_REGEX.test(trimmed)) {
    if (/[a-zA-Z]/.test(trimmed)) {
      return 'Phone number cannot contain letters.';
    }
    return 'Phone number contains invalid characters.';
  }
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length < 7) {
    return 'Phone number must contain at least 7 digits.';
  }
  if (digitsOnly.length > 15) {
    return 'Phone number cannot exceed 15 digits.';
  }
  return null;
}

/**
 * Validates an email address field.
 * @param {string} email 
 * @returns {string|null} Error message or null if valid
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return 'Email address is required.';
  }
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return 'Email address cannot be blank.';
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return 'Please enter a valid email address (e.g. name@example.com).';
  }
  return null;
}

/**
 * Validates nationality field.
 * @param {string} nationality 
 * @returns {string|null} Error message or null if valid
 */
export function validateNationality(nationality) {
  if (!nationality || typeof nationality !== 'string' || !nationality.trim()) {
    return 'Please select or enter a nationality.';
  }
  return null;
}

/**
 * Sanitizes input string to remove harmful XSS characters on keyboard input.
 * @param {string} val 
 * @returns {string} Cleaned string
 */
export function sanitizeInput(val) {
  if (!val) return '';
  return val.replace(/<[^>]*>?/gm, '').replace(/[<>]/g, '');
}

/**
 * Comprehensive passenger object validator.
 * @param {object} passenger { firstName, lastName, phone, nationality, email }
 * @returns {{ isValid: boolean, errors: Record<string, string> }}
 */
export function validatePassenger(passenger = {}) {
  const errors = {};

  const fnErr = validateFirstName(passenger.firstName);
  if (fnErr) errors.firstName = fnErr;

  const lnErr = validateLastName(passenger.lastName);
  if (lnErr) errors.lastName = lnErr;

  const phErr = validatePhone(passenger.phone);
  if (phErr) errors.phone = phErr;

  const natErr = validateNationality(passenger.nationality);
  if (natErr) errors.nationality = natErr;

  if (passenger.email !== undefined && passenger.email !== '') {
    const emailErr = validateEmail(passenger.email);
    if (emailErr) errors.email = emailErr;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
