export type GoogleAuthenticationConfig =
  | { mode: "adc" }
  | {
      mode: "vercel-wif";
      projectNumber: string;
      serviceAccountEmail: string;
      workloadIdentityPoolId: string;
      workloadIdentityProviderId: string;
      workloadIdentityAudience: string;
    };

export function buildGoogleWorkloadIdentityAudience(input: {
  projectNumber: string;
  poolId: string;
  providerId: string;
}) {
  return `//iam.googleapis.com/projects/${input.projectNumber}/locations/global/workloadIdentityPools/${input.poolId}/providers/${input.providerId}`;
}

export function assertGoogleAuthenticationConfig(
  config: GoogleAuthenticationConfig
) {
  if (config.mode === "adc") return config;
  if (!/^\d{6,20}$/.test(config.projectNumber)) {
    throw new Error("Google Cloud project number is invalid.");
  }
  if (
    !/^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?@[a-z][a-z0-9-]{4,28}[a-z0-9]\.iam\.gserviceaccount\.com$/.test(
      config.serviceAccountEmail
    )
  ) {
    throw new Error("Google Cloud service account identity is invalid.");
  }
  const resourceIdPattern = /^[a-z](?:[a-z0-9-]{2,30}[a-z0-9])$/;
  if (!resourceIdPattern.test(config.workloadIdentityPoolId)) {
    throw new Error("Google Cloud workload identity pool ID is invalid.");
  }
  if (!resourceIdPattern.test(config.workloadIdentityProviderId)) {
    throw new Error("Google Cloud workload identity provider ID is invalid.");
  }
  const expectedAudience = buildGoogleWorkloadIdentityAudience({
    projectNumber: config.projectNumber,
    poolId: config.workloadIdentityPoolId,
    providerId: config.workloadIdentityProviderId,
  });
  if (config.workloadIdentityAudience !== expectedAudience) {
    throw new Error("Google Cloud workload identity audience is invalid.");
  }
  return config;
}
