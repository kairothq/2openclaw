/**
 * Input Validation Middleware
 *
 * Validates user input for provisioning and other endpoints
 */

const validator = require('validator');

/**
 * Validate Telegram bot token format
 * Format: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
 */
function isValidTelegramToken(token) {
    if (!token || typeof token !== 'string') return false;
    return /^\d{8,10}:[A-Za-z0-9_-]{35}$/.test(token);
}

/**
 * Validate API key format by provider
 */
function isValidApiKey(provider, key) {
    if (!key || typeof key !== 'string') return false;

    switch (provider) {
        case 'anthropic':
            return key.startsWith('sk-ant-');
        case 'openai':
            return key.startsWith('sk-');
        case 'google':
        case 'gemini':
            return key.startsWith('AIza');
        case 'groq':
            return key.startsWith('gsk_');
        case 'openrouter':
            return key.startsWith('sk-or-');
        default:
            // Allow unknown providers with any key
            return key.length >= 20;
    }
}

/**
 * Validate Telegram user ID (numeric string)
 */
function isValidTelegramUserId(id) {
    if (!id) return false;
    return /^\d+$/.test(String(id));
}

/**
 * Validate provision request body
 */
function validateProvisionInput(req, res, next) {
    const { telegramToken, aiProvider, apiKey, ownerIds, email, userId } = req.body;
    const errors = [];

    // User ID validation
    if (!userId || typeof userId !== 'string' || userId.length < 8) {
        errors.push('userId must be at least 8 characters');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
        errors.push('userId can only contain letters, numbers, underscores, and hyphens');
    }

    // Telegram token validation
    if (!telegramToken) {
        errors.push('Telegram bot token is required');
    } else if (!isValidTelegramToken(telegramToken)) {
        errors.push('Invalid Telegram bot token format. Expected format: 123456789:ABCdefGHI...');
    }

    // AI Provider validation
    const validProviders = ['anthropic', 'openai', 'google', 'gemini', 'groq', 'openrouter'];
    if (aiProvider && !validProviders.includes(aiProvider)) {
        errors.push(`Invalid AI provider. Must be one of: ${validProviders.join(', ')}`);
    }

    // API Key validation (optional for trial tier)
    if (apiKey && aiProvider) {
        if (!isValidApiKey(aiProvider, apiKey)) {
            const prefixHint = {
                anthropic: 'sk-ant-',
                openai: 'sk-',
                google: 'AIza',
                gemini: 'AIza',
                groq: 'gsk_',
                openrouter: 'sk-or-'
            };
            errors.push(`Invalid ${aiProvider} API key format. Keys should start with: ${prefixHint[aiProvider] || 'valid prefix'}`);
        }
    }

    // Owner IDs validation
    if (!ownerIds || !Array.isArray(ownerIds) || ownerIds.length === 0) {
        errors.push('At least one Telegram user ID is required in ownerIds array');
    } else {
        const invalidIds = ownerIds.filter(id => !isValidTelegramUserId(id));
        if (invalidIds.length > 0) {
            errors.push(`Invalid Telegram user IDs: ${invalidIds.join(', ')}. Must be numeric.`);
        }
        if (ownerIds.length > 10) {
            errors.push('Maximum 10 allowed user IDs per instance');
        }
    }

    // Email validation (optional)
    if (email && !validator.isEmail(email)) {
        errors.push('Invalid email format');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            error: 'Validation failed',
            errors
        });
    }

    next();
}

/**
 * Validate config update request
 */
function validateConfigUpdate(req, res, next) {
    const { aiProvider, apiKey, ownerIds } = req.body;
    const errors = [];

    // At least one field must be provided
    if (!aiProvider && !apiKey && !ownerIds) {
        errors.push('At least one of aiProvider, apiKey, or ownerIds must be provided');
    }

    // If changing API key, validate it
    if (apiKey && aiProvider) {
        if (!isValidApiKey(aiProvider, apiKey)) {
            errors.push(`Invalid ${aiProvider} API key format`);
        }
    } else if (apiKey && !aiProvider) {
        errors.push('aiProvider is required when updating apiKey');
    }

    // Validate owner IDs if provided
    if (ownerIds) {
        if (!Array.isArray(ownerIds) || ownerIds.length === 0) {
            errors.push('ownerIds must be a non-empty array');
        } else {
            const invalidIds = ownerIds.filter(id => !isValidTelegramUserId(id));
            if (invalidIds.length > 0) {
                errors.push(`Invalid Telegram user IDs: ${invalidIds.join(', ')}`);
            }
        }
    }

    if (errors.length > 0) {
        return res.status(400).json({
            error: 'Validation failed',
            errors
        });
    }

    next();
}

/**
 * Sanitize string input (prevent injection)
 */
function sanitize(str) {
    if (typeof str !== 'string') return str;
    return validator.escape(str.trim());
}

module.exports = {
    validateProvisionInput,
    validateConfigUpdate,
    isValidTelegramToken,
    isValidApiKey,
    isValidTelegramUserId,
    sanitize
};
