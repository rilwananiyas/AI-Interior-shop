
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import "../styles/InteriorAssistant.css";

const suggestions = [
  "Find a modern sofa under LKR 150,000",
  "I need a wooden bed under LKR 100,000",
  "Show me affordable office chairs",
  "Suggest furniture for my living room",
];

function InteriorAssistant() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [previousRequirements, setPreviousRequirements] = useState({});

  // Keep the latest requirements available for the next request.
  const requirementsRef = useRef({});

  const updateRequirements = (requirements) => {
    const safeRequirements =
      requirements &&
      typeof requirements === "object" &&
      !Array.isArray(requirements)
        ? requirements
        : {};

    requirementsRef.current = safeRequirements;
    setPreviousRequirements(safeRequirements);
  };

  // Check whether the customer has actual furniture preferences.
  const hasMatchingPreferences = (requirements = {}) => {
    const preferenceFields = [
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
      "keywords",
      "durability",
      "size",
      "spaceSaving",
      "features",
    ];

    return preferenceFields.some((field) => {
      const value = requirements[field];

      if (Array.isArray(value)) {
        return value.length > 0;
      }

      return (
        value !== undefined &&
        value !== null &&
        value !== ""
      );
    });
  };

  const sendMessage = async (text) => {
    const userMessage = text.trim();

    if (!userMessage || loading) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", text: userMessage },
    ]);

    setMessage("");
    setLoading(true);

    try {
      // Read the latest requirements before sending.
      const currentRequirements = {
        ...requirementsRef.current,
      };

      console.log(
        "SENDING PREVIOUS REQUIREMENTS:",
        currentRequirements
      );

      const response = await api.post("/ai/recommendations", {
        message: userMessage,
        previousRequirements: currentRequirements,
      });

      const data = response.data || {};

      console.log(
        "BACKEND RETURNED REQUIREMENTS:",
        data.requirements
      );

      // Update conversation memory.
      if (data.intent === "greeting") {
        updateRequirements({});
      } else if (
        data.requirements &&
        typeof data.requirements === "object" &&
        !Array.isArray(data.requirements)
      ) {
        updateRequirements(data.requirements);
      }

      const finalRequirements =
        data.intent === "greeting"
          ? {}
          : data.requirements || currentRequirements;

      const showMatchScore =
        hasMatchingPreferences(finalRequirements);

      // Display AI response and recommended products.
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            data.assistantMessage ||
            "Here are the furniture recommendations.",
          products: Array.isArray(data.products)
            ? data.products
            : [],
          showMatchScore,
        },
      ]);
    } catch (error) {
      console.error("AI Assistant error:", error);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            error.response?.data?.message ||
            "Sorry, I couldn't process your request. Please try again.",
          products: [],
          showMatchScore: false,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Handle message submission.
  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage(message);
  };

  // Format product price in LKR.
  const formatPrice = (price) =>
    new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
      maximumFractionDigits: 0,
    }).format(price || 0);

  // Start a completely new conversation.
  const startNewChat = () => {
    if (loading) return;

    setMessages([]);
    setMessage("");
    updateRequirements({});

    console.log("NEW CHAT: Previous requirements cleared");
  };

  return (
    <div className="ai-app">
      {/* SIDEBAR */}
      <aside className="ai-sidebar">
        <Link to="/" className="ai-brand">
          <span className="ai-brand-icon">✦</span>
          <span>Interior AI</span>
        </Link>

        <button
          className="new-chat-button"
          onClick={startNewChat}
          disabled={loading}
        >
          <span>＋</span> New chat
        </button>

        <div className="sidebar-section">
          <p className="sidebar-label">EXPLORE</p>

          <Link to="/products">⌕ &nbsp; Browse Products</Link>
          <Link to="/cart">▢ &nbsp; Shopping Cart</Link>
          <Link to="/my-orders">◷ &nbsp; My Orders</Link>
        </div>

        <div className="sidebar-bottom">
          <div className="ai-status">
            <span className="status-dot"></span>
            AI Assistant
            <small>Ready to help</small>
          </div>
        </div>
      </aside>

      {/* MAIN CHAT */}
      <main className="ai-main">
        <header className="ai-topbar">
          <div>
            <span className="topbar-title">
              AI Interior Assistant
            </span>

            <span className="topbar-subtitle">
              Your personal furniture finder
            </span>
          </div>

          <Link to="/products" className="browse-link">
            Browse Shop →
          </Link>
        </header>

        <section className="ai-conversation">
          {messages.length === 0 ? (
            /* WELCOME SCREEN */
            <div className="ai-welcome">
              <div className="welcome-icon">✦</div>

              <p className="welcome-eyebrow">
                YOUR SMART FURNITURE ASSISTANT
              </p>

              <h1>
                Design your space.
                <br />
                <span>Find your perfect furniture.</span>
              </h1>

              <p className="welcome-description">
                Tell me what you need, your budget, or your
                preferred style. I'll search our furniture
                collection and recommend matching products.
              </p>

              <div className="suggestion-grid">
                {suggestions.map((item) => (
                  <button
                    key={item}
                    className="suggestion-card"
                    onClick={() => sendMessage(item)}
                    disabled={loading}
                  >
                    <span>✧</span>
                    {item}
                    <span className="suggestion-arrow">↗</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* CHAT MESSAGES */
            <div className="ai-message-list">
              {messages.map((item, index) => (
                <div
                  key={index}
                  className={`ai-message-row ${item.role}`}
                >
                  {item.role === "assistant" && (
                    <div className="assistant-avatar">✦</div>
                  )}

                  <div className="ai-message-content">
                    <span className="message-author">
                      {item.role === "user"
                        ? "You"
                        : "Interior AI"}
                    </span>

                    <p className="ai-message-text">
                      {item.text}
                    </p>

                    {/* RECOMMENDED PRODUCTS */}
                    {item.products?.length > 0 && (
                      <div className="recommendation-section">
                        <h3>Recommended furniture</h3>

                        <div className="recommendation-grid">
                          {item.products.map((product) => (
                            <article
                              className="recommendation-card"
                              key={product._id}
                            >
                              <img
                                src={
                                  product.image ||
                                  "https://placehold.co/400x300?text=Furniture"
                                }
                                alt={product.name}
                                onError={(event) => {
                                  event.currentTarget.src =
                                    "https://placehold.co/400x300?text=Furniture";
                                }}
                              />

                              <div className="recommendation-info">
                                <span className="product-category">
                                  {product.category}
                                </span>

                                <h4>{product.name}</h4>

                                <p className="product-description">
                                  {product.description}
                                </p>

                                {/* AI MATCH SCORE */}
                                {item.showMatchScore &&
                                  typeof product.matchScore ===
                                    "number" && (
                                    <div className="match-score">
                                      <strong>
                                        AI Match:{" "}
                                        {Math.round(product.matchScore)}%
                                      </strong>
                                    </div>
                                  )}

                                {/* RECOMMENDATION REASONS */}
                                {product.recommendationReasons?.length >
                                  0 && (
                                  <div className="recommendation-reasons">
                                    <strong>
                                      ✨ Why we recommend this
                                    </strong>

                                    <ul>
                                      {product.recommendationReasons.map(
                                        (reason, reasonIndex) => (
                                          <li key={reasonIndex}>
                                            {reason}
                                          </li>
                                        )
                                      )}
                                    </ul>
                                  </div>
                                )}

                                {/* MATCHED ATTRIBUTES */}
                                {product.matchDetails
                                  ?.matchedAttributes?.length > 0 && (
                                  <div className="match-details">
                                    <small>
                                      Matched attributes:
                                    </small>

                                    <p>
                                      {product.matchDetails.matchedAttributes.join(
                                        ", "
                                      )}
                                    </p>
                                  </div>
                                )}

                                {/* MISSING ATTRIBUTES */}
                                {product.matchDetails
                                  ?.missingAttributes?.length > 0 && (
                                  <div className="match-details">
                                    <small>
                                      Not specified in product:
                                    </small>

                                    <p>
                                      {product.matchDetails.missingAttributes.join(
                                        ", "
                                      )}
                                    </p>
                                  </div>
                                )}

                                <strong>
                                  {formatPrice(product.price)}
                                </strong>

                                <small>
                                  {product.stock} available
                                </small>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* LOADING INDICATOR */}
              {loading && (
                <div className="ai-message-row assistant">
                  <div className="assistant-avatar">✦</div>

                  <div className="ai-message-content">
                    <span className="message-author">
                      Interior AI
                    </span>

                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                      <small>Searching furniture...</small>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* MESSAGE INPUT */}
        <footer className="ai-composer-area">
          <form
            className="ai-composer"
            onSubmit={handleSubmit}
          >
            <textarea
              value={message}
              onChange={(event) =>
                setMessage(event.target.value)
              }
              placeholder="Ask anything about furniture..."
              rows={1}
              disabled={loading}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();
                  handleSubmit(event);
                }
              }}
            />

            <button
              type="submit"
              disabled={!message.trim() || loading}
              aria-label="Send message"
            >
              ↑
            </button>
          </form>

          <p className="composer-note">
            AI recommendations are based on products available
            in our shop.
          </p>
        </footer>
      </main>
    </div>
  );
}

export default InteriorAssistant;
