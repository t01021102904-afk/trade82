export type ProductEnglishTranslationPayload = {
  name: string;
  shortDescription: string;
  detailedDescription: string;
  buyerNotes: string;
  tags: string[];
};

export type CompanyEnglishTranslationPayload = {
  companyName: string;
  description: string;
  exportExperience: string;
};

export type ProductEnglishTranslationResult = {
  nameEn: string;
  shortDescriptionEn: string;
  detailedDescriptionEn: string;
  buyerNotesEn: string;
  tagsEn: string[];
};

export type CompanyEnglishTranslationResult = {
  displayNameEn: string;
  descriptionEn: string;
  exportExperienceEn: string;
};

type TranslationRequest =
  | { type: "product"; payload: ProductEnglishTranslationPayload }
  | { type: "company"; payload: CompanyEnglishTranslationPayload };

type TranslationResult =
  | ProductEnglishTranslationResult
  | CompanyEnglishTranslationResult;

export class TranslationProviderMissingError extends Error {
  constructor() {
    super("English translation is not configured. Add OPENAI_API_KEY on the server.");
  }
}

export class TranslationProviderError extends Error {
  constructor(message = "English translation failed. Please try again.") {
    super(message);
  }
}

const TRANSLATION_SYSTEM_PROMPT =
  "Translate Korean seller-entered B2B marketplace content into natural, professional English for global wholesale buyers. Preserve brand names, company names, ingredient names, certifications, model numbers, HS codes, sizes, quantities, SKUs, and proper nouns. Do not add unsupported claims. For cosmetics, avoid cure, treat, heal, guaranteed results, or medical claims. For food and supplements, avoid disease-treatment claims. Keep the translation faithful, concise, export-facing, and suitable for Trade82.";

const PRODUCT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    nameEn: { type: "string" },
    shortDescriptionEn: { type: "string" },
    detailedDescriptionEn: { type: "string" },
    buyerNotesEn: { type: "string" },
    tagsEn: {
      type: "array",
      items: { type: "string" },
      maxItems: 10,
    },
  },
  required: [
    "nameEn",
    "shortDescriptionEn",
    "detailedDescriptionEn",
    "buyerNotesEn",
    "tagsEn",
  ],
};

const COMPANY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    displayNameEn: { type: "string" },
    descriptionEn: { type: "string" },
    exportExperienceEn: { type: "string" },
  },
  required: ["displayNameEn", "descriptionEn", "exportExperienceEn"],
};

export function hasTranslatableProductContent(
  payload: ProductEnglishTranslationPayload,
) {
  return Boolean(
    payload.name.trim() ||
      payload.shortDescription.trim() ||
      payload.detailedDescription.trim() ||
      payload.buyerNotes.trim() ||
      payload.tags.some((tag) => tag.trim()),
  );
}

export function hasTranslatableCompanyContent(
  payload: CompanyEnglishTranslationPayload,
) {
  return Boolean(
    payload.companyName.trim() ||
      payload.description.trim() ||
      payload.exportExperience.trim(),
  );
}

export async function generateEnglishTranslation(
  request: TranslationRequest,
): Promise<TranslationResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new TranslationProviderMissingError();

  if (
    request.type === "product" &&
    !hasTranslatableProductContent(request.payload)
  ) {
    throw new TranslationProviderError("Add Korean product content before generating English.");
  }
  if (
    request.type === "company" &&
    !hasTranslatableCompanyContent(request.payload)
  ) {
    throw new TranslationProviderError("Add Korean company content before generating English.");
  }

  const model = process.env.OPENAI_TRANSLATION_MODEL?.trim() || "gpt-5-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: TRANSLATION_SYSTEM_PROMPT,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildTranslationPrompt(request),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name:
            request.type === "product"
              ? "trade82_product_english_translation"
              : "trade82_company_english_translation",
          strict: true,
          schema: request.type === "product" ? PRODUCT_SCHEMA : COMPANY_SCHEMA,
        },
      },
      store: false,
      max_output_tokens: request.type === "product" ? 1400 : 900,
    }),
  });

  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const message = providerErrorMessage(body);
    console.warn("OpenAI translation request failed.", {
      status: response.status,
      message,
    });
    throw new TranslationProviderError(message);
  }

  const outputText = extractOutputText(body);
  if (!outputText) {
    throw new TranslationProviderError("Translation response was empty.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new TranslationProviderError("Translation response was not valid JSON.");
  }

  return request.type === "product"
    ? sanitizeProductTranslation(parsed)
    : sanitizeCompanyTranslation(parsed);
}

function buildTranslationPrompt(request: TranslationRequest) {
  if (request.type === "product") {
    return JSON.stringify(
      {
        task: "Generate English fields for Trade82 product content.",
        outputLanguage: "English",
        sourceLanguage: "Korean or mixed Korean/English",
        source: request.payload,
        instructions: [
          "Return only the requested JSON fields.",
          "Keep the translation faithful to the source.",
          "Do not invent benefits, certifications, claims, specs, or documents.",
          "Keep tags short and buyer-search friendly.",
        ],
      },
      null,
      2,
    );
  }

  return JSON.stringify(
    {
      task: "Generate English fields for Trade82 seller company content.",
      outputLanguage: "English",
      sourceLanguage: "Korean or mixed Korean/English",
      source: request.payload,
      instructions: [
        "Return only the requested JSON fields.",
        "Keep legal, brand, and company names unchanged unless a natural English display name is already implied.",
        "Do not invent factory capabilities, export markets, certifications, or claims.",
      ],
    },
    null,
    2,
  );
}

function providerErrorMessage(body: unknown) {
  if (!body || typeof body !== "object") {
    return "English translation failed. Please try again.";
  }
  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== "object") {
    return "English translation failed. Please try again.";
  }
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.trim()
    ? message.trim()
    : "English translation failed. Please try again.";
}

function extractOutputText(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const outputText = (body as { output_text?: unknown }).output_text;
  if (typeof outputText === "string") return outputText;

  const output = (body as { output?: unknown }).output;
  if (!Array.isArray(output)) return "";

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string" && text.trim()) return text;
    }
  }

  return "";
}

function sanitizeProductTranslation(
  value: unknown,
): ProductEnglishTranslationResult {
  const record = asRecord(value);
  return {
    nameEn: cleanText(record.nameEn, 120),
    shortDescriptionEn: cleanText(record.shortDescriptionEn, 240),
    detailedDescriptionEn: cleanText(record.detailedDescriptionEn, 5_000),
    buyerNotesEn: cleanText(record.buyerNotesEn, 1_000),
    tagsEn: cleanTags(record.tagsEn),
  };
}

function sanitizeCompanyTranslation(
  value: unknown,
): CompanyEnglishTranslationResult {
  const record = asRecord(value);
  return {
    displayNameEn: cleanText(record.displayNameEn, 160),
    descriptionEn: cleanText(record.descriptionEn, 2_000),
    exportExperienceEn: cleanText(record.exportExperienceEn, 10_000),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

function cleanTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => cleanText(item.replace(/^#/, ""), 30))
        .filter(Boolean),
    ),
  ).slice(0, 10);
}
