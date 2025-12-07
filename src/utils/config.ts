export interface Config {
  // Required credentials
  githubToken: string;
  githubUsername: string;
  geminiApiKey: string;

  // Category settings
  maxCategories: number; // 최대 카테고리 수 (기본: 32, GitHub 제한)
  maxCategoriesPerRepo: number; // 저장소당 최대 카테고리 수 (기본: 3)
  minCategoriesPerRepo: number; // 저장소당 최소 카테고리 수 (기본: 1)

  // Batch processing settings
  classifyBatchSize: number; // Gemini 분류 배치 크기 (기본: 20)
  readmeBatchSize: number; // README 조회 동시 요청 수 (기본: 20)
  listCreateDelay: number; // List 생성 간 딜레이 ms (기본: 500)
  batchDelay: number; // 배치 간 딜레이 ms (기본: 2000)

  // Rate limiting
  geminiRpm: number; // Gemini API 분당 요청 제한 (기본: 15)
  githubRequestDelay: number; // GitHub API 요청 간 딜레이 ms (기본: 100)

  // Gemini model settings
  geminiModel: string; // Gemini 모델 (기본: gemini-2.0-flash)
  geminiTemperaturePlanning: number; // 카테고리 기획 temperature (기본: 0.7)
  geminiTemperatureClassify: number; // 분류 temperature (기본: 0.3)
  geminiMaxTokensPlanning: number; // 카테고리 기획 max tokens (기본: 65536)
  geminiMaxTokensClassify: number; // 분류 max tokens (기본: 65536)

  // README settings
  readmeMaxLength: number; // README 최대 길이 (기본: 500, 배치용)
  readmeMaxLengthSingle: number; // 단일 분류 시 README 최대 길이 (기본: 2000)

  // List settings
  listIsPrivate: boolean; // 생성되는 List 비공개 여부 (기본: false)
  listNameMaxLength: number; // List 이름 최대 길이 (기본: 20)

  // Retry settings
  maxRetries: number; // 최대 재시도 횟수 (기본: 3)
  retryDelay: number; // 재시도 간 딜레이 ms (기본: 1000)

  // Debug settings
  debug: boolean; // 디버그 모드 (기본: false)
  logApiResponses: boolean; // API 응답 로깅 (기본: false)
}

function parseIntEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseFloatEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseBoolEnv(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

export function loadConfig(): Config {
  const githubToken = process.env.GITHUB_TOKEN;
  const githubUsername = process.env.GITHUB_USERNAME;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!githubToken) {
    throw new Error(
      "GITHUB_TOKEN 환경 변수가 필요합니다. .env 파일을 확인하세요.",
    );
  }

  if (!githubUsername) {
    throw new Error(
      "GITHUB_USERNAME 환경 변수가 필요합니다. .env 파일을 확인하세요.",
    );
  }

  if (!geminiApiKey) {
    throw new Error(
      "GEMINI_API_KEY 환경 변수가 필요합니다. .env 파일을 확인하세요.",
    );
  }

  return {
    // Required credentials
    githubToken,
    githubUsername,
    geminiApiKey,

    // Category settings
    maxCategories: parseIntEnv("MAX_CATEGORIES", 32),
    maxCategoriesPerRepo: parseIntEnv("MAX_CATEGORIES_PER_REPO", 3),
    minCategoriesPerRepo: parseIntEnv("MIN_CATEGORIES_PER_REPO", 1),

    // Batch processing settings
    classifyBatchSize: parseIntEnv("CLASSIFY_BATCH_SIZE", 20),
    readmeBatchSize: parseIntEnv("README_BATCH_SIZE", 20),
    listCreateDelay: parseIntEnv("LIST_CREATE_DELAY", 500),
    batchDelay: parseIntEnv("BATCH_DELAY", 2000),

    // Rate limiting
    geminiRpm: parseIntEnv("GEMINI_RPM", 15),
    githubRequestDelay: parseIntEnv("GITHUB_REQUEST_DELAY", 100),

    // Gemini model settings
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    geminiTemperaturePlanning: parseFloatEnv("GEMINI_TEMPERATURE_PLANNING", 0.7),
    geminiTemperatureClassify: parseFloatEnv("GEMINI_TEMPERATURE_CLASSIFY", 0.3),
    geminiMaxTokensPlanning: parseIntEnv("GEMINI_MAX_TOKENS_PLANNING", 65536),
    geminiMaxTokensClassify: parseIntEnv("GEMINI_MAX_TOKENS_CLASSIFY", 65536),

    // README settings
    readmeMaxLength: parseIntEnv("README_MAX_LENGTH", 10000),
    readmeMaxLengthSingle: parseIntEnv("README_MAX_LENGTH_SINGLE", 10000),

    // List settings
    listIsPrivate: parseBoolEnv("LIST_IS_PRIVATE", false),
    listNameMaxLength: parseIntEnv("LIST_NAME_MAX_LENGTH", 20),

    // Retry settings
    maxRetries: parseIntEnv("MAX_RETRIES", 3),
    retryDelay: parseIntEnv("RETRY_DELAY", 1000),

    // Debug settings
    debug: parseBoolEnv("DEBUG", false),
    logApiResponses: parseBoolEnv("LOG_API_RESPONSES", false),
  };
}

// Singleton config instance
let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

export function resetConfig(): void {
  configInstance = null;
}
