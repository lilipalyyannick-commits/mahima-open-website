
const https = require("https");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const TOKEN = process.env.GITHUB_TOKEN;
  const REPO = process.env.GITHUB_REPO;
  const SECRET = process.env.ADMIN_SECRET;

  // GET — return current spots
  if (event.httpMethod === "GET") {
    return new Promise((resolve) => {
      const options = {
        hostname: "api.github.com",
        path: `/repos/${REPO}/contents/spots.json`,
        headers: { "Authorization": `token ${TOKEN}`, "User-Agent": "mahima-open" }
      };
      const req = https.get(options, (res) => {
        let data = "";
        res.on("data", d => data += d);
        res.on("end", () => {
          try {
            const file = JSON.parse(data);
            const spots = JSON.parse(Buffer.from(file.content, "base64").toString());
            resolve({ statusCode: 200, headers, body: JSON.stringify({ spots, sha: file.sha }) });
          } catch(e) {
            resolve({ statusCode: 500, headers, body: JSON.stringify({ error: "Parse error: " + e.message }) });
          }
        });
      });
      req.on("error", e => resolve({ statusCode: 500, headers, body: JSON.stringify({ error: e.message }) }));
    });
  }

  // POST — update spots
  if (event.httpMethod === "POST") {
    let body;
    try { body = JSON.parse(event.body); } catch(e) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
    }

    if (body.secret !== SECRET) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
    }

    const { spots, sha } = body;
    const content = Buffer.from(JSON.stringify(spots, null, 2)).toString("base64");
    const payload = JSON.stringify({ message: "Update spots via admin panel", content, sha });

    return new Promise((resolve) => {
      const options = {
        hostname: "api.github.com",
        path: `/repos/${REPO}/contents/spots.json`,
        method: "PUT",
        headers: {
          "Authorization": `token ${TOKEN}`,
          "Content-Type": "application/json",
          "User-Agent": "mahima-open",
          "Content-Length": Buffer.byteLength(payload)
        }
      };
      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", d => data += d);
        res.on("end", () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            const updated = JSON.parse(data);
            resolve({ statusCode: 200, headers, body: JSON.stringify({ ok: true, sha: updated.content.sha }) });
          } else {
            resolve({ statusCode: res.statusCode, headers, body: data });
          }
        });
      });
      req.on("error", e => resolve({ statusCode: 500, headers, body: JSON.stringify({ error: e.message }) }));
      req.write(payload);
      req.end();
    });
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
};
