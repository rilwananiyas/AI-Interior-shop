
const express = require("express");
const router = express.Router();

const {
  extractFurnitureRequirements,
} = require("../services/aiService");

const {
  findMatchingProducts,
} = require("../services/productMatchingService");

// --------------------------------------------------
// 1. Furniture categories
// --------------------------------------------------

const CATEGORY_PATTERNS = [
  {
    category: "Sofas",
    pattern: /\b(sofa|sofas|couch|couches|settee|loveseat)\b/i,
  },
  {
    category: "Chairs",
    pattern: /\b(chair|chairs|armchair|armchairs|stool|stools)\b/i,
  },
  {
    category: "Tables",
    pattern: /\b(table|tables|coffee table|dining table|desk|desks|side table)\b/i,
  },
  {
    category: "Beds",
    pattern: /\b(bed|beds|bedframe|bed frame|queen bed|king bed|single bed|double bed)\b/i,
  },
  {
    category: "Storage",
    pattern: /\b(storage|cabinet|cabinets|wardrobe|wardrobes|cupboard|shelf|shelves|drawer|drawers|bookcase)\b/i,
  },
  {
    category: "Lighting",
    pattern: /\b(lighting|light|lights|lamp|lamps|chandelier)\b/i,
  },
  {
    category: "Decor",
    pattern: /\b(decor|decoration|decorations|vase|vases|wall art|mirror|mirrors|rug|rugs|curtain|curtains)\b/i,
  },
];

// --------------------------------------------------
// 2. Room detection
// --------------------------------------------------

const ROOM_PATTERNS = [
  {
    room: "Bedroom",
    pattern: /\b(bedroom|bed room)\b/i,
    categories: ["Beds", "Storage", "Lighting", "Decor"],
  },
  {
    room: "Living Room",
    pattern: /\b(living room|lounge)\b/i,
    categories: ["Sofas", "Tables", "Storage", "Lighting", "Decor"],
  },
  {
    room: "Dining Room",
    pattern: /\b(dining room|dining area)\b/i,
    categories: ["Tables", "Chairs", "Lighting", "Decor"],
  },
  {
    room: "Office",
    pattern: /\b(office|workspace|study room|home office)\b/i,
    categories: ["Chairs", "Tables", "Storage", "Lighting"],
  },
];

// --------------------------------------------------
// 3. Attribute detection
// --------------------------------------------------

const ATTRIBUTE_PATTERNS = {
  material: [
    "Engineered Wood",
    "Leather",
    "Rattan",
    "Fabric",
    "Metal",
    "Glass",
    "Plastic",
    "Wood",
  ],

  color: [
    "Natural Wood",
    "Beige",
    "Brown",
    "Black",
    "White",
    "Grey",
    "Blue",
    "Green",
  ],

  style: [
    "Scandinavian",
    "Contemporary",
    "Minimalist",
    "Traditional",
    "Industrial",
    "Classic",
    "Modern",
  ],
};

// --------------------------------------------------
// 4. Normalize material names
// --------------------------------------------------

function normalizeMaterial(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (
    /^(engineered\s+wood|mdf|particle\s+board|plywood)$/.test(
      normalized
    )
  ) {
    return "Engineered Wood";
  }

  if (
    /^(wood|wooden|solid\s+wood|wood\s+furniture|wooden\s+furniture|timber)$/.test(
      normalized
    )
  ) {
    return "Wood";
  }

  const standardMaterials = [
    "Leather",
    "Rattan",
    "Fabric",
    "Metal",
    "Glass",
    "Plastic",
  ];

  const matchedMaterial = standardMaterials.find(
    (item) => item.toLowerCase() === normalized
  );

  return matchedMaterial || value.trim();
}

// --------------------------------------------------
// 5. Extract attributes from user message
// --------------------------------------------------

