import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/client';
import { sendInternalError } from '../utils/http';

const ACCESS_TOKEN_TTL_MINUTES = 15;
const REFRESH_TOKEN_TTL_DAYS = 30;

const createAccessToken = (userId: string) =>
  jwt.sign(
    { userId },
    process.env.JWT_ACCESS_SECRET || 'access_secret',
    { expiresIn: `${ACCESS_TOKEN_TTL_MINUTES}m` }
  );

const createRefreshToken = (userId: string) =>
  jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET || 'refresh_secret',
    { expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d` }
  );

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Поля email, password и name обязательны',
        },
      });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_IN_USE',
          message: 'Пользователь с таким email уже существует',
        },
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    return sendInternalError(res, 'Внутренняя ошибка сервера', error);
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Поля email и password обязательны',
        },
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Неверный email или пароль',
        },
      });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Неверный email или пароль',
        },
      });
    }

    const accessToken = createAccessToken(user.id);
    const refreshToken = createRefreshToken(user.id);

    return res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
    });
  } catch (error) {
    return sendInternalError(res, 'Внутренняя ошибка сервера', error);
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Поле refreshToken обязательно',
        },
      });
    }

    const payload = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'refresh_secret'
    ) as { userId: string };

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Недействительный refresh token',
        },
      });
    }

    const accessToken = createAccessToken(user.id);

    return res.json({
      success: true,
      data: {
        accessToken,
      },
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Refresh token просрочен или недействителен',
      },
    });
  }
};

export const logout = async (_req: Request, res: Response) => {
  return res.json({
    success: true,
    data: {
      message: 'Выход выполнен',
    },
  });
};

