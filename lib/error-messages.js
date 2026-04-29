function friendlyDarajaMessage(status, body) {
  const text = bodyText(body).toLowerCase();

  if (text.includes("invalid transactiontype")) {
    return "The selected payment type is not enabled for these Daraja settings. Choose Paybill, or use Till credentials that are enabled for Buy Goods.";
  }
  if (text.includes("invalid access token") || text.includes("access token")) {
    return "Daraja rejected the access token. Check your consumer key and consumer secret, then save settings again.";
  }
  if (text.includes("invalid shortcode") || text.includes("shortcode")) {
    return "Daraja rejected the business shortcode. Check that the shortcode belongs to these Daraja credentials.";
  }
  if (text.includes("invalid initiator") || text.includes("not permitted") || text.includes("permission")) {
    return "These Daraja credentials are not allowed to send this type of STK Push. Confirm the app permissions in Safaricom Daraja.";
  }
  if (text.includes("callback") || text.includes("call back")) {
    return "The callback URL is not accepted. Use a public HTTPS callback URL, or leave the default callback on the deployed website.";
  }
  if (text.includes("invalid phone") || text.includes("msisdn") || text.includes("partya") || text.includes("phonenumber")) {
    return "One of the phone numbers is not accepted by Daraja. Use Kenyan numbers like 0712345678 or 254712345678.";
  }
  if (text.includes("amount")) {
    return "Daraja rejected the amount. Enter a whole number greater than zero.";
  }
  if (text.includes("invalid credentials") || text.includes("consumer") || text.includes("unauthorized") || status === 401 || status === 403) {
    return "Daraja could not authorize these credentials. Check the environment, consumer key, consumer secret, shortcode, and passkey.";
  }
  if (text.includes("timeout") || text.includes("timed out")) {
    return "The request took too long. Try again in a moment.";
  }
  if (text.includes("rate") || text.includes("too many") || status === 408 || status === 409 || status === 425 || status === 429) {
    return "Daraja is receiving requests too quickly. The app will wait a little before trying again.";
  }
  if (text.includes("duplicate")) {
    return "Daraja says this looks like a duplicate request. Wait a little longer before trying again.";
  }
  if (text.includes("lock subscriber") || text.includes("transaction is already in process")) {
    return "This phone number already has a pending M-Pesa prompt. Ask the customer to finish or cancel it before sending another.";
  }
  if (status === 404) {
    return "The payment proxy endpoint was not found. Make sure the live site includes the /api/stk-push backend route.";
  }
  if (status >= 500) {
    return "The payment server had a problem while talking to Daraja. Try again shortly.";
  }
  if (status >= 400) {
    return "Daraja rejected the request. Please check the payment type and Daraja settings, then try again.";
  }

  return "The payment request could not be completed. Please check the settings and try again.";
}

function friendlyExceptionMessage(error) {
  const text = (error && (error.message || String(error))).toLowerCase();

  if (text.includes("failed to fetch") || text.includes("network")) {
    return "The website could not reach the payment server. Check your internet connection and try again.";
  }
  if (text.includes("token request failed")) {
    return "Daraja could not issue an access token. Check your consumer key, consumer secret, and environment.";
  }
  if (text.includes("invalid json")) {
    return "The payment server received an invalid request. Refresh the page and try again.";
  }
  if (text.includes("too large")) {
    return "The request is too large. Send fewer phone numbers at once.";
  }

  return "Something went wrong while sending the payment prompt. Please check the settings and try again.";
}

function bodyText(body) {
  if (!body) return "";
  if (typeof body === "string") return body;
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

module.exports = {
  friendlyDarajaMessage,
  friendlyExceptionMessage,
};
