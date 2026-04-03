import { validationResult } from "express-validator";

export function validate(validations) {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const errorMessages = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));

    const error = new Error("Validation failed");
    error.statusCode = 400;
    error.details = errorMessages;
    return next(error);
  };
}
