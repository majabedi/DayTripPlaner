import OpenAI from 'openai';

// This function runs on Vercel's serverless environment
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { placesTextList } = req.body;

        if (!placesTextList) {
            return res.status(400).json({ error: 'placesTextList is required' });
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

        const prompt = `I am planning a trip with my family. Here is a list of points of interest I found nearby:
${placesTextList}

Please analyze this list and perform the following tasks:
1. Identify the TOP 10 most family-friendly locations from this list.
2. For these Top 10 locations ONLY, provide a detailed (1-3 sentences) explanation of why it is suitable for families based STRICTLY on the provided details. 
3. DO NOT mention or list any places outside of the Top 10.
4. If information (like hours or wheelchair access) is marked as "N/A" or missing, DO NOT mention it at all. Only discuss the positive aspects you know for sure.

Format your response cleanly with markdown headings for each of the Top 10 places. Do not include an "Other Mentions" section.`;

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
        return res.status(500).json({ error: 'Failed to communicate with AI service.', details: error.message });
    }
}