function extractAttribute(message, attribute) {
  if (attribute === "material") {
    if (/\bengineered\s+wood\b/i.test(message)) {
      return "Engineered Wood";
    }

    if (/\b(wood|wooden|timber)\b/i.test(message)) {
      return "Wood";
    }
  }

  const patterns = ATTRIBUTE_PATTERNS[attribute] || [];

  const value = patterns.find((item) => {
    const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}\\b`, "i");

    return pattern.test(message);
  });

  if (!value) {
    return null;
  }

  if (attribute === "material") {
    return normalizeMaterial(value);
  }

  return value;
}

// --------------------------------------------------
// 6. Extract frame material
// --------------------------------------------------

function extractFrameMaterial(message) {
  const woodenFramePatterns = [
    /\bwooden[- ]frame\b/i,
    /\bwood[- ]frame\b/i,
    /\bframe\s+(?:made\s+of|constructed\s+from)\s+wood\b/i,
    /\bframe\s+of\s+wood\b/i,
    /\bwooden\s+(?:sofa|sofas|chair|chairs|armchair|armchairs)\b/i,
    /\b(?:sofa|sofas|chair|chairs|armchair|armchairs)\s+with\s+(?:a\s+)?wooden\s+frame\b/i,
  ];

  if (
    woodenFramePatterns.some((pattern) => pattern.test(message))
  ) {
    return "Wood";
  }

  return null;
}

// --------------------------------------------------
// 7. Detect category
// --------------------------------------------------

function extractCategory(message) {
  const found = CATEGORY_PATTERNS.find((item) =>
    item.pattern.test(message)
  );

  return found ? found.category : null;
}

// --------------------------------------------------
// 8. Detect room
// --------------------------------------------------

function extractRoom(message) {
  return (
    ROOM_PATTERNS.find((item) =>
      item.pattern.test(message)
    ) || null
  );
}

// --------------------------------------------------
// 9. Parse amounts
// --------------------------------------------------

function parseAmount(value, suffix) {
  const amount = Number(String(value).replace(/,/g, ""));

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return suffix && suffix.toLowerCase() === "k"
    ? amount * 1000
    : amount;
}

// --------------------------------------------------
// 10. Extract price filters
// --------------------------------------------------

function extractPriceRequirements(message) {
  const text = message.toLowerCase();
  const amount = "(\\d[\\d,]*(?:\\.\\d+)?)\\s*(k)?";

  const result = {
    minPrice: null,
    maxPrice: null,
  };

  let match = text.match(
    new RegExp(
      `\\bbetween\\s*(?:lkr|rs\\.?|rupees?)?\\s*${amount}\\s*(?:and|to|-)\\s*(?:lkr|rs\\.?|rupees?)?\\s*${amount}`,
      "i"
    )
  );

  if (!match) {
    match = text.match(
      new RegExp(
        `\\b${amount}\\s*(?:to|-)\\s*(?:lkr|rs\\.?|rupees?)?\\s*${amount}`,
        "i"
      )
    );
  }

  if (match) {
    const first = parseAmount(match[1], match[2]);
    const second = parseAmount(match[3], match[4]);

    if (first !== null && second !== null) {
      result.minPrice = Math.min(first, second);
      result.maxPrice = Math.max(first, second);
      return result;
    }
  }

  match = text.match(
    new RegExp(
      `\\b(?:under|below|less than|maximum|max|at most|up to)\\s*(?:lkr|rs\\.?|rupees?)?\\s*${amount}`,
      "i"
    )
  );

  if (match) {
    result.maxPrice = parseAmount(match[1], match[2]);
    return result;
  }

  match = text.match(
    new RegExp(
      `\\b(?:above|over|more than|greater than|minimum|min|at least)\\s*(?:lkr|rs\\.?|rupees?)?\\s*${amount}`,
      "i"
    )
  );

  if (match) {
    result.minPrice = parseAmount(match[1], match[2]);
  }

  return result;
}

// --------------------------------------------------
// 11. Minimum stock detection
// --------------------------------------------------

function extractStockRequirement(message) {
  const match = message.match(
    /\b(?:more than|at least|minimum of)\s+(\d+)\s+(?:items?|units?|pieces?)\s+(?:in stock|available)\b/i
  );

  if (!match) return null;

  const quantity = Number(match[1]);

  return /more than/i.test(message)
    ? quantity + 1
    : quantity;
}

// --------------------------------------------------
// 12. Durability detection
// --------------------------------------------------

function extractDurability(message) {
  if (
    /\b(sturdy|strong|durable|long-lasting|heavy-duty)\b/i.test(message)
  ) {
    return "High";
  }

  if (
    /\b(moderate durability|medium durability)\b/i.test(message)
  ) {
    return "Medium";
  }

  if (
    /\b(light-duty|low durability)\b/i.test(message)
  ) {
    return "Low";
  }

  return null;
}

// --------------------------------------------------
// 13. Furniture size detection
// --------------------------------------------------

function extractSize(message) {
  if (
    /\b(compact|small|space-efficient|space saving)\b/i.test(message)
  ) {
    return "Compact";
  }

  if (
    /\b(medium-sized|medium size|standard size)\b/i.test(message)
  ) {
    return "Medium";
  }

  if (
    /\b(large|big|spacious|oversized)\b/i.test(message)
  ) {
    return "Large";
  }

  return null;
}

// --------------------------------------------------
// 14. Space-saving detection
// --------------------------------------------------

function extractSpaceSaving(message) {
  if (
    /\b(space-saving|space saving|saves space|save space|small-space)\b/i.test(
      message
    )
  ) {
    return true;
  }

  return null;
}

// --------------------------------------------------
// 15. Furniture feature detection
// --------------------------------------------------

const FEATURE_PATTERNS = [
  "foldable",
  "extendable",
  "adjustable",
  "cushioned",
  "reclining",
  "easy to clean",
  "water-resistant",
  "with storage",
];

function extractFeatures(message) {
  return FEATURE_PATTERNS.filter((feature) => {
    const escaped = feature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}\\b`, "i");

    return pattern.test(message);
  });
}

