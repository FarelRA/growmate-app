export function parseStreamUrl(url: string): { protocol: string; host: string; port: number } | null {
  try {
    const u = new URL(url)
    return {
      protocol: u.protocol.replace(':', ''),
      host: u.hostname,
      port: parseInt(u.port, 10),
    }
  } catch {
    return null
  }
}
