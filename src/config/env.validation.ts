import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  DATABASE_SSL: Joi.boolean().default(true),

  SWAGGER_ENABLED: Joi.boolean().default(false),

  ALLOWED_ORIGINS: Joi.string().allow('').default(''),

  NAVER_APIHUB_KEY_ID: Joi.string().required(),
  NAVER_APIHUB_KEY: Joi.string().required(),

  // 개발용 이슈 카드 생성(Gemini)에서만 사용 — 없으면 해당 엔드포인트만 실패
  GOOGLE_API_KEY: Joi.string().allow('').default(''),
  GEMINI_MODEL: Joi.string().allow('').default(''),
});
