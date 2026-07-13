import qs from 'qs';

export const WCA_OAUTH_SCOPE = 'public';

export const getWcaAuthorizationUrl = ({ origin, clientId, redirectUri }) => (
  `${origin}/oauth/authorize?${qs.stringify({
    response_type: 'code',
    scope: WCA_OAUTH_SCOPE,
    redirect_uri: redirectUri,
    client_id: clientId,
  })}`
);
