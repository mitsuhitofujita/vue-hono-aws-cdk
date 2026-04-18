import { Amplify } from "aws-amplify";

export function configureAmplify(): void {
  const region = import.meta.env.VITE_AWS_REGION;
  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
  const userPoolClientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID;
  const domainPrefix = import.meta.env.VITE_COGNITO_DOMAIN_PREFIX;

  const redirectUrl = `${window.location.origin}/`;

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        loginWith: {
          oauth: {
            domain: `${domainPrefix}.auth.${region}.amazoncognito.com`,
            scopes: ["openid", "email", "profile"],
            redirectSignIn: [redirectUrl],
            redirectSignOut: [redirectUrl],
            responseType: "code",
          },
        },
      },
    },
  });
}
