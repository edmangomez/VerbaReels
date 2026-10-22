async function testAPI() {
  console.log("1. Testing /api/ai/test...")
  const res1 = await fetch("http://localhost:3001/api/ai/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseUrl: process.env.AI_BASE_URL || "https://openrouter.ai/api/v1",
      apiKey: process.env.AI_API_KEY || "",
      model: process.env.AI_MODEL || "meta-llama/llama-3.3-70b-instruct:free"
    })
  })
  const data1 = await res1.json()
  console.log("Test connection response:", data1)

  console.log("\n2. Testing /api/backgrounds/suggest with IA...")
  const res2 = await fetch("http://localhost:3001/api/backgrounds/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phrase: "El éxito es la suma de pequeños esfuerzos repetidos día tras día."
    })
  })
  const data2 = await res2.json()
  console.log("Backgrounds source:", data2.source)
  console.log("Backgrounds results count:", data2.results?.length)

  console.log("\n3. Testing /api/description/generate with IA...")
  const res3 = await fetch("http://localhost:3001/api/description/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phrase: "El éxito es la suma de pequeños esfuerzos repetidos día tras día.",
      network: "instagram"
    })
  })
  const data3 = await res3.json()
  console.log("Describe response:", data3)
}

testAPI()
