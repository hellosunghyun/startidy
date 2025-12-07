import { GoogleGenAI, Type } from "@google/genai";
import type {
  Category,
  ClassificationResult,
  RepoDetail,
  RepoSummary,
} from "../types";
import type { Config } from "../utils/config";
import { buildCategoryPlannerPrompt } from "../prompts/category-planner";
import {
  buildClassifierPrompt,
  buildBatchClassifierPrompt,
  type BatchRepoInfo,
} from "../prompts/classifier";

export interface BatchClassificationResult {
  id: string;
  categories: string[];
}

export class GeminiService {
  private ai: GoogleGenAI;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }

  /**
   * Plans categories based on the starred repositories
   */
  async planCategories(repos: RepoSummary[]): Promise<Category[]> {
    const prompt = buildCategoryPlannerPrompt(repos, this.config);

    // Structured Output Schema for category planning
    const categorySchema = {
      type: Type.OBJECT,
      properties: {
        categories: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: {
                type: Type.STRING,
                description: "카테고리 이름 (최대 20자, 대분류: 소분류 형식)",
              },
              description: {
                type: Type.STRING,
                description: "카테고리 설명",
              },
            },
            required: ["name", "description"],
            propertyOrdering: ["name", "description"],
          },
        },
      },
      required: ["categories"],
    };

    const response = await this.ai.models.generateContent({
      model: this.config.geminiModel,
      contents: prompt,
      config: {
        temperature: this.config.geminiTemperaturePlanning,
        maxOutputTokens: this.config.geminiMaxTokensPlanning,
        responseMimeType: "application/json",
        responseSchema: categorySchema,
      },
    });

    const text = response.text || "";

    if (this.config.logApiResponses) {
      console.log("\n[DEBUG] Gemini Planning Response:", text);
    }

    try {
      const parsed = JSON.parse(text);
      const categories = parsed.categories.map((c: { name: string; description: string }) => ({
        name: c.name || "Unnamed",
        description: c.description || "",
        keywords: [],
      }));

      if (categories.length !== this.config.maxCategories) {
        console.warn(
          `Warning: Expected ${this.config.maxCategories} categories, got ${categories.length}`,
        );
      }

      return categories;
    } catch (error) {
      console.error("Failed to parse category response:", error);
      if (this.config.debug) {
        console.error("Raw response:", text);
      }
      throw new Error("Failed to parse Gemini category response");
    }
  }

  /**
   * Classifies multiple repositories at once (batch)
   * Returns a map of repo id -> categories
   */
  async classifyRepositoriesBatch(
    repos: BatchRepoInfo[],
    categories: Category[],
  ): Promise<Map<string, string[]>> {
    const prompt = buildBatchClassifierPrompt(repos, categories, this.config);

    // Structured Output Schema for batch classification
    const classifySchema = {
      type: Type.OBJECT,
      properties: {
        results: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: {
                type: Type.STRING,
                description: "저장소 ID (owner/name 형식)",
              },
              categories: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                },
                description: "선택된 카테고리 이름들",
              },
            },
            required: ["id", "categories"],
            propertyOrdering: ["id", "categories"],
          },
        },
      },
      required: ["results"],
    };

    const response = await this.ai.models.generateContent({
      model: this.config.geminiModel,
      contents: prompt,
      config: {
        temperature: this.config.geminiTemperatureClassify,
        maxOutputTokens: this.config.geminiMaxTokensClassify,
        responseMimeType: "application/json",
        responseSchema: classifySchema,
      },
    });

    const text = response.text || "";

    if (this.config.logApiResponses) {
      console.log("\n[DEBUG] Gemini Classify Response:", text);
    }

    return this.parseBatchClassifierResponse(text, repos, categories);
  }

  /**
   * Classifies a single repository into one or more categories (fallback)
   */
  async classifyRepository(
    repo: RepoDetail,
    categories: Category[],
  ): Promise<ClassificationResult> {
    const prompt = buildClassifierPrompt(repo, categories, this.config);

    // Structured Output Schema for single classification
    const singleClassifySchema = {
      type: Type.OBJECT,
      properties: {
        categories: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
          description: "선택된 카테고리 이름들",
        },
      },
      required: ["categories"],
    };

    const response = await this.ai.models.generateContent({
      model: this.config.geminiModel,
      contents: prompt,
      config: {
        temperature: this.config.geminiTemperatureClassify,
        maxOutputTokens: 512,
        responseMimeType: "application/json",
        responseSchema: singleClassifySchema,
      },
    });

    const text = response.text || "";

    if (this.config.logApiResponses) {
      console.log("\n[DEBUG] Gemini Single Classify Response:", text);
    }

    return this.parseClassifierResponse(text, categories);
  }

  private parseBatchClassifierResponse(
    text: string,
    repos: BatchRepoInfo[],
    categories: Category[],
  ): Map<string, string[]> {
    const resultMap = new Map<string, string[]>();
    const validCategoryNames = new Set(categories.map((c) => c.name));
    const defaultCategory = categories[0]?.name || "Lang: ETC";

    try {
      let jsonStr = text.trim();

      // 잘린 JSON 복구 시도
      if (!jsonStr.endsWith("}")) {
        const openBraces = (jsonStr.match(/\{/g) || []).length;
        const closeBraces = (jsonStr.match(/\}/g) || []).length;
        const openBrackets = (jsonStr.match(/\[/g) || []).length;
        const closeBrackets = (jsonStr.match(/\]/g) || []).length;

        // 마지막 완전한 객체까지만 파싱하기 위해 불완전한 부분 제거
        const lastCompleteIdx = jsonStr.lastIndexOf("}");
        if (lastCompleteIdx > 0) {
          // 마지막 완전한 객체 뒤의 불완전한 부분 제거
          const afterLast = jsonStr.slice(lastCompleteIdx + 1);
          if (afterLast.includes("{") && !afterLast.includes("}")) {
            jsonStr = jsonStr.slice(0, lastCompleteIdx + 1);
          }
        }

        // 부족한 괄호 추가
        jsonStr += "]".repeat(Math.max(0, openBrackets - closeBrackets));
        jsonStr += "}".repeat(Math.max(0, openBraces - closeBraces));
      }

      const parsed = JSON.parse(jsonStr);

      if (!parsed.results || !Array.isArray(parsed.results)) {
        throw new Error("Invalid response structure");
      }

      for (const result of parsed.results) {
        if (!result.id || !Array.isArray(result.categories)) continue;

        const validCategories = result.categories
          .filter((c: string) => validCategoryNames.has(c))
          .slice(0, this.config.maxCategoriesPerRepo);

        resultMap.set(
          result.id,
          validCategories.length > 0 ? validCategories : [defaultCategory],
        );
      }

      // 응답에 없는 repo는 기본값
      for (const repo of repos) {
        if (!resultMap.has(repo.id)) {
          resultMap.set(repo.id, [defaultCategory]);
        }
      }
    } catch (error) {
      console.error("Failed to parse batch classifier response:", error);
      if (this.config.debug) {
        console.error("Raw response:", text);
      }

      // 파싱 실패 시 개별 패턴 추출 시도
      const linePattern = /"id"\s*:\s*"([^"]+)"[^}]*"categories"\s*:\s*\[([^\]]*)\]/g;
      let match;
      while ((match = linePattern.exec(text)) !== null) {
        const id = match[1];
        const categoriesStr = match[2];
        const cats = categoriesStr
          .split(",")
          .map((s) => s.trim().replace(/"/g, ""))
          .filter((c) => validCategoryNames.has(c))
          .slice(0, this.config.maxCategoriesPerRepo);

        if (cats.length > 0 && !resultMap.has(id)) {
          resultMap.set(id, cats);
        }
      }

      // 여전히 없는 repo는 기본값
      for (const repo of repos) {
        if (!resultMap.has(repo.id)) {
          resultMap.set(repo.id, [defaultCategory]);
        }
      }
    }

    return resultMap;
  }

  private parseClassifierResponse(
    text: string,
    categories: Category[],
  ): ClassificationResult {
    try {
      // Structured Output이므로 바로 JSON 파싱
      const parsed = JSON.parse(text.trim());

      if (!parsed.categories || !Array.isArray(parsed.categories)) {
        throw new Error("Invalid response structure");
      }

      const validCategoryNames = new Set(categories.map((c) => c.name));
      const validatedCategories = parsed.categories
        .filter((c: string) => validCategoryNames.has(c))
        .slice(0, this.config.maxCategoriesPerRepo);

      if (validatedCategories.length === 0) {
        validatedCategories.push(categories[0].name);
      }

      return {
        categories: validatedCategories,
        reason: "",
      };
    } catch (error) {
      console.error("Failed to parse classifier response:", error);
      if (this.config.debug) {
        console.error("Raw response:", text);
      }
      return {
        categories: [categories[0].name],
        reason: "Parsing failed, using default category",
      };
    }
  }
}
