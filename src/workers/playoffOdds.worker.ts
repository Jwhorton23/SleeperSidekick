import { simulatePlayoffOdds } from "../stats/playoffOdds";
import type { PlayoffOddsEntry } from "../stats/playoffOdds";
import type { Season } from "../data/types";

export interface PlayoffOddsWorkerRequest {
  season: Season;
  simulations?: number;
}

export type PlayoffOddsWorkerResponse = PlayoffOddsEntry[];

self.onmessage = (event: MessageEvent<PlayoffOddsWorkerRequest>) => {
  const { season, simulations } = event.data;
  const response: PlayoffOddsWorkerResponse = simulatePlayoffOdds(season, { simulations });
  (self as unknown as Worker).postMessage(response);
};
