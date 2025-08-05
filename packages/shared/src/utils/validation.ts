import { z } from 'zod';

export const isValidEmail = (email: string): boolean => {
  const emailSchema = z.string().email();
  return emailSchema.safeParse(email).success;
};

export const isValidURL = (url: string): boolean => {
  const urlSchema = z.string().url();
  return urlSchema.safeParse(url).success;
};

export const isValidUUID = (uuid: string): boolean => {
  const uuidSchema = z.string().uuid();
  return uuidSchema.safeParse(uuid).success;
};

export const isValidSKU = (sku: string): boolean => {
  const skuPattern = /^[A-Z]{3}-\d{3}$/;
  return skuPattern.test(sku);
};

export const isValidPhoneNumber = (phone: string): boolean => {
  const phonePattern = /^\+?[\d\s\-\(\)]+$/;
  return phonePattern.test(phone) && phone.replace(/\D/g, '').length >= 10;
};

export const isValidPostalCode = (postalCode: string, country = 'US'): boolean => {
  const patterns = {
    US: /^\d{5}(-\d{4})?$/,
    CA: /^[A-Z]\d[A-Z] \d[A-Z]\d$/,
    UK: /^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/,
  };

  const pattern = patterns[country as keyof typeof patterns];
  return pattern ? pattern.test(postalCode.toUpperCase()) : true;
};

export const validatePassword = (
  password: string
): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
};

export const validateFileType = (filename: string, allowedTypes: string[]): boolean => {
  const extension = filename.split('.').pop()?.toLowerCase();
  return extension ? allowedTypes.includes(extension) : false;
};

export const validateFileSize = (size: number, maxSizeInMB: number): boolean => {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  return size <= maxSizeInBytes;
};

export const validateQuantity = (quantity: number): boolean => {
  return Number.isInteger(quantity) && quantity >= 0;
};

export const validatePrice = (price: number): boolean => {
  return typeof price === 'number' && price >= 0 && Number.isFinite(price);
};

export const validateDateRange = (startDate: Date, endDate: Date): boolean => {
  return startDate <= endDate;
};
