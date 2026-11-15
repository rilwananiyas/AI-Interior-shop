
const OLLAMA_URL = "http://127.0.0.1:11434/api/generate";
const MODEL = "qwen2.5:3b";

const ALLOWED_CATEGORIES = [
  "Sofas",
  "Chairs",
  "Tables",
  "Beds",
  "Storage",
  "Lighting",
  "Decor",
];

const ALLOWED_ROOMS = [
  "Bedroom",
  "Living Room",
  "Dining Room",
  "Office",
];

// Detect messages that only request sorting.
function isSortingOnlyMessage(message) {
  const text = message.toLowerCase().trim();

  const sortingPatterns = [
    /^(sort|order)\s+by\s+(the\s+)?(highest|lowest|highest price|lowest price|price|cheapest|most expensive|newest|latest|stock)\b/i,
    /^(show|display|list)\s+(the\s+)?(cheapest|most expensive|highest priced|lowest priced|newest|latest)\b/i,
    /^(cheaper|cheapest|more expensive|most expensive|highest price|lowest price|price high to low|price low to high)\b/i,
    /^(sort|order)\s+(the\s+)?(products|results|items)\s+(by|from)\b/i,
  ];

  return sortingPatterns.some((pattern) => pattern.test(text));
}

// Detect when the customer is specifically asking for a wooden frame.
function requestsWoodenFrame(message) {
  const text = message.toLowerCase();

  const framePatterns = [
    /\bwooden[- ]frame\b/i,
    /\bwood[- ]frame\b/i,
    /\bframe\s+(?:made\s+of|constructed\s+from)\s+wood\b/i,
    /\bwooden\s+frame\b/i,
    /\bframe\s+of\s+wood\b/i,
  ];

  // For sofas and chairs, "wooden sofa/chair" normally refers
  // to the frame rather than the upholstery.
  const furniturePatterns = [
    /\bwooden\s+(?:sofa|sofas|chair|chairs|armchair|armchairs)\b/i,
    /\b(?:sofa|sofas|chair|chairs|armchair|armchairs)\s+(?:with|having)\s+(?:a\s+)?wooden\s+frame\b/i,
  ];

  return (
    framePatterns.some((pattern) => pattern.test(text)) ||
    furniturePatterns.some((pattern) => pattern.test(text))
  );
}

// Remove irrelevant and unsupported AI-generated keywords.
function cleanKeywords(keywords, message, extracted = {}) {
  if (!Array.isArray(keywords)) {
    return [];
  }

  const ignoredWords = [
    // Generic shopping words.
    "show",
    "me",
    "find",
    "search",
    "look",
    "recommend",
    "suggest",
    "want",
    "need",
    "some",
    "the",
    "a",
    "an",
    "please",
    "products",
    "product",
    "furniture",
    "items",
    "item",

    // Sorting words.
    "sort",
    "sorting",
    "order",
    "highest",
    "lowest",
    "cheapest",
    "cheaper",
    "expensive",
    "newest",
    "latest",
    "stock",

    // Price-related words.
    "above",
    "below",
    "under",
    "over",
    "between",
    "less",
    "more",
    "than",
    "price",
    "prices",
    "budget",
    "within",
    "maximum",
    "minimum",
    "max",
    "min",
    "up",
    "to",
    "at",
    "most",
    "least",
    "cost",
    "costs",
    "lkr",
    "rs",
    "rupees",
    "rupee",

    // Furniture categories.
    ...ALLOWED_CATEGORIES.map((item) => item.toLowerCase()),

    // Room names.
    ...ALLOWED_ROOMS.map((item) => item.toLowerCase()),
  ];

  const ignoredAttributes = [
    extracted.material,
    extracted.frameMaterial,
    extracted.color,
    extracted.style,
    extracted.room,
    extracted.category,
  ]
    .filter(Boolean)
    .map((item) => item.toLowerCase());

  const messageText = message.toLowerCase();

  return keywords
    .filter((word) => typeof word === "string")
    .map((word) => word.trim())
    .filter(Boolean)

    // Only accept keywords explicitly present in the message.
    .filter((word) => messageText.includes(word.toLowerCase()))

    // Remove generic shopping, sorting and price words.
    .filter(
      (word) => !ignoredWords.includes(word.toLowerCase())
    )

    // Remove attributes already handled by dedicated filters.
    .filter(
      (word) => !ignoredAttributes.includes(word.toLowerCase())
    )

    // Avoid duplicate keywords.
    .filter(
      (word, index, array) =>
        array.findIndex(
          (item) => item.toLowerCase() === word.toLowerCase()
        ) === index
    )

    .slice(0, 8);
}

