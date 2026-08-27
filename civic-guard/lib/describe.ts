export async function describeReport(input: {
  label: string;
  severity: number;
  latitude: number;
  longitude: number;
  userText?: string;
}): Promise<string> {
  const { label, severity, latitude, longitude, userText } = input;
  
  const prompt = `Write a short plain-text description for a civic issue report.
Issue category: ${label}
Severity level: ${severity}/5
Location GPS: ${latitude}, ${longitude}
User provided details: ${userText || "None"}

Keep it concise and factual. Do not include markdown or formatting.`;

  const providers = [
    {
      name: "Groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
    },
    {
      name: "Cerebras",
      url: "https://api.cerebras.ai/v1/chat/completions",
      key: process.env.CEREBRAS_API_KEY,
      model: process.env.CEREBRAS_MODEL || "llama3.1-8b",
    },
    {
      name: "Mistral",
      url: "https://api.mistral.ai/v1/chat/completions",
      key: process.env.MISTRAL_API_KEY,
      model: process.env.MISTRAL_MODEL || "mistral-tiny",
    },
  ];

  for (const provider of providers) {
    if (!provider.key) continue;

    try {
      const response = await fetch(provider.url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${provider.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          return text.trim();
        }
      }
    } catch (err) {
      console.warn(`[Describe] ${provider.name} provider failed:`, err);
      // fallthrough
    }
  }

  // Local template fallback (mandatory)
  let description = `A ${label.replace(/_/g, ' ')} issue was reported at coordinates [${latitude}, ${longitude}] with a severity level of ${severity}.`;
  if (userText) {
    description += ` Additional details provided by the user: "${userText}"`;
  }
  return description;
}
