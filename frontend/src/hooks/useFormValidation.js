import { useState, useCallback, useMemo } from "react";
import { validateForm, hasErrors, sanitizeFormData, FormSchemas } from "@/utils/validation";

/**
 * Custom hook for form validation with real-time feedback
 * 
 * Usage:
 * const { values, errors, handleChange, handleBlur, validate, isValid, resetForm } = useFormValidation(
 *   { first_name: "", last_name: "" },
 *   FormSchemas.patient
 * );
 */
export function useFormValidation(initialValues, schema) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate single field
  const validateField = useCallback((name, value) => {
    if (!schema[name]) return null;
    
    const fieldSchema = schema[name];
    const validators = fieldSchema.validators || [];
    const label = fieldSchema.label || name;
    
    for (const validator of validators) {
      const error = validator(value, label);
      if (error) return error;
    }
    return null;
  }, [schema]);

  // Handle input change with real-time validation
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === "checkbox" ? checked : value;
    
    setValues(prev => ({ ...prev, [name]: newValue }));
    
    // Only validate if field has been touched
    if (touched[name]) {
      const error = validateField(name, newValue);
      setErrors(prev => ({
        ...prev,
        [name]: error
      }));
    }
  }, [touched, validateField]);

  // Handle blur - trigger validation
  const handleBlur = useCallback((e) => {
    const { name, value } = e.target;
    
    setTouched(prev => ({ ...prev, [name]: true }));
    
    const error = validateField(name, value);
    setErrors(prev => ({
      ...prev,
      [name]: error
    }));
  }, [validateField]);

  // Validate entire form
  const validate = useCallback(() => {
    const allErrors = validateForm(values, schema);
    setErrors(allErrors);
    
    // Mark all fields as touched
    const allTouched = Object.keys(schema).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {});
    setTouched(allTouched);
    
    return !hasErrors(allErrors);
  }, [values, schema]);

  // Check if form is valid (no errors and all required touched)
  const isValid = useMemo(() => {
    return !hasErrors(errors);
  }, [errors]);

  // Reset form
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  // Set single value programmatically
  const setValue = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
  }, []);

  // Set multiple values
  const setMultipleValues = useCallback((newValues) => {
    setValues(prev => ({ ...prev, ...newValues }));
  }, []);

  // Get sanitized form data
  const getSanitizedData = useCallback(() => {
    return sanitizeFormData(values);
  }, [values]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    setIsSubmitting,
    handleChange,
    handleBlur,
    validate,
    isValid,
    resetForm,
    setValue,
    setMultipleValues,
    getSanitizedData,
  };
}

/**
 * Hook for handling async form submission
 */
export function useFormSubmit(onSubmit, { onSuccess, onError } = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(async (data) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await onSubmit(data);
      setSuccess(true);
      onSuccess?.(result);
      return result;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.errors || 
                          err.message || 
                          "An error occurred";
      setError(errorMessage);
      onError?.(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [onSubmit, onSuccess, onError]);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setSuccess(false);
  }, []);

  return {
    loading,
    error,
    success,
    handleSubmit,
    reset,
  };
}

export default useFormValidation;