const extractFurnitureRequirements = async (message) => {
  // Sorting-only messages must not create new product requirements.
  if (isSortingOnlyMessage(message)) {
    return {
      category: null,
      minPrice: null,
      maxPrice: null,
      material: null,
      frameMaterial: null,
      color: null,
      style: null,
      room: null,
      keywords: [],
    };
  }

  const prompt = `
You are a furniture shopping assistant.

Analyze the customer's message and extract only the requirements
they explicitly mention or clearly imply.

Customer message: ${JSON.stringify(message)}

Return ONLY valid JSON using this exact structure:
{
  "category": null,
  "minPrice": null,
  "maxPrice": null,
  "material": null,
  "frameMaterial": null,
  "color": null,
  "style": null,
  "room": null,
  "keywords": []
}

Rules:
1. category must be one of: ${ALLOWED_CATEGORIES.join(", ")}.
2. room must be one of: ${ALLOWED_ROOMS.join(", ")}.
3. Use null when a requirement is not specified.
4. minPrice and maxPrice must be numbers in LKR, or null.
5. For "under 50000", maxPrice is 50000.
6. For "above 30000", minPrice is 30000.
7. For a price range, extract both minPrice and maxPrice.
8. material means upholstery or the main furniture material.
9. material examples: Wood, Metal, Glass, Fabric, Leather, Rattan.
10. frameMaterial means the material used to construct the furniture frame.
11. frameMaterial examples: Wood, Metal.
12. "Leather sofa" means material is Leather.
13. "Fabric sofa" means material is Fabric.
14. "Sofa with a wooden frame" means frameMaterial is Wood.
15. "Wooden-frame sofa" means frameMaterial is Wood.
16. "Wooden sofa" normally means frameMaterial is Wood, not leather or fabric upholstery.
17. Do not set material to Wood when the customer specifically means a wooden sofa frame.
18. color examples: Black, White, Brown, Grey, Beige, Blue, Green.
19. style examples: Modern, Minimalist, Classic, Scandinavian, Industrial.
20. Keywords must be useful product characteristics explicitly mentioned by the customer.
21. Do not repeat category, room, material, frameMaterial, color or style as keywords.
22. Do not include generic shopping words.
23. Do not include sorting instructions in keywords.
24. Never include price-related words such as above, below, under, over, between, budget or price in keywords.
25. Do not invent requirements or keywords.
26. Return JSON only.
`;

  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      format: "json",
      options: {
        temperature: 0.1,
      },
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status}`);
  }

  const data = await response.json();

  let requirements;

  try {
    requirements = JSON.parse(data.response);
  } catch (error) {
    throw new Error("Ollama returned invalid JSON.");
  }

  const category = ALLOWED_CATEGORIES.includes(requirements.category)
    ? requirements.category
    : null;

  const room = ALLOWED_ROOMS.includes(requirements.room)
    ? requirements.room
    : null;

  const validPrice = (value) =>
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
      ? value
      : null;

  const minPrice = validPrice(requirements.minPrice);
  const maxPrice = validPrice(requirements.maxPrice);

  const cleanText = (value) =>
    typeof value === "string"
      ? value.trim().slice(0, 50) || null
      : null;

  let material = cleanText(requirements.material);
  let frameMaterial = cleanText(requirements.frameMaterial);

  const color = cleanText(requirements.color);
  const style = cleanText(requirements.style);

  // Deterministically handle wooden-frame requests.
  if (requestsWoodenFrame(message)) {
    frameMaterial = "Wood";

    // Wood belongs to the frame field for this request.
    if (material && normalizeMaterial(material) === "wood") {
      material = null;
    }
  }

  const keywords = cleanKeywords(
    requirements.keywords,
    message,
    {
      category,
      room,
      material,
      frameMaterial,
      color,
      style,
    }
  );

  return {
    category,
    minPrice,
    maxPrice,
    material,
    frameMaterial,
    color,
    style,
    room,
    keywords,
  };
};

// Normalize a material value for deterministic comparison.
function normalizeMaterial(value) {
  return String(value || "").trim().toLowerCase();
};

module.exports = {
  extractFurnitureRequirements,
};
