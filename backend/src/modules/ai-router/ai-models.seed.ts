import { DataSource } from 'typeorm';

import { AiModel } from './entities/ai-model.entity';

export async function seedAIModels(dataSource: DataSource): Promise<void> {
  const repository = dataSource.getRepository(AiModel);

  await repository.upsert(
    [
      {
        provider: 'GOOGLE',
        modelString: 'gemini-2.5-flash-lite',
        versionLabel: 'Gemini 2.5 Flash-Lite',
        priceInputPerM: 0,
        priceOutputPerM: 0,
        freeTierLimit: 1000,
        freeTierTokensDay: 250000,
        isActive: true,
        isPrimary: true,
      },
      {
        provider: 'GOOGLE',
        modelString: 'gemini-2.5-flash',
        versionLabel: 'Gemini 2.5 Flash',
        priceInputPerM: 0.075,
        priceOutputPerM: 0.3,
        freeTierLimit: 250,
        freeTierTokensDay: 250000,
        isActive: true,
        isPrimary: false,
      },
      {
        provider: 'GOOGLE',
        modelString: 'gemini-2.5-pro',
        versionLabel: 'Gemini 2.5 Pro',
        priceInputPerM: 1.25,
        priceOutputPerM: 10,
        freeTierLimit: 100,
        freeTierTokensDay: 250000,
        isActive: true,
        isPrimary: false,
      },
      {
        provider: 'ANTHROPIC',
        modelString: 'claude-haiku-4-5',
        versionLabel: 'Claude Haiku 4.5',
        priceInputPerM: 0.25,
        priceOutputPerM: 1.25,
        freeTierLimit: null,
        freeTierTokensDay: null,
        isActive: false,
        isPrimary: false,
      },
      {
        provider: 'ANTHROPIC',
        modelString: 'claude-sonnet-4-6',
        versionLabel: 'Claude Sonnet 4.6',
        priceInputPerM: 3,
        priceOutputPerM: 15,
        freeTierLimit: null,
        freeTierTokensDay: null,
        isActive: false,
        isPrimary: false,
      },
      {
        provider: 'OPENAI',
        modelString: 'gpt-5-nano',
        versionLabel: 'GPT-5 Nano',
        priceInputPerM: 0.05,
        priceOutputPerM: 0.4,
        freeTierLimit: null,
        freeTierTokensDay: null,
        isActive: false,
        isPrimary: false,
      },
      {
        provider: 'OPENAI',
        modelString: 'gpt-5-mini',
        versionLabel: 'GPT-5 Mini',
        priceInputPerM: 0.25,
        priceOutputPerM: 2,
        freeTierLimit: null,
        freeTierTokensDay: null,
        isActive: false,
        isPrimary: false,
      },
    ],
    ['modelString'],
  );
}
