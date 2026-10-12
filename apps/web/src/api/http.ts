export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public payload: Record<string, unknown>,
  ) {
    super(message);
  }
}

const apiErrorMessages: Record<string, string> = {
  unauthenticated: "Não foi possível confirmar o acesso. Confira seus dados ou entre novamente.",
  forbidden: "Sua conta não tem acesso a esta ação. Peça ao responsável da casa ou a um administrador para revisar seu acesso.",
  not_found: "Este item não está mais disponível. Atualize a tela e tente novamente.",
  validation: "Revise os dados informados e tente novamente.",
  invalid_totp: "O código não confere. Verifique o autenticador ou use outro código de recuperação.",
  rate_limited: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
  unavailable: "O serviço está temporariamente indisponível. Tente novamente em alguns minutos.",
  sole_owner: "Transfira a responsabilidade da casa para outra pessoa e tente novamente.",
  shared_admin: "Esta conta também tem acesso administrativo. Remova esse acesso no console antes de continuar.",
  duplicate_email: "Já existe uma conta com este e-mail. Confira o endereço ou use outro.",
  conflict: "Os dados mudaram em outro dispositivo. Atualize a tela antes de tentar novamente.",
  origin: "A página ficou desatualizada. Recarregue-a e repita a ação.",
};

function apiErrorMessage(status: number, code: string): string {
  if (code === "invalid_state") {
    if (status === 409) return "A configuração inicial já foi concluída. Volte à entrada e use a conta administrativa.";
    if (status === 410) return "Este link expirou ou já foi usado. Solicite um novo link para continuar.";
    return "Este link ou código não é válido. Confira os dados e tente novamente; se expirou, solicite outro.";
  }
  return apiErrorMessages[code] ?? (status >= 500
    ? "O serviço encontrou um erro. Tente novamente em alguns minutos; se continuar, fale com o suporte."
    : "Não foi possível concluir esta ação. Atualize a tela e tente novamente.");
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return "Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente.";
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "same-origin" });
  const value = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new ApiError(
      apiErrorMessage(response.status, typeof value.code === "string" ? value.code : "unknown"),
      response.status,
      typeof value.code === "string" ? value.code : "unknown",
      value,
    );
  }
  return value as T;
}

export const json = (method: string, value?: unknown): RequestInit => ({
  method,
  ...(value === undefined ? {} : { body: JSON.stringify(value) }),
});
