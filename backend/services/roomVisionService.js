
const OLLAMA_URL = "http://localhost:11434/api/generate";
const VISION_MODEL = "qwen2.5vl:3b-room";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const VALID_ROOM_TYPES = [
  "Bedroom",
  "Living Room",
  "Dining Room",
  "Office",
  "Unknown",
];

const VALID_STYLES = [
  "Modern",
  "Minimalist",
  "Traditional",
  "Industrial",
  "Scandinavian",
  "Rustic",
  "Bohemian",
  "Unknown",
];

const VALID_SPACE_CONDITIONS = [
  "Small",
  "Medium",
  "Large",
  "Unknown",
];

const cleanString = (value, fallback = "Unknown") => {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  return value.trim();
};

const cleanStringArray = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === "string" && item.trim())
    .map((item) => item.trim());
};

const analyzeRoomImage = async (imageBuffer, mimeType) => {
  // 1. Validate uploaded image.
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    throw new Error("A valid room image is required.");
  }

  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    throw new Error("Unsupported room image format.");
  }

  const imageBase64 = imageBuffer.toString("base64");

  // 2. AI room analysis prompt.
  const prompt = `
You are an intelligent interior design assistant.

Carefully analyze the uploaded room photograph.

IMPORTANT RULES:
- Describe only objects and characteristics actually visible.
- Never invent windows, doors, furniture or other objects.
- Distinguish visible facts from design suggestions.
- Do not assume customer preferences.
- Do not recommend unsupported structural changes.

Return ONLY valid JSON using this structure:

{
  "roomType": "Bedroom, Living Room, Dining Room, Office, or Unknown",

  "roomDetails": {
    "walls": "Description of visible walls",
    "floor": "Description of the floor",
    "windows": "Visible windows or not visible",
    "lighting": "Description of lighting",
    "layout": "Description of room layout",
    "visibleFurniture": [
      "Furniture items actually visible"
    ],
    "availableSpace": "Estimated available space"
  },

  "designAnalysis": {
    "detectedStyle": "Modern, Minimalist, Traditional, Industrial, Scandinavian, Rustic, Bohemian, or Unknown",
    "roomColorPalette": [
      "Visible room colour 1",
      "Visible room colour 2"
    ],
    "suggestedFurnitureMaterials": [
      "Suitable furniture material 1",
      "Suitable furniture material 2"
    ],
    "spaceCondition": "Small, Medium, Large, or Unknown",
    "designSuggestions": [
      "Furniture design suggestion 1",
      "Furniture design suggestion 2"
    ]
  },

  "improvements": [
    "Practical improvement 1",
    "Practical improvement 2",
    "Practical improvement 3",
    "Practical improvement 4",
    "Practical improvement 5"
  ]
}

ANALYSIS RULES:

1. Identify room type using visible evidence.
2. Identify interior style only when sufficient evidence exists.
3. Identify visible colours without inventing colours.
4. Suggest furniture materials that complement the room.
5. Estimate room space as Small, Medium, Large, or Unknown.
6. Suggest furniture suitable for the room layout.
7. Provide five distinct and practical improvements.
8. Focus on furniture placement, storage, lighting and design.

Return only JSON. Do not include Markdown.
`;

  // 3. Send image to Ollama vision model.
  let response;

  try {
    response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        prompt,
        images: [imageBase64],
        format: "json",
        stream: false,
      }),
      signal: AbortSignal.timeout(900000),
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new Error("Room analysis timed out. Please try again.");
    }

    throw new Error(
      `Unable to connect to Ollama: ${error.message}`
    );
  }

  // 4. Handle Ollama errors.
  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Ollama request failed (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();

  if (!data.response || typeof data.response !== "string") {
    throw new Error("The vision AI returned an empty response.");
  }

  // 5. Parse AI JSON response.
  let analysis;

  try {
    analysis = JSON.parse(data.response);
  } catch {
    throw new Error("The vision AI returned invalid JSON.");
  }

  // 6. Validate main response structure.
  if (
    !analysis ||
    typeof analysis !== "object" ||
    Array.isArray(analysis) ||
    !analysis.roomDetails ||
    typeof analysis.roomDetails !== "object" ||
    Array.isArray(analysis.roomDetails) ||
    !analysis.designAnalysis ||
    typeof analysis.designAnalysis !== "object" ||
    Array.isArray(analysis.designAnalysis)
  ) {
    throw new Error(
      "The vision AI response has an invalid structure."
    );
  }

  const roomDetails = analysis.roomDetails;
  const design = analysis.designAnalysis;

  // 7. Normalize room type.
  const requestedRoomType = cleanString(analysis.roomType);

  const roomType = VALID_ROOM_TYPES.includes(requestedRoomType)
    ? requestedRoomType
    : "Unknown";

  // 8. Normalize design style.
  const requestedStyle = cleanString(design.detectedStyle);

  const detectedStyle = VALID_STYLES.includes(requestedStyle)
    ? requestedStyle
    : "Unknown";

  // 9. Normalize space condition.
  const requestedSpace = cleanString(design.spaceCondition);

  const spaceCondition = VALID_SPACE_CONDITIONS.includes(
    requestedSpace
  )
    ? requestedSpace
    : "Unknown";

  // 10. Clean improvements.
  let improvements = cleanStringArray(analysis.improvements);

  // Keep up to five unique improvements.
  improvements = [...new Set(improvements)].slice(0, 5);

  // 11. Return complete structured analysis.
  return {
    roomType,

    roomDetails: {
      walls: cleanString(roomDetails.walls),
      floor: cleanString(roomDetails.floor),
      windows: cleanString(roomDetails.windows),
      lighting: cleanString(roomDetails.lighting),
      layout: cleanString(roomDetails.layout),
      visibleFurniture: cleanStringArray(
        roomDetails.visibleFurniture
      ),
      availableSpace: cleanString(roomDetails.availableSpace),
    },

    designAnalysis: {
      detectedStyle,
      roomColorPalette: cleanStringArray(
        design.roomColorPalette
      ),
      suggestedFurnitureMaterials: cleanStringArray(
        design.suggestedFurnitureMaterials
      ),
      spaceCondition,
      designSuggestions: cleanStringArray(
        design.designSuggestions
      ),
    },

    improvements,

    rawAIResponse: data.response,
  };
};

module.exports = {
  analyzeRoomImage,
};
