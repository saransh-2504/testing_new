export default async function handler(req, res) {
  
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { q = "latest", topic = "general", page = 0 } = req.query;

  const API_KEY = "01f34776ac18f47af61d0c44277a190d";
  const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&topic=${topic}&lang=en&max=20&page=${page}&apikey=${API_KEY}`;

  try {
    const r = await fetch(url);
    const data = await r.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("API error:", err);
    return res.status(500).json({ error: "Failed to fetch news" });
  }
}
