// Import the Node.js crypto module for cryptographic functions
const crypto = require('crypto');

// Verifies the HMAC SHA-256 signature of an incoming request
// @param {Object} req - The incoming HTTP request object
// @param {string} secret - The secret key used to compute the HMAC
// @returns {boolean} True if the signature is valid, false otherwise
const verifyGitHubSignature = (req, secret) => {
    // Extract the signature from the request headers
    const signature = req.headers['x-hub-signature-256'];
    
    // Return false if no signature is provided
    if (!signature) {
        console.log("[GitHub] No signature header provided");
        return false;
    }

    if (!secret) {
        console.log("[GitHub] No secret provided for verification");
        return false;
    }

    // CRITICAL: Remove trailing whitespace from secret (common .env file issue)
    const cleanSecret = secret.trim();
    
    // Ensure req.body is a Buffer for accurate HMAC computation
    const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
    
    // Debug: Log the payload and secret details
    console.log("[GitHub] Debug Info:");
    console.log("  Payload type:", typeof req.body, "isBuffer:", Buffer.isBuffer(req.body));
    console.log("  Payload length:", payload.length);
    console.log("  Payload (first 100 chars):", payload.toString().substring(0, 100));
    console.log("  Secret length (raw):", secret.length, "Secret length (trimmed):", cleanSecret.length);
    console.log("  Secret matches after trim:", secret === cleanSecret ? "NO - has whitespace!" : "YES");
    
    // Compute the HMAC SHA-256 of the request body using the secret
    const hmac = crypto
        .createHmac('sha256', cleanSecret)
        .update(payload)
        .digest('hex');
    
    // Format the computed HMAC with the 'sha256=' prefix
    const expectedSignature = `sha256=${hmac}`;
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    console.log("[GitHub] Signature verification:");
    console.log("  Received:", signature);
    console.log("  Expected:", expectedSignature);
    console.log("  Match:", signature === expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length) {
        console.log("[GitHub] Signature length mismatch");
        return false;
    }

    // Compare the provided and expected signatures securely
    try {
        return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    } catch (err) {
        console.log("[GitHub] Signature comparison error:", err.message);
        return false;
    }
}

// Verifies the signature from the incoming request
// @param {Object} req - The incoming HTTP request object
// @param {string} secret - The secret key directly from the .env
// @returns {boolean} True if the signature is valid, false otherwise
const verifyGitLabSignature = (req, secret) => {
  const token = req.headers['x-gitlab-token'];
//   console.log(token);
  return token && token === secret;
};

// Export the verifySignature function for use in other modules
module.exports = { verifyGitHubSignature, verifyGitLabSignature };