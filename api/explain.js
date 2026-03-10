import OpenAI from 'openai';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { context } = req.body;

        if (!context) {
            return res.status(400).json({ error: 'context is required' });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        const apiUrl = process.env.OPENAI_API_URL || 'https://api.openai.com/v1';
        const modelName = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

        if (!apiKey) {
             return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server environment.' });
        }

        const openai = new OpenAI({
            apiKey: apiKey,
            baseURL: apiUrl,
        });

        const prompt = `I am considering visiting a specific place with my family. Here are the details about the location:

${context}

Explain how family-friendly this location is based on these details. Consider aspects like the type of place, potential accessibility, and general expectations for a family visit. Keep your response to 2-3 sentences.`;

        const completion = await openai.chat.completions.create({
            model: modelName,
            messages: [
                { role: "system", content: "You are a helpful travel assistant specializing in family trips." },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
        });

        return res.status(200).json({
            content: completion.choices[0].message.content
        });

    } catch (error) {
        console.error("AI API Error:", error);
        return res.status(500).json({ error: 'Failed to query AI for this point.', details: error.message });
    }
}
