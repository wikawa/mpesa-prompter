module.exports = function handler(_req, res) {
  res.status(200).json({
    ok: true,
    service: "mpesa-prompter",
    proxy: "/api/stk-push",
    callback: "/api/mpesa-callback",
  });
};
