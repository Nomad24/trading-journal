import { Response } from 'express';

export const sendInternalError = (res: Response, message: string, error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error);

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message,
    },
  });
};