// --------------------------------------------------
// 16. Sorting detection
// --------------------------------------------------

function extractSort(message) {
  const text = message.toLowerCase();

  if (
    /\b(cheaper|cheapest|lowest price|price low to high)\b/i.test(text)
  ) {
    return "price_asc";
  }

  if (
    /\b(more expensive|most expensive|highest price|price high to low)\b/i.test(text)
  ) {
    return "price_desc";
  }

  if (
    /\b(most stock|highest stock|more stock)\b/i.test(text)
  ) {
    return "stock_desc";
  }

  if (
    /\b(newest|latest|recent products)\b/i.test(text)
  ) {
    return "newest";
  }

  return null;
}

// --------------------------------------------------
// 17. Greeting detection
// --------------------------------------------------

function isGreeting(message) {
  return /^(hi|hello|hey|good morning|good afternoon|good evening|how are you)[.!?\s]*$/i.test(
    message.trim()
  );
}

// --------------------------------------------------
// 18. Detect fresh searches and follow-ups
// --------------------------------------------------

function isNewSearch(message, previousRequirements = {}) {
  const text = message.toLowerCase().trim();

  const resetPattern =
    /\b(new search|start a new search|start over|clear filters|reset filters|search from scratch|forget previous filters)\b/i;

  if (resetPattern.test(text)) {
    return true;
  }

  if (
    !previousRequirements ||
    Object.keys(previousRequirements).length === 0
  ) {
    return true;
  }

  const newSearchPattern =
    /^(find|search for|look for|recommend|suggest|i need|i want|looking for|can you find|can you show me|get me|show me (?!the\b|those\b|these\b|them\b|ones\b))/i;

  return newSearchPattern.test(text);
}

// --------------------------------------------------
// 19. Clean and normalize requirements
// --------------------------------------------------

function cleanRequirements(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }

  const allowedFields = [
    "category",
    "categories",
    "room",
    "minPrice",
    "maxPrice",
    "minStock",
    "material",
    "frameMaterial",
    "color",
    "style",
    "sortBy",
    "keywords",
    "durability",
    "size",
    "spaceSaving",
    "features",
  ];

  const cleaned = {};

  for (const field of allowedFields) {
    const value = data[field];

    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (field === "spaceSaving") {
      if (typeof value === "boolean") {
        cleaned[field] = value;
      }

      continue;
    }

    if (
      field === "categories" ||
      field === "keywords" ||
      field === "features"
    ) {
      if (Array.isArray(value)) {
        cleaned[field] = value
          .filter((item) => typeof item === "string" && item.trim())
          .map((item) => item.trim())
          .slice(0, 10);
      }

      continue;
    }

    if (
      field === "minPrice" ||
      field === "maxPrice" ||
      field === "minStock"
    ) {
      const number = Number(value);

      if (Number.isFinite(number) && number >= 0) {
        cleaned[field] = number;
      }

      continue;
    }

    if (typeof value === "string") {
      if (
        field === "material" ||
        field === "frameMaterial"
      ) {
        const normalized = normalizeMaterial(value);

        if (normalized) {
          cleaned[field] = normalized;
        }
      } else {
        cleaned[field] = value.trim();
      }
    }
  }

  return cleaned;
}

