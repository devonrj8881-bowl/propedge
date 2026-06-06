exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { pickId, outcome } = JSON.parse(event.body);

    if (!pickId || !outcome) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing pickId or outcome" })
      };
    }

    if (!["hit", "miss", "void"].includes(outcome)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid outcome. Must be 'hit', 'miss', or 'void'" })
      };
    }

    // Log feedback (in production, would store in database)
    const feedback = {
      pickId,
      outcome,
      timestamp: new Date().toISOString(),
      resolvedAt: null
    };

    console.log("[AI Feedback]", feedback);

    // TODO: Store in Fauna DB or similar for persistence
    // For now, this logs to Netlify function logs for tracking

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: `Feedback recorded: ${outcome}` })
    };
  } catch (error) {
    console.error("AI feedback error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
