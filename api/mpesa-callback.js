module.exports = function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  console.log("M-Pesa callback:", JSON.stringify(req.body || {}, null, 2));
  res.status(200).json({ ok: true });
};
