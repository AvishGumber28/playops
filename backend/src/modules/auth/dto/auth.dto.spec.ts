import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SignupDto } from './signup.dto';
import { LoginDto } from './login.dto';

describe('SignupDto', () => {
  it('rejects a missing name', async () => {
    const dto = plainToInstance(SignupDto, {
      email: 'riya@college.edu',
      password: 'password123',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects an invalid email', async () => {
    const dto = plainToInstance(SignupDto, {
      name: 'Riya',
      email: 'not-an-email',
      password: 'password123',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a password under 8 characters', async () => {
    const dto = plainToInstance(SignupDto, {
      name: 'Riya',
      email: 'riya@college.edu',
      password: 'short',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('accepts valid input', async () => {
    const dto = plainToInstance(SignupDto, {
      name: 'Riya',
      email: 'riya@college.edu',
      password: 'password123',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  // D-012: self-reported, optional.
  it('accepts valid input with rollNumber and photoUrl included', async () => {
    const dto = plainToInstance(SignupDto, {
      name: 'Riya',
      email: 'riya@college.edu',
      password: 'password123',
      rollNumber: '2022CSB1042',
      photoUrl: 'https://example.com/riya.jpg',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('LoginDto', () => {
  it('rejects a missing password', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'riya@college.edu',
      password: '',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('accepts valid input', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'riya@college.edu',
      password: 'anything',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
