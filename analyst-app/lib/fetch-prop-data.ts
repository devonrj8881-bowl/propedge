import { buildPayloadsFromProps, parsePropFeedCsv, sortPayloadsByEv } from "./propedge-payload";
import type { BoardProp, PropEdgeLlmPayload } from "./types";

const DEFAULT_FEED =
  "https://propedgemasters.netlify.app/.netlify/functions/prop-feed?sheet=propedge-main";

let cached: { csv: string; at: number } | null = null;
const CACHE_MS = 60_000;

async function fetchPropFeedCsv(): Promise<string> {
  const url = process.env.PROPEDGE_FEED_URL || DEFAULT_FEED;
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) return cached.csv;

  const res = await fetch(url, { next: { revalidate: 45 } });
  if (!res.ok) throw new Error(`Prop feed HTTP ${res.status}`);
  const csv = await res.text();
  if (!csv || csv.trim().startsWith("<") || csv.length < 100) {
    throw new Error("Invalid prop feed response");
  }
  cached = { csv, at: now };
  return csv;
}

export async function fetchBoardProps(league?: string): Promise<BoardProp[]> {
  const csv = await fetchPropFeedCsv();
  const all = parsePropFeedCsv(csv);
  if (!league || league === "ALL") return all;
  return all.filter((p) => String(p.league || "").toUpperCase() === league.toUpperCase());
}

/** Real data — replaces mock fetchPropData from the reference Server Action. */
export async function fetchPropDataForPlayer(
  playerName: string,
  propType: string,
  league?: string
): Promise<PropEdgeLlmPayload | null> {
  const props = await fetchBoardProps(league);
  const needle = playerName.trim().toLowerCase();
  const typeNeedle = propType.trim().toLowerCase();

  const match = props.find((p) => {
    const nameOk = String(p.player || "").toLowerCase().includes(needle);
    const typeOk = String(p.prop || p.stat || "")
      .toLowerCase()
      .includes(typeNeedle);
    return nameOk && typeOk;
  });

  if (!match) return null;
  const payloads = buildPayloadsFromProps([match], 1);
  return payloads[0] || null;
}

export async function fetchTopEvPayloads(league?: string, limit = 8): Promise<PropEdgeLlmPayload[]> {
  const props = await fetchBoardProps(league);
  return buildPayloadsFromProps(props, limit);
}

export async function fetchTopStrikeoutPayload(league = "MLB"): Promise<PropEdgeLlmPayload | null> {
  const props = await fetchBoardProps(league);
  const ks = props.filter((p) =>
    /strikeout|strike out|\bk\b|\bks\b/i.test(String(p.prop || p.stat || ""))
  );
  const payloads = sortPayloadsByEv(
    buildPayloadsFromProps(ks, 8)
  );
  return payloads[0] || null;
}
