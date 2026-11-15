
const Product = require("../models/Product");

// ============================================
// 1. TEXT NORMALIZATION
// ============================================

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function containsText(value, search) {
  const actual = normalize(value);
  const requested = normalize(search);

  return Boolean(requested && actual.includes(requested));
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ============================================
// 2. KEYWORD AND SYNONYM DATA
// ============================================

const NON_PRODUCT_KEYWORDS = [
  "above", "below", "under", "over", "between",
  "less", "more", "than", "price", "prices",
  "budget", "within", "maximum", "minimum",
  "cheaper", "cost", "expensive",
  "lkr", "rs", "rupees", "rupee",
];

const PRODUCT_TYPES = [
  "sectional sofa",
  "three seater sofa",
  "3 seater sofa",
  "two seater sofa",
  "2 seater sofa",
  "coffee table",
  "side table",
  "study table",
  "office table",
  "dining table",
  "bedside table",
  "console table",
  "dressing table",
  "dining chair",
  "office chair",
  "gaming chair",
  "sofa bed",
  "single bed",
  "double bed",
  "queen bed",
  "king bed",
  "bookshelf",
  "book shelf",
  "wardrobe",
  "cabinet",
  "shoe rack",
  "tv stand",
  "tv unit",
  "armchair",
];

const KEYWORD_SYNONYMS = [
  ["wood", "wooden", "timber"],
  ["comfortable", "comfort", "cozy", "cushioned"],
  ["soft", "plush", "padded"],
  ["durable", "sturdy", "strong", "long-lasting"],
  ["compact", "small", "space-saving"],
  ["large", "big", "spacious"],
  ["modern", "contemporary"],
  ["minimalist", "minimal", "simple"],
  ["elegant", "stylish", "sophisticated"],
  ["easy to clean", "low maintenance"],
  ["foldable", "folding"],
  ["extendable", "extending"],
];

const STYLE_SYNONYMS = [
  ["modern", "contemporary"],
  ["minimalist", "minimal", "simple"],
  ["traditional", "classic"],
  ["industrial", "urban"],
  ["scandinavian", "nordic"],
  ["rustic", "country"],
  ["bohemian", "boho"],
];

const DURABILITY_SYNONYMS = [
  ["high", "strong", "sturdy", "durable"],
  ["medium", "moderate"],
  ["low", "light-duty"],
];

const SIZE_SYNONYMS = [
  ["compact", "small"],
  ["medium", "standard"],
  ["large", "big", "spacious"],
];

// Similar colour families.
// These are approximate text-based matches, not visual colour analysis.
const COLOR_SYNONYMS = [
  ["beige", "cream", "ivory", "off-white"],
  ["white", "ivory", "snow"],
  ["black", "charcoal", "dark"],
  ["grey", "gray", "silver"],
  ["brown", "chocolate", "coffee", "walnut"],
  ["blue", "navy", "sky blue"],
  ["green", "olive", "sage"],
  ["pink", "rose", "blush"],
  ["red", "burgundy", "maroon"],
  ["yellow", "gold", "mustard"],
  ["orange", "terracotta", "rust"],
];

// ============================================
// 3. SYNONYM MATCHING
// ============================================

function matchesSynonym(value, requested, groups) {
  if (!value || !requested) {
    return false;
  }

  if (containsText(value, requested)) {
    return true;
  }

  const normalizedRequested = normalize(requested);

  const group = groups.find((synonyms) =>
    synonyms.some(
      (word) => normalize(word) === normalizedRequested
    )
  );

  if (!group) {
    return false;
  }

  return group.some((word) =>
    containsText(value, word)
  );
}

function keywordMatches(value, requested) {
  return matchesSynonym(
    value,
    requested,
    KEYWORD_SYNONYMS
  );
}

function styleMatches(actual, requested) {
  return matchesSynonym(
    actual,
    requested,
    STYLE_SYNONYMS
  );
}

function colorMatches(actual, requested) {
  return matchesSynonym(
    actual,
    requested,
    COLOR_SYNONYMS
  );
}

// ============================================
// 4. AI MATERIAL MATCHING
// ============================================

function matchesSuggestedMaterial(product, materials) {
  if (!Array.isArray(materials) || materials.length === 0) {
    return false;
  }

  const actualMaterials = [
    product.material || "",
    product.frameMaterial || "",
  ].join(" ");

  return materials.some((material) =>
    keywordMatches(actualMaterials, material)
  );
}

// ============================================
// 5. AI ROOM SPACE MATCHING
// ============================================

function matchesRoomSpace(product, spaceCondition) {
  const space = normalize(spaceCondition);
  const productSize = normalize(product.size);

  if (space === "small") {
    return (
      productSize === "compact" ||
      product.spaceSaving === true
    );
  }

  if (space === "medium") {
    return productSize === "medium";
  }

  if (space === "large") {
    return productSize === "large";
  }

  return false;
}

// ============================================
// 6. AI ROOM COLOUR PALETTE MATCHING
// ============================================

function matchesRoomPalette(product, palette) {
  if (!product.color || !Array.isArray(palette)) {
    return false;
  }

  return palette.some((roomColor) => {
    // Support simple strings and common AI object formats.
    const color =
      typeof roomColor === "string"
        ? roomColor
        : roomColor?.name ||
          roomColor?.color ||
          roomColor?.label ||
          "";

    if (!color) {
      return false;
    }

    return colorMatches(product.color, color);
  });
}

// ============================================
// 7. CUSTOMER PRODUCT TYPE MATCHING
// ============================================

function getRequestedProductTypes(keywords) {
  return PRODUCT_TYPES.filter((type) =>
    keywords.some((keyword) =>
      normalize(keyword).includes(type)
    )
  );
}

function matchesProductType(product, requestedTypes) {
  if (requestedTypes.length === 0) {
    return true;
  }

  const searchableText = normalize(
    `${product.name || ""} ${product.description || ""}`
  );

  return requestedTypes.some((type) =>
    searchableText.includes(type)
  );
}

// ============================================
// 8. SORTING
// ============================================

function getSortValue(product, sortBy) {
  switch (sortBy) {
    case "price_desc":
      return Number(product.price) * -1;

    case "stock_desc":
      return Number(product.stock) * -1;

    case "newest":
      return new Date(product.createdAt || 0).getTime() * -1;

    case "price_asc":
    default:
      return Number(product.price);
  }
}

// ============================================
// 9. MAIN PRODUCT MATCHING ENGINE
// ============================================

async function findMatchingProducts(requirements = {}) {
  // ------------------------------------------
  // A. DATABASE FILTERS
  // ------------------------------------------

  const filter = {
    isActive: true,
    stock: { $gt: 0 },
  };

  // Category filter
  if (requirements.category) {
    filter.category = requirements.category;
  } else if (
    Array.isArray(requirements.categories) &&
    requirements.categories.length > 0
  ) {
    filter.category = {
      $in: requirements.categories,
    };
  }

  // Minimum price
  if (
    requirements.minPrice !== null &&
    requirements.minPrice !== undefined &&
    Number.isFinite(Number(requirements.minPrice))
  ) {
    filter.price = {
      ...(filter.price || {}),
      $gte: Number(requirements.minPrice),
    };
  }

  // Maximum price
  if (
    requirements.maxPrice !== null &&
    requirements.maxPrice !== undefined &&
    Number.isFinite(Number(requirements.maxPrice))
  ) {
    filter.price = {
      ...(filter.price || {}),
      $lte: Number(requirements.maxPrice),
    };
  }

  // Minimum stock
  if (
    Number.isInteger(requirements.minStock) &&
    requirements.minStock > 0
  ) {
    filter.stock = {
      $gte: requirements.minStock,
    };
  }

  // Customer-selected material (strict filter)
  if (requirements.material) {
    filter.material = {
      $regex: escapeRegex(requirements.material),
      $options: "i",
    };
  }

  // Customer-selected frame material (strict filter)
  if (requirements.frameMaterial) {
    filter.frameMaterial = {
      $regex: escapeRegex(requirements.frameMaterial),
      $options: "i",
    };
  }

  // Customer-selected colour (strict filter)
  if (requirements.color) {
    filter.color = {
      $regex: `^${escapeRegex(requirements.color)}$`,
      $options: "i",
    };
  }

  // ------------------------------------------
  // B. FETCH AVAILABLE PRODUCTS
  // ------------------------------------------

  let products = await Product.find(filter)
    .populate("owner", "name")
    .lean();

  // ------------------------------------------
  // C. PREPARE CUSTOMER KEYWORDS
  // ------------------------------------------

  const keywords = Array.isArray(requirements.keywords)
    ? requirements.keywords
        .filter((keyword) => typeof keyword === "string")
        .map((keyword) => keyword.trim())
        .filter((keyword) => {
          const normalized = normalize(keyword);

          return (
            normalized &&
            !NON_PRODUCT_KEYWORDS.includes(normalized)
          );
        })
    : [];

  // Customer-requested style remains a strict filter.
  if (requirements.style) {
    products = products.filter((product) =>
      styleMatches(product.style, requirements.style)
    );
  }

  // Explicit furniture type requested by customer.
  const requestedProductTypes =
    getRequestedProductTypes(keywords);

  if (requestedProductTypes.length > 0) {
    products = products.filter((product) =>
      matchesProductType(product, requestedProductTypes)
    );
  }

  // ------------------------------------------
  // D. PREPARE AI DESIGN INFORMATION
  // ------------------------------------------

  const design = requirements.designAnalysis || {};

  const detectedStyle =
    design.detectedStyle &&
    normalize(design.detectedStyle) !== "unknown"
      ? design.detectedStyle
      : null;

  const suggestedMaterials = Array.isArray(
    design.suggestedFurnitureMaterials
  )
    ? design.suggestedFurnitureMaterials.filter(
        (material) => typeof material === "string" && material.trim()
      )
    : [];

  const spaceCondition =
    design.spaceCondition &&
    normalize(design.spaceCondition) !== "unknown"
      ? design.spaceCondition
      : null;

  const roomColorPalette = Array.isArray(
    design.roomColorPalette
  )
    ? design.roomColorPalette
    : [];

  const hasAIDesignSignals = Boolean(
    detectedStyle ||
    suggestedMaterials.length > 0 ||
    spaceCondition ||
    roomColorPalette.length > 0
  );

  // ------------------------------------------
  // E. CALCULATE PRODUCT MATCH SCORES
  // ------------------------------------------

  const scoredProducts = products.map((product) => {
    let totalWeight = 0;
    let earnedWeight = 0;

    const matchedAttributes = [];
    const missingAttributes = [];
    const recommendationReasons = [];

    function evaluateAttribute(
      label,
      requested,
      actual,
      weight,
      matcher = containsText
    ) {
      if (!requested) return;

      totalWeight += weight;

      if (matcher(actual, requested)) {
        earnedWeight += weight;
        matchedAttributes.push(label);
      } else {
        missingAttributes.push(label);
      }
    }

    // CUSTOMER PREFERENCES

    evaluateAttribute(
      "Material",
      requirements.material,
      product.material,
      20,
      keywordMatches
    );

    evaluateAttribute(
      "Frame Material",
      requirements.frameMaterial,
      product.frameMaterial,
      20,
      keywordMatches
    );

    evaluateAttribute(
      "Colour",
      requirements.color,
      product.color,
      25,
      colorMatches
    );

    evaluateAttribute(
      "Style",
      requirements.style,
      product.style,
      25,
      styleMatches
    );

    // Room suitability
    if (requirements.room) {
      totalWeight += 15;

      const rooms = Array.isArray(product.suitableRooms)
        ? product.suitableRooms
        : [];

      const roomMatches = rooms.some((room) =>
        normalize(room) === normalize(requirements.room)
      );

      if (roomMatches) {
        earnedWeight += 15;
        matchedAttributes.push("Room");

        recommendationReasons.push(
          `Suitable for your ${requirements.room}.`
        );
      } else {
        missingAttributes.push("Room");
      }
    }

    evaluateAttribute(
      "Durability",
      requirements.durability,
      product.durability,
      10,
      (actual, requested) =>
        matchesSynonym(
          actual,
          requested,
          DURABILITY_SYNONYMS
        )
    );

    evaluateAttribute(
      "Size",
      requirements.size,
      product.size,
      10,
      (actual, requested) =>
        matchesSynonym(
          actual,
          requested,
          SIZE_SYNONYMS
        )
    );

    // Space-saving preference
    if (typeof requirements.spaceSaving === "boolean") {
      totalWeight += 10;

      if (product.spaceSaving === requirements.spaceSaving) {
        earnedWeight += 10;
        matchedAttributes.push("Space-saving");
      } else {
        missingAttributes.push("Space-saving");
      }
    }

    // Customer-requested features
    const requestedFeatures = Array.isArray(requirements.features)
      ? requirements.features.filter(
          (feature) => typeof feature === "string" && feature.trim()
        )
      : [];

    if (requestedFeatures.length > 0) {
      totalWeight += 10;

      const actualFeatures = Array.isArray(product.features)
        ? product.features
        : [];

      const searchableFeatures = actualFeatures.join(" ");

      const matchedFeatures = requestedFeatures.filter((feature) =>
        keywordMatches(searchableFeatures, feature)
      );

      const featureScore =
        matchedFeatures.length / requestedFeatures.length;

      earnedWeight += featureScore * 10;

      if (matchedFeatures.length > 0) {
        matchedAttributes.push("Features");
      }

      if (matchedFeatures.length < requestedFeatures.length) {
        missingAttributes.push("Some features");
      }
    }

    // Customer keywords
    if (keywords.length > 0) {
      totalWeight += 15;

      const searchableText = [
        product.name || "",
        product.description || "",
        product.material || "",
        product.frameMaterial || "",
        product.style || "",
        product.category || "",
        ...(Array.isArray(product.suitableRooms)
          ? product.suitableRooms
          : []),
        ...(Array.isArray(product.features)
          ? product.features
          : []),
      ].join(" ");

      const matchedKeywords = keywords.filter((keyword) =>
        keywordMatches(searchableText, keyword)
      );

      earnedWeight +=
        (matchedKeywords.length / keywords.length) * 15;

      if (matchedKeywords.length > 0) {
        matchedAttributes.push("Keywords");
      }

      if (matchedKeywords.length < keywords.length) {
        missingAttributes.push("Some keywords");
      }
    }

    // ------------------------------------------
    // AI DESIGN SOFT MATCHING
    // ------------------------------------------

    // 1. Detected interior style
    if (detectedStyle) {
      totalWeight += 15;

      if (styleMatches(product.style, detectedStyle)) {
        earnedWeight += 15;
        matchedAttributes.push("AI Design Style");

        recommendationReasons.push(
          `Its ${product.style} style complements the detected room style.`
        );
      } else {
        missingAttributes.push("AI Design Style");
      }
    }

    // 2. AI-suggested furniture materials
    if (suggestedMaterials.length > 0) {
      totalWeight += 15;

      if (
        matchesSuggestedMaterial(product, suggestedMaterials)
      ) {
        earnedWeight += 15;
        matchedAttributes.push("AI Suggested Material");

        recommendationReasons.push(
          "Its material matches the AI-suggested furniture materials."
        );
      } else {
        missingAttributes.push("AI Suggested Material");
      }
    }

    // 3. Detected room space
    if (spaceCondition) {
      totalWeight += 10;

      if (matchesRoomSpace(product, spaceCondition)) {
        earnedWeight += 10;
        matchedAttributes.push("Room Space");

        recommendationReasons.push(
          `Its size is suitable for a ${normalize(spaceCondition)} room.`
        );
      } else {
        missingAttributes.push("Room Space");
      }
    }

    // 4. Room colour palette
    if (roomColorPalette.length > 0) {
      totalWeight += 5;

      if (matchesRoomPalette(product, roomColorPalette)) {
        earnedWeight += 5;
        matchedAttributes.push("Room Colour Palette");

        recommendationReasons.push(
          `Its ${product.color} colour matches a colour in your room palette.`
        );
      } else {
        missingAttributes.push("Room Colour Palette");
      }
    }

    // ------------------------------------------
    // F. FINAL MATCH SCORE
    // ------------------------------------------

    const matchScore =
      totalWeight === 0
        ? 100
        : Math.round((earnedWeight / totalWeight) * 100);

    // Customer preference explanations
    if (matchedAttributes.includes("Material")) {
      recommendationReasons.push(
        `${product.material} material matches your preference.`
      );
    }

    if (matchedAttributes.includes("Frame Material")) {
      recommendationReasons.push(
        `${product.frameMaterial} frame matches your preference.`
      );
    }

    if (matchedAttributes.includes("Colour")) {
      recommendationReasons.push(
        `${product.color} colour matches your preference.`
      );
    }

    if (matchedAttributes.includes("Style")) {
      recommendationReasons.push(
        `${product.style} style matches your preference.`
      );
    }

    if (matchedAttributes.includes("Durability")) {
      recommendationReasons.push(
        `Matches your ${product.durability} durability preference.`
      );
    }

    if (matchedAttributes.includes("Size")) {
      recommendationReasons.push(
        `Matches your ${product.size} size preference.`
      );
    }

    if (matchedAttributes.includes("Space-saving")) {
      recommendationReasons.push(
        "Matches your space-saving preference."
      );
    }

    if (matchedAttributes.includes("Features")) {
      recommendationReasons.push(
        "Matches some of your requested furniture features."
      );
    }

    if (matchedAttributes.includes("Keywords")) {
      recommendationReasons.push(
        "Matches some keywords in your request."
      );
    }

    // Budget explanation
    const hasBudget =
      requirements.minPrice !== null &&
      requirements.minPrice !== undefined ||
      requirements.maxPrice !== null &&
      requirements.maxPrice !== undefined;

    if (hasBudget) {
      recommendationReasons.push(
        "Price is within your requested budget."
      );
    }

    return {
      ...product,
      matchScore,
      matchDetails: {
        matchedAttributes,
        missingAttributes,
      },
      recommendationReasons,
    };
  });

  // ------------------------------------------
  // G. SORT RECOMMENDATIONS
  // ------------------------------------------

  scoredProducts.sort((a, b) => {
    if (hasAIDesignSignals) {
      return (
        b.matchScore - a.matchScore ||
        Number(a.price) - Number(b.price)
      );
    }

    const sortDifference =
      getSortValue(a, requirements.sortBy) -
      getSortValue(b, requirements.sortBy);

    if (sortDifference !== 0) {
      return sortDifference;
    }

    return b.matchScore - a.matchScore;
  });

  // ------------------------------------------
  // H. FILTER AND RETURN RESULTS
  // ------------------------------------------

  const hasMatchingPreferences = Boolean(
    requirements.material ||
    requirements.frameMaterial ||
    requirements.color ||
    requirements.style ||
    requirements.room ||
    requirements.durability ||
    requirements.size ||
    typeof requirements.spaceSaving === "boolean" ||
    (requirements.features && requirements.features.length > 0) ||
    keywords.length > 0 ||
    hasAIDesignSignals
  );

  const relevantProducts = hasMatchingPreferences
    ? scoredProducts.filter((product) => product.matchScore > 0)
    : scoredProducts;

  return relevantProducts.slice(0, 10);
}

module.exports = {
  findMatchingProducts,
};
