import {
  extractId as googleDocsExtractId,
  exchangeCode as googleDocsExchangeCode,
  getIdentity as googleDocsGetIdentity,
  getMetadata as googleDocsGetMetadata,
  validateDomain as googleDocsValidateDomain,
  refreshTokenIfNeeded as googleDocsRefreshTokenIfNeeded,
  createDocument as googleDocsCreateDocument,
} from './google-docs.js'

export const PROVIDERS = {
  'google-docs': {
    configKey: 'google_docs',
    urlPattern: /docs\.google\.com\/document\/d\//,
    supportsRefresh: true,
    domainField: 'allowed_domain',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: [
      'https://www.googleapis.com/auth/drive.metadata.readonly',
      'https://www.googleapis.com/auth/drive.file',
    ],
    authParams: { access_type: 'offline', prompt: 'consent' },
    enrichToken: null,
    extractId: googleDocsExtractId,
    exchangeCode: googleDocsExchangeCode,
    getIdentity: googleDocsGetIdentity,
    getMetadata: googleDocsGetMetadata,
    validateDomain: googleDocsValidateDomain,
    refreshTokenIfNeeded: googleDocsRefreshTokenIfNeeded,
    createDocument: googleDocsCreateDocument,
  },
}
