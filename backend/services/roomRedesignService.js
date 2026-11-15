
const sharp = require("sharp");
const cloudinary = require("../config/cloudinary");

const ALLOWED_STYLES = [
  "Modern",
  "Minimalist",
  "Scandinavian",
  "Industrial",
  "Bohemian",
  "Traditional",
  "Contemporary",
  "Japandi",
];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Download and validate original room image.
const downloadOriginalImage = async (imageUrl) => {
  let parsedUrl;

  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    throw new Error("Invalid original image URL.");
  }

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.hostname !== "res.cloudinary.com"
  ) {
    throw new Error("Original image must be hosted on Cloudinary.");
  }

  const response = await fetch(imageUrl, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(
      `Could not download original image. HTTP ${response.status}`
    );
  }

  const contentType = response.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();

  if (!Object.prototype.hasOwnProperty.call(
    ALLOWED_IMAGE_TYPES,
    contentType
  )) {
    throw new Error("Unsupported room image format.");
  }

  const contentLength = Number(
    response.headers.get("content-length") || 0
  );

  if (contentLength > MAX_IMAGE_SIZE) {
    throw new Error("Room image must not exceed 10 MB.");
  }

  const arrayBuffer = await response.arrayBuffer();

  if (
    arrayBuffer.byteLength === 0 ||
    arrayBuffer.byteLength > MAX_IMAGE_SIZE
  ) {
    throw new Error("Room image must be between 1 byte and 10 MB.");
  }

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType,
  };
};

// Resize the original image for FLUX.2 Klein 4B.
const prepareImageForCloudflare = async (imageBuffer) => {
  return sharp(imageBuffer)
    .rotate()
    .resize({
      width: 511,
      height: 511,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
};

// Build the redesign prompt.
const buildRedesignPrompt = ({
  style,
  roomType,
  designAnalysis,
}) => {
  const safeRoomType =
    typeof roomType === "string" && roomType.trim()
      ? roomType.trim()
      : "room";

  const palette = Array.isArray(
    designAnalysis?.roomColorPalette
  )
    ? designAnalysis.roomColorPalette.join(", ")
    : "Choose a balanced palette suitable for the selected style.";

  const materials = Array.isArray(
    designAnalysis?.suggestedFurnitureMaterials
  )
    ? designAnalysis.suggestedFurnitureMaterials.join(", ")
    : "Choose realistic materials suitable for the selected style.";

  return `
Edit the supplied photograph of the existing ${safeRoomType}.

Create a photorealistic interior redesign in the ${style} style.

REFERENCE IMAGE:
Use the supplied image as the original room.
The result must clearly represent the SAME physical room.

DESIGN STYLE:
${style}

COLOR PALETTE:
${palette}

SUGGESTED MATERIALS:
${materials}

PRESERVE THE ORIGINAL ROOM:
- Keep the same wall positions and architecture.
- Keep the original floor and flooring pattern.
- Keep the same ceiling structure.
- Preserve doors and windows in their original positions.
- Preserve the room dimensions and layout.
- Maintain the original camera angle and perspective.
- Preserve the overall identity of the original room.

YOU MAY REDESIGN:
- Beds, sofas, chairs and tables.
- Furniture styles and arrangements.
- Storage furniture.
- Rugs and curtains.
- Cushions and lighting.
- Wall artwork and decorations.
- Other non-structural interior accessories.

DESIGN REQUIREMENTS:
Apply the ${style} style consistently.
Use the suggested materials and color palette.
Make furniture placement realistic and functional.

IMAGE QUALITY:
- Photorealistic interior photography.
- Natural lighting and realistic shadows.
- Accurate furniture proportions.
- High-quality textures.
- Professional interior design appearance.

IMPORTANT:
Do not create a completely different room.
Do not change the original architecture.
Focus on redesigning furniture and decorations.

Do not add text, labels, borders or watermarks.
`;
};

// Generate the redesigned room using Cloudflare Workers AI.
const generateRedesignedImage = async ({
  imageUrl,
  style,
  roomType,
  designAnalysis,
}) => {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error(
      "Cloudflare Account ID or API token is not configured."
    );
  }

  if (!ALLOWED_STYLES.includes(style)) {
    throw new Error("Unsupported interior design style.");
  }

  if (!imageUrl) {
    throw new Error("Original room image URL is missing.");
  }

  // Step 1: Download original image.
  const original = await downloadOriginalImage(imageUrl);

  // Step 2: Resize original image.
  const preparedImage = await prepareImageForCloudflare(
    original.buffer
  );

  // Step 3: Build prompt.
  const prompt = buildRedesignPrompt({
    style,
    roomType,
    designAnalysis,
  });

  // Step 4: Create multipart request.
  const formData = new FormData();

  formData.append("prompt", prompt);

  formData.append(
    "input_image_0",
    new Blob([preparedImage], {
      type: "image/png",
    }),
    "original-room.png"
  );

  // Step 5: Call Cloudflare FLUX.2 Klein 4B.
  const model =
    "@cf/black-forest-labs/flux-2-klein-4b";

  const apiUrl =
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
    },
    body: formData,
    signal: AbortSignal.timeout(180000),
  });

  // Step 6: Read API response.
  const responseData = await response.json();

  if (!response.ok || responseData.success === false) {
    const errorMessage =
      responseData.errors
        ?.map((error) => error.message)
        .join(", ") ||
      `Cloudflare API request failed. HTTP ${response.status}`;

    throw new Error(errorMessage);
  }

  // Step 7: Extract generated image.
  const imageBase64 = responseData.result?.image;

  if (!imageBase64) {
    throw new Error(
      "Cloudflare did not return a redesigned image."
    );
  }

  const imageBuffer = Buffer.from(imageBase64, "base64");

  if (imageBuffer.length === 0) {
    throw new Error("Generated image is empty.");
  }

  // Normalize generated image to PNG.
  const redesignedBuffer = await sharp(imageBuffer)
    .png()
    .toBuffer();

  if (redesignedBuffer.length === 0) {
    throw new Error("Could not process generated image.");
  }

  return redesignedBuffer;
};

// Upload redesigned image to Cloudinary.
const uploadRedesignedImage = (imageBuffer, analysisId) => {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    return Promise.reject(
      new Error("Invalid redesigned image buffer.")
    );
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "ai-interior-shop/room-redesigns",
        public_id: `redesign-${analysisId}-${Date.now()}`,
        resource_type: "image",
        format: "png",
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        if (!result?.secure_url || !result?.public_id) {
          return reject(
            new Error(
              "Cloudinary did not return uploaded image details."
            )
          );
        }

        resolve(result);
      }
    );

    uploadStream.on("error", reject);
    uploadStream.end(imageBuffer);
  });
};

module.exports = {
  ALLOWED_STYLES,
  generateRedesignedImage,
  uploadRedesignedImage,
};