// --------------------------------------------------
// 20. Generate accurate no-results response
// --------------------------------------------------

function generateNoResultsMessage(requirements) {
  const filters = [];

  if (requirements.material) {
    filters.push(`${requirements.material} material`);
  }

  if (requirements.frameMaterial) {
    filters.push(`${requirements.frameMaterial} frame`);
  }

  if (requirements.color) {
    filters.push(`${requirements.color} colour`);
  }

  if (requirements.style) {
    filters.push(`${requirements.style} style`);
  }

  if (requirements.category) {
    filters.push(requirements.category);
  }

  if (requirements.room) {
    filters.push(`for ${requirements.room}`);
  }

  if (requirements.durability) {
    filters.push(`${requirements.durability} durability`);
  }

  if (requirements.size) {
    filters.push(`${requirements.size} size`);
  }

  if (requirements.spaceSaving === true) {
    filters.push("space-saving furniture");
  }

  if (requirements.features?.length > 0) {
    filters.push(
      `features: ${requirements.features.join(", ")}`
    );
  }

  const hasMinPrice = requirements.minPrice !== undefined;
  const hasMaxPrice = requirements.maxPrice !== undefined;

  if (hasMinPrice && hasMaxPrice) {
    filters.push(
      `price between LKR ${Number(requirements.minPrice).toLocaleString("en-US")} and LKR ${Number(requirements.maxPrice).toLocaleString("en-US")}`
    );
  } else if (hasMaxPrice) {
    filters.push(
      `price under LKR ${Number(requirements.maxPrice).toLocaleString("en-US")}`
    );
  } else if (hasMinPrice) {
    filters.push(
      `price above LKR ${Number(requirements.minPrice).toLocaleString("en-US")}`
    );
  }

  if (requirements.minStock !== undefined) {
    filters.push(`at least ${requirements.minStock} items in stock`);
  }

  if (filters.length === 0) {
    return "I couldn't find matching products in our current collection. Please try a different search.";
  }

  return (
    `I couldn't find any products matching all these requirements: ${filters.join(", ")}. ` +
    "These filters are applied together. Try removing or changing one filter, such as material, colour, style, size, or budget."
  );
}

// --------------------------------------------------
// 21. Main recommendation endpoint
// --------------------------------------------------

