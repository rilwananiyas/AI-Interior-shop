
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
You are an expert AI interior design assistant.

Analyze the uploaded room photograph carefully.

IMPORTANT:
- Describe only things actually visible in the photograph.
- Never invent furniture, windows, doors or other objects.
- Do not confuse suggestions with visible facts.
- If something cannot be identified, use "Unknown".
- Provide practical furniture and interior design suggestions.

Return ONLY valid JSON using this exact structure:

{
  "roomType": "Bedroom, Living Room, Dining Room, Office, or Unknown",
  "roomDetails": {
    "walls": "Visible wall description",
    "floor": "Visible floor description",
    "windows": "Visible windows or Unknown",
    "lighting": "Lighting description",
    "layout": "Room layout description",
    "visibleFurniture": ["Visible furniture item"],
    "availableSpace": "Estimated available space"
  },
  "designAnalysis": {
    "detectedStyle": "Modern, Minimalist, Traditional, Industrial, Scandinavian, Rustic, Bohemian, or Unknown",
    "roomColorPalette": ["Visible colour 1", "Visible colour 2"],
    "suggestedFurnitureMaterials": ["Material 1", "Material 2"],
    "spaceCondition": "Small, Medium, Large, or Unknown",
    "designSuggestions": ["Suggestion 1", "Suggestion 2"]
  },
  "improvements": [
    "Practical improvement 1",
    "Practical improvement 2",
    "Practical improvement 3",
    "Practical improvement 4",
    "Practical improvement 5"
  ]
}

Identify the room type, visible colours, furniture, materials and space.
Suggest improvements for furniture placement, storage, lighting and design.

Return only JSON. Do not include Markdown or explanations.
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
        keep_alive: "10m",
        options: {
          temperature: 0.2,
          num_predict: 1200,
        },
      }),
      signal: AbortSignal.timeout(900000),
    });
  } catch (error) {
    if (
      error.name === "TimeoutError" ||
      error.name === "AbortError"
    ) {
      throw new Error(
        "Room analysis timed out. Please try again."
      );
    }

    throw new Error(
      `Unable to connect to Ollama: ${error.message}`
    );
  }

  // 4. Handle Ollama HTTP errors.
  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Ollama request failed (${response.status}): ${errorText}`
    );
  }

  // 5. Read Ollama response.
  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("Ollama returned an invalid JSON response.");
  }

  // Temporary debugging information.
  console.log("========== OLLAMA DEBUG ==========");
  console.log("Model:", VISION_MODEL);
  console.log("Response keys:", Object.keys(data));
  console.log("Done:", data.done);
  console.log("Done reason:", data.done_reason);
  console.log("Response length:", data.response?.length || 0);
  console.log("Ollama error:", data.error || "None");
  console.log("==================================");

  if (data.error) {
    throw new Error(`Ollama error: ${data.error}`);
  }

  // Support both generate and chat response structures.
  const aiResponse =
    typeof data.response === "string"
      ? data.response.trim()
      : typeof data.message?.content === "string"
        ? data.message.content.trim()
        : "";

  if (!aiResponse) {
    console.error("Empty Ollama response details:", {
      model: VISION_MODEL,
      done: data.done,
      done_reason: data.done_reason,
      prompt_eval_count: data.prompt_eval_count,
      eval_count: data.eval_count,
    });

    throw new Error(
      `The vision AI returned an empty response. ` +
      `Model: ${VISION_MODEL}. ` +
      `Done reason: ${data.done_reason || "Unknown"}. ` +
      `Check the backend terminal for Ollama debug details.`
    );
  }

  // 6. Parse AI JSON response.
  let analysis;

  try {
    analysis = JSON.parse(aiResponse);
  } catch (error) {
    console.error("Invalid AI JSON response:", aiResponse);

    throw new Error(
      "The vision AI returned invalid JSON. Please try again."
    );
  }

  // 7. Validate main response structure.
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

  // 8. Normalize room type.
  const requestedRoomType = cleanString(analysis.roomType);

  const roomType = VALID_ROOM_TYPES.includes(requestedRoomType)
    ? requestedRoomType
    : "Unknown";

  // 9. Normalize design style.
  const requestedStyle = cleanString(design.detectedStyle);

  const detectedStyle = VALID_STYLES.includes(requestedStyle)
    ? requestedStyle
    : "Unknown";

  // 10. Normalize space condition.
  const requestedSpace = cleanString(design.spaceCondition);

  const spaceCondition = VALID_SPACE_CONDITIONS.includes(
    requestedSpace
  )
    ? requestedSpace
    : "Unknown";

  // 11. Clean improvements.
  const improvements = [
    ...new Set(cleanStringArray(analysis.improvements)),
  ].slice(0, 5);

  // 12. Return complete structured analysis.
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

    rawAIResponse: aiResponse,
  };
};

module.exports = {
  analyzeRoomImage,
};
