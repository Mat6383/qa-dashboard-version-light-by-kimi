declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      name: string;
      avatar: string | null;
      role: string;
    }

    interface Request {
      requestId?: string;
      user?: User;
      startTime?: number;
    }
  }
}

export {};
