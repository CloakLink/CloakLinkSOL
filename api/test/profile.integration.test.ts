import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

const solAddress = 'H3UuEhEDuJeayQM2ngiZX6hgqPdh9vywgqbiZ9erjRzG';

vi.mock('../src/prisma.js', () => {
  const create = vi.fn();
  return {
    prisma: {
      profile: { create },
    },
  };
});

import { app } from '../src/server.js';
import { prisma } from '../src/prisma.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Profile creation (Solana)', () => {
  it('accepts a valid Solana address payload', async () => {
    const alias = `sol-tester-${Date.now()}`;
    const createMock = prisma.profile.create as unknown as ReturnType<typeof vi.fn>;
    createMock.mockResolvedValue({
      id: 'test-id',
      alias,
      receiveAddress: solAddress,
      defaultChain: 'solana',
      avatarUrl: null,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app).post('/profiles').send({
      alias,
      receiveAddress: solAddress,
      defaultChain: 'solana',
    });

    expect(res.status).toBe(201);
    expect(res.body.receiveAddress).toBe(solAddress);
  });
});
