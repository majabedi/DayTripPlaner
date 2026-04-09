import OpenAI from 'openai';

// This function runs on Vercel's serverless environment
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { placesTextList, travelGroup } = req.body;

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

        let groupInfoStr = "Unknown group";
        if (travelGroup && travelGroup.length > 0) {
            groupInfoStr = travelGroup.map(m => `- Age: ${m.age}, Sex: ${m.sex}, Interests: ${m.interests}`).join('\n');
        }

        const prompt = `I am planning a trip. Here is the profile of the people traveling with me:
${groupInfoStr}

Here is a list of points of interest I found nearby:
${placesTextList}

Analyze this list and execute these instructions EXACTLY:
1. Output ONLY the TOP 10 most suitable locations tailored to my travel group's age, sex, and interests. If there are fewer than 10 total places, just output the ones that exist. DO NOT complain or mention that there are fewer than 10.
2. For each location, provide EXACTLY 2 to 3 sentences explaining why it is suitable for my specific group based STRICTLY on the provided details of the place and our group profile. Be creative but accurate.
3. DO NOT output your thought process (e.g., "Since there are only 5...", or "The instruction is ambiguous..."). 
4. DO NOT output any introductory text or concluding text. 
5. DO NOT mention missing information or "N/A" values.
6. Format your response strictly as a Markdown list with headings (###) for each place.

Go directly into the list of the top locations now.`;

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
