import './setup.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tsundere } from '../src/personalities/tsundere.js';
import { buildSystemPrompt, GLOBAL_SAFETY_RULES } from '../src/core/actions.js';

describe('Safety Rules in Persona & Prompt (F-05)', () => {
  it('system prompt Mika memiliki aturan keselamatan krisis dan hotline resmi', () => {
    const prompt = tsundere.systemPrompt;

    assert.ok(prompt.includes('Safety & Crisis Rules'));
    assert.ok(prompt.includes('STOP ALL tsundere acting') || prompt.includes('STOP ALL persona acting'));
    assert.ok(prompt.includes('Hotline SEJIWA Kemenkes RI: Telepon 119 (ekstensi 8)'));
    assert.ok(prompt.includes('Halo Kemenkes: 1500-567'));
    assert.ok(prompt.includes('Layanan Darurat Nasional: 112'));
  });

  it('system prompt Mika memiliki batasan medis (tanpa diagnosis / resep dosis)', () => {
    const prompt = tsundere.systemPrompt;

    assert.ok(prompt.includes('Batasan Medis'));
    assert.ok(prompt.includes('diagnoses'));
    assert.ok(prompt.includes('medications') || prompt.includes('dosages'));
  });

  it('system prompt Mika memiliki contoh dialog penanganan krisis dan pertanyaan medis', () => {
    const prompt = tsundere.systemPrompt;

    assert.ok(prompt.includes('end everything'));
    assert.ok(prompt.includes('medicine') || prompt.includes('pills'));
  });

  it('buildSystemPrompt otomatis menyisipkan aturan keselamatan jika persona belum memilikinya', () => {
    const blankPersona = { systemPrompt: 'You are a simple helper bot.' };
    const ctx = { chat: { type: 'private', id: 1 }, from: { id: 1, first_name: 'Test' } };

    const built = buildSystemPrompt({ persona: blankPersona, ctx });

    assert.ok(built.includes(GLOBAL_SAFETY_RULES));
    assert.ok(built.includes('119 (ekstensi 8)'));
  });
});

