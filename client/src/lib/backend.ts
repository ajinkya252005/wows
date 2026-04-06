const normalizeOrigin = (value: string | undefined): string => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return '';
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
};

export const buildBackendUrl = (path: string, origin: string): string =>
  origin ? new URL(path, origin).toString() : path;

const viteEnv = (import.meta as ImportMeta & {
  env?: {
    PROD?: boolean;
    VITE_BACKEND_ORIGIN?: string;
  };
}).env;

export const backendOrigin = viteEnv?.PROD ? normalizeOrigin(viteEnv.VITE_BACKEND_ORIGIN) : '';

export const resolveBackendUrl = (path: string): string => buildBackendUrl(path, backendOrigin);
