import { z, validate, validateParams, validateBody, validateQuery } from '../validators';

describe('Validators', () => {
  const mockRes = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };
  const mockNext = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('passe next si schema valide', () => {
      const schema = z.object({ body: z.object({ name: z.string() }) });
      const middleware = validate(schema);
      const req = { body: { name: 'test' } };
      const res = mockRes();
      middleware(req, res, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('retourne 400 si schema invalide', () => {
      const schema = z.object({ body: z.object({ name: z.string() }) });
      const middleware = validate(schema);
      const req = { body: { name: 123 } };
      const res = mockRes();
      middleware(req, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });
  });

  describe('validateParams', () => {
    it('passe next si params valide', () => {
      const schema = z.object({ id: z.string() });
      const middleware = validateParams(schema);
      const req = { params: { id: '42' } };
      const res = mockRes();
      middleware(req, res, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('retourne 400 si params invalide', () => {
      const schema = z.object({ id: z.string().min(1) });
      const middleware = validateParams(schema);
      const req = { params: { id: '' } };
      const res = mockRes();
      middleware(req, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('validateBody', () => {
    it('passe next si body valide', () => {
      const schema = z.object({ email: z.string().email() });
      const middleware = validateBody(schema);
      const req = { body: { email: 'a@b.com' } };
      const res = mockRes();
      middleware(req, res, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('retourne 400 si body invalide', () => {
      const schema = z.object({ email: z.string().email() });
      const middleware = validateBody(schema);
      const req = { body: { email: 'invalid' } };
      const res = mockRes();
      middleware(req, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('validateQuery', () => {
    it('passe next si query valide', () => {
      const schema = z.object({ page: z.string() });
      const middleware = validateQuery(schema);
      const req = { query: { page: '1' } };
      const res = mockRes();
      middleware(req, res, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('retourne 400 si query invalide', () => {
      const schema = z.object({ page: z.string().min(1) });
      const middleware = validateQuery(schema);
      const req = { query: { page: '' } };
      const res = mockRes();
      middleware(req, res, mockNext);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
