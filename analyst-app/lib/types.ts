export interface PropEdgeLlmPayload {
  event: {
    date: string;
    home_team: string | null;
    away_team: string | null;
  };
  player: {
    name: string;
    team: string | null;
    position: string | null;
  };
  market: {
    prop_type: string;
    line: number | null;
    odds: number | null;
    implied_probability: number | null;
    implied_probability_devigged?: number | null;
    opening_line?: number;
    book_delta?: number;
    live_book?: string;
  };
  analytics: {
    hit_rate_last_5?: number | null;
    hit_rate_last_10: number | null;
    hit_rate_last_20?: number | null;
    hit_rate_last_30?: number | null;
    season_hit_rate?: number | null;
    ev_percentage: number | null;
    projected_value?: number | null;
    projected_ks?: number;
    kelly_units?: number | null;
    propiq_score?: number | null;
    propiq_for_factors?: string[];
    propiq_against_factors?: string[];
    confidence?: number | null;
    board_edge_pct?: number | null;
    pitcher_era?: number | null;
    pitcher_xera?: number | null;
    back_to_back?: boolean | null;
    days_rest?: number | null;
  };
  matchup_context: {
    defensive_rank?: number | string | null;
    matchup_rank?: number | null;
    h2h_history?: string | null;
    vs_opponent_hit_rate?: string | null;
  };
  board_rank?: number;
  league?: string;
}

export interface BoardProp {
  league?: string;
  player?: string;
  team?: string;
  opponent?: string;
  pos?: string;
  position?: string;
  prop?: string;
  stat?: string;
  line?: number;
  odds?: number | string;
  over_odds?: number | string;
  under_odds?: number | string;
  direction?: string;
  l5Avg?: number;
  l10Avg?: number;
  l5Pct?: number | string;
  l10Pct?: number | string;
  l20Pct?: number | string;
  l30Pct?: number | string;
  seasonPct?: number | string;
  opening?: number;
  confidence?: number;
  edge?: number;
  modelScore?: number;
  betScore?: number;
  sznMatchup?: number | string;
  h2h?: string;
  matchup_scalar?: number;
  projected_ks?: number;
  pitcherERA?: number;
  pitcherXERA?: number;
  daysRest?: number;
  isB2b?: boolean;
  streak?: number;
  impliedProb?: number;
  lastSeasonPct?: number | string;
}
