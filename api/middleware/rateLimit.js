/**
 * Rate Limiting Middleware
 *
 * Protects API endpoints from abuse
 */

const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for provision endpoint
 * Strict limit: 5 provisions per hour per IP
 */
const provisionLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: {
        error: 'Too many provision requests',
        message: 'You can only provision 5 instances per hour. Please try again later.',
        retryAfter: '1 hour'
    },
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use X-Forwarded-For header if behind proxy, otherwise use IP
        return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
    },
    handler: (req, res, next, options) => {
        console.log(`[rateLimit] Provision rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json(options.message);
    }
});

/**
 * General API rate limiter
 * 60 requests per minute per IP
 */
const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    message: {
        error: 'Too many requests',
        message: 'Please slow down. Maximum 60 requests per minute.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
    }
});

/**
 * Stricter limiter for authentication endpoints
 * 10 attempts per 15 minutes
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: {
        error: 'Too many authentication attempts',
        message: 'Too many failed attempts. Please wait 15 minutes.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true // Only count failed attempts
});

/**
 * Limiter for admin endpoints
 * 100 requests per minute (higher for admins)
 */
const adminLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: {
        error: 'Admin rate limit exceeded',
        message: 'Too many admin requests. Please slow down.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Webhook limiter (for activity webhooks)
 * 1000 requests per minute (high volume expected)
 */
const webhookLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 1000,
    message: {
        error: 'Webhook rate limit exceeded'
    },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = {
    provisionLimiter,
    apiLimiter,
    authLimiter,
    adminLimiter,
    webhookLimiter
};