router.post("/recommendations", async (req, res) => {
  try {
    const {
      message,
      previousRequirements = {},
    } = req.body || {};

    if (
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 1000
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter a message (maximum 1000 characters).",
      });
    }

    const userMessage = message.trim();

    // Greeting
    if (isGreeting(userMessage)) {
      return res.status(200).json({
        success: true,
        intent: "greeting",
        requirements: {},
        count: 0,
        products: [],
        assistantMessage:
          "Hello! Welcome to AI Interior Shop. What furniture are you looking for today?",
      });
    }

    // Previous conversation requirements
    const previous = cleanRequirements(previousRequirements);

    // Direct detection
    const detectedCategory = extractCategory(userMessage);
    const detectedRoom = extractRoom(userMessage);
    const detectedPrices = extractPriceRequirements(userMessage);
    const detectedMinStock = extractStockRequirement(userMessage);
    const detectedSort = extractSort(userMessage);

    let detectedMaterial = extractAttribute(userMessage, "material");
    const detectedFrameMaterial = extractFrameMaterial(userMessage);

    // A wooden sofa/chair means wooden frame, not wooden upholstery.
    if (detectedFrameMaterial && detectedMaterial === "Wood") {
      detectedMaterial = null;
    }

    const detectedColor = extractAttribute(userMessage, "color");
    const detectedStyle = extractAttribute(userMessage, "style");

    const detectedDurability = extractDurability(userMessage);
    const detectedSize = extractSize(userMessage);
    const detectedSpaceSaving = extractSpaceSaving(userMessage);
    const detectedFeatures = extractFeatures(userMessage);

    // --------------------------------------------------
    // AI extraction
    // --------------------------------------------------

    let aiRequirements = {};

    try {
      const extracted = await extractFurnitureRequirements(userMessage);

      if (extracted && typeof extracted === "object") {
        aiRequirements = cleanRequirements(extracted);

        // IMPORTANT:
        // Category and room categories must not be guessed by AI.
        // They are controlled by direct detection and conversation memory.
        delete aiRequirements.category;
        delete aiRequirements.categories;

        // Room must come from direct user-message detection.
        delete aiRequirements.room;

        // Price limits must come from direct user-message detection.
        delete aiRequirements.minPrice;
        delete aiRequirements.maxPrice;

        // Sorting must also come from direct user-message detection.
        delete aiRequirements.sortBy;

        // Remove accidental wood upholstery extraction.
        if (
          detectedFrameMaterial &&
          aiRequirements.material &&
          normalizeMaterial(aiRequirements.material) === "Wood"
        ) {
          delete aiRequirements.material;
        }

        // Remove price and sorting words from AI keywords.
        if (Array.isArray(aiRequirements.keywords)) {
          aiRequirements.keywords = aiRequirements.keywords.filter(
            (keyword) =>
              !/\b(price|budget|cheaper|cheapest|expensive|highest|lowest|sort|sorting|ascending|descending)\b/i.test(
                keyword
              )
          );
        }
      }
    } catch (aiError) {
      console.error("Ollama extraction failed:", aiError.message);
    }

    // --------------------------------------------------
    // Detect search type
    // --------------------------------------------------

    const hasDirectPriceFilter =
      detectedPrices.minPrice !== null ||
      detectedPrices.maxPrice !== null;

    const hasBudgetChange =
      hasDirectPriceFilter ||
      /\b(no budget|any budget|without budget|remove budget)\b/i.test(
        userMessage
      );

    const hasCategoryChange =
      detectedCategory !== null ||
      /\b(other category|different category|any category)\b/i.test(
        userMessage
      );

    const wantsCheaper =
      /\b(cheaper|cheapest|lowest price)\b/i.test(userMessage);

    const wantsExpensive =
      /\b(more expensive|most expensive|highest price)\b/i.test(
        userMessage
      );

    // Determine whether this is a fresh search or a follow-up.
    const newSearch = isNewSearch(userMessage, previous);

    const isDifferentCategorySearch =
      Boolean(detectedCategory) &&
      Boolean(previous.category) &&
      detectedCategory.toLowerCase() !==
        previous.category.toLowerCase();

    const shouldStartFresh =
      newSearch || isDifferentCategorySearch;

    const baseRequirements = shouldStartFresh
      ? {}
      : previous;

    // Merge previous and AI-extracted requirements.
    // AI cannot overwrite category, room, price, or sorting.
    const requirements = {
      ...baseRequirements,
      ...aiRequirements,
    };

    // --------------------------------------------------
    // Direct category detection
    // --------------------------------------------------

    if (detectedCategory) {
      requirements.category = detectedCategory;
      delete requirements.categories;
      delete requirements.room;
    } else if (hasCategoryChange) {
      delete requirements.category;
      delete requirements.categories;
    }

    // --------------------------------------------------
    // Room detection
    // --------------------------------------------------

    if (detectedRoom) {
      requirements.room = detectedRoom.room;
      requirements.categories = detectedRoom.categories;
      delete requirements.category;
    }

    // --------------------------------------------------
    // Direct attribute updates
    // --------------------------------------------------

    if (detectedMaterial) {
      requirements.material = detectedMaterial;
    }

    if (detectedFrameMaterial) {
      requirements.frameMaterial = detectedFrameMaterial;
    }

    if (detectedColor) {
      requirements.color = detectedColor;
    }

    if (detectedStyle) {
      requirements.style = detectedStyle;
    }

    // --------------------------------------------------
    // New furniture attribute updates
    // --------------------------------------------------

    if (detectedDurability) {
      requirements.durability = detectedDurability;
    }

    if (detectedSize) {
      requirements.size = detectedSize;
    }

    if (detectedSpaceSaving !== null) {
      requirements.spaceSaving = detectedSpaceSaving;
    }

    if (detectedFeatures.length > 0) {
      requirements.features = [
        ...new Set([
          ...(Array.isArray(requirements.features)
            ? requirements.features
            : []),
          ...detectedFeatures,
        ]),
      ];
    }

    // Normalize material fields after merging.
    if (requirements.material) {
      requirements.material = normalizeMaterial(
        requirements.material
      );
    }

    if (requirements.frameMaterial) {
      requirements.frameMaterial = normalizeMaterial(
        requirements.frameMaterial
      );
    }

    // --------------------------------------------------
    // Budget updates
    // --------------------------------------------------

    if (hasDirectPriceFilter) {
      delete requirements.minPrice;
      delete requirements.maxPrice;

      if (detectedPrices.minPrice !== null) {
        requirements.minPrice = detectedPrices.minPrice;
      }

      if (detectedPrices.maxPrice !== null) {
        requirements.maxPrice = detectedPrices.maxPrice;
      }
    } else if (hasBudgetChange) {
      delete requirements.minPrice;
      delete requirements.maxPrice;
    }

    // --------------------------------------------------
    // Stock
    // --------------------------------------------------

    if (detectedMinStock !== null) {
      requirements.minStock = detectedMinStock;
    }

    // --------------------------------------------------
    // Sorting
    // --------------------------------------------------

    if (detectedSort) {
      requirements.sortBy = detectedSort;
    } else if (wantsCheaper) {
      requirements.sortBy = "price_asc";
    } else if (wantsExpensive) {
      requirements.sortBy = "price_desc";
    }

    // --------------------------------------------------
    // Normalize arrays
    // --------------------------------------------------

    if (!Array.isArray(requirements.categories)) {
      requirements.categories = [];
    }

    if (!Array.isArray(requirements.keywords)) {
      requirements.keywords = [];
    }

    if (!Array.isArray(requirements.features)) {
      requirements.features = [];
    }

    // --------------------------------------------------
    // Validate price range
    // --------------------------------------------------

    if (
      requirements.minPrice !== undefined &&
      requirements.maxPrice !== undefined &&
      Number(requirements.minPrice) > Number(requirements.maxPrice)
    ) {
      return res.status(400).json({
        success: false,
        message: "Minimum price cannot be greater than maximum price.",
      });
    }

    // --------------------------------------------------
    // Check whether enough search information exists
    // --------------------------------------------------

    const hasRequirements =
      Boolean(requirements.category) ||
      requirements.categories.length > 0 ||
      Boolean(requirements.room) ||
      requirements.minPrice !== undefined ||
      requirements.maxPrice !== undefined ||
      requirements.minStock !== undefined ||
      Boolean(requirements.material) ||
      Boolean(requirements.frameMaterial) ||
      Boolean(requirements.color) ||
      Boolean(requirements.style) ||
      Boolean(requirements.durability) ||
      Boolean(requirements.size) ||
      typeof requirements.spaceSaving === "boolean" ||
      Boolean(requirements.sortBy) ||
      requirements.keywords.length > 0 ||
      requirements.features.length > 0;

    if (!hasRequirements) {
      return res.status(200).json({
        success: true,
        intent: "clarification",
        requirements,
        count: 0,
        products: [],
        assistantMessage:
          "Tell me a furniture name, category, room, material, style, colour, size, durability, or budget. For example: Find a sturdy wooden bedroom bed under 100000.",
      });
    }

    // --------------------------------------------------
    // DEBUG: Inspect final requirements
    // --------------------------------------------------

    console.log(
      "FINAL AI REQUIREMENTS:",
      JSON.stringify(requirements, null, 2)
    );

    // --------------------------------------------------
    // Search products in the actual store database
    // --------------------------------------------------

    const products = await findMatchingProducts(requirements);

    const matchingProducts = Array.isArray(products)
      ? products
      : [];

    // --------------------------------------------------
    // Response
    // --------------------------------------------------

    const assistantMessage =
      matchingProducts.length > 0
        ? `I found ${matchingProducts.length} furniture option(s) matching your requirements.`
        : generateNoResultsMessage(requirements);

    return res.status(200).json({
      success: true,
      intent: "recommendations",
      requirements,
      count: matchingProducts.length,
      products: matchingProducts,
      assistantMessage,
    });
  } catch (error) {
    console.error("AI recommendation error:", error);

    return res.status(500).json({
      success: false,
      message:
        "The AI recommendation service is temporarily unavailable. Please try again.",
    });
  }
});

module.exports = router;
