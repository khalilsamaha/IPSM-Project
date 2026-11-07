import { PrismaClient } from "@prisma/client";

// Only clients constructed here can use the integration-test exception. Environment
// flags must never bless an injected client or the application's shared Prisma client.
const disposableClients = new WeakMap<PrismaClient, string>();
function disposableConfiguration() {
  const url = process.env.RESET_TEST_DATABASE_URL;
  const token = process.env.IPSM_DISPOSABLE_TEST_TOKEN;
  if (process.env.NODE_ENV !== "test" || process.env.VITEST !== "true"
    || process.env.VERCEL !== undefined || process.env.VERCEL_ENV !== undefined
    || process.env.IPSM_DISPOSABLE_TEST_DATABASE !== "1"
    || !token || !/^[a-f0-9]{64}$/.test(token)
    || !url || process.env.DATABASE_URL !== url || process.env.DIRECT_URL !== url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "postgresql:" || parsed.hostname !== "127.0.0.1"
      || parsed.pathname !== "/ipsm_reset_integrity_test" || !parsed.port
      || Number(parsed.port) < 1024 || parsed.search || parsed.hash) return null;
    return { url, token, port: Number(parsed.port), identity: JSON.stringify([url, token]) };
  } catch { return null; }
}

export function isDisposableProductionResetTestClient(client: PrismaClient) {
  const configuration = disposableConfiguration();
  return configuration !== null && disposableClients.get(client) === configuration.identity;
}

export async function createDisposableProductionResetTestClient() {
  const configuration = disposableConfiguration();
  if (!configuration) throw new Error("Disposable reset test configuration is invalid.");
  // No caller-supplied datasource overrides, query parameters or remote endpoints.
  const client = new PrismaClient({ datasources: { db: { url: configuration.url } }, transactionOptions: { isolationLevel: "Serializable" } });
  try {
    // A loopback URL alone could point through a tunnel. Verify the actual server
    // and the fresh marker installed only on the runner's owned PostgreSQL cluster.
    const [result] = await client.$queryRaw<Array<{ verified: boolean }>>`
      SELECT current_database() = 'ipsm_reset_integrity_test'
        AND inet_server_addr() = '127.0.0.1'::inet
        AND inet_server_port() = ${configuration.port}
        AND current_setting('ipsm.disposable_test_token', true) = ${configuration.token} AS verified`;
    if (result?.verified !== true) throw new Error("Unverified disposable server.");
    disposableClients.set(client, configuration.identity);
    return client;
  } catch {
    await client.$disconnect();
    throw new Error("Disposable reset test database identity could not be verified.");
  }
}
