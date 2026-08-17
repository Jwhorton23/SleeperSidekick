/**
 * Plain-English explanations for every stat the app shows.
 *
 * `subtitle` is the gray line that always sits under a card heading; the rest
 * is what the ⓘ button reveals. The rule for `readingIt`: use a concrete
 * value and say what it means about the team, never restate the formula.
 *
 * The source of truth for the math itself is the JSDoc on each function in
 * src/stats — when a formula changes, the entry here changes with it.
 */
export interface MetricInfo {
  title: string;
  subtitle: string;
  howItWorks: string[];
  readingIt: string;
  counts: string;
}

export type MetricKey =
  | "powerRankings"
  | "allPlay"
  | "luck"
  | "playoffOdds"
  | "scheduleSwap"
  | "coachingEfficiency"
  | "weeklyHighlights"
  | "seasonAwards"
  | "careerPoints"
  | "championships"
  | "winStreak"
  | "rivalries"
  | "draftGrades"
  | "faabEfficiency"
  | "record"
  | "pointsFor"
  | "pointsAgainst"
  | "bestWorstWeek"
  | "headToHead"
  | "weekLog";

export const METRIC_INFO: Record<MetricKey, MetricInfo> = {
  powerRankings: {
    title: "Power Rankings",
    subtitle: "How strong each team is right now, in points per game.",
    howItWorks: [
      "Every week, a team's margin is its score minus its opponent's score — positive if it won, negative if it lost.",
      "Those margins are averaged, but recent weeks count more: the first completed week carries the least weight and the most recent carries the most.",
      "That means a team that blew everyone out in September but has since faded ranks below one that's rolling right now, even with identical season point totals.",
    ],
    readingIt:
      "+25.5 means this team has been beating its opponents by about 25.5 points a game, leaning on recent form. A negative number means it's been losing by that much. Zero is exactly league-average — every team's score added together always comes to 0, so half the league is positive and half is negative by definition.",
    counts: "Completed regular-season weeks only. Playoff games don't count.",
  },

  allPlay: {
    title: "All-Play Record",
    subtitle: "Your record if you played every other team, every single week.",
    howItWorks: [
      "Each week, you're compared against all seven other scores, not just the one you were scheduled against.",
      "You pick up a win for every team you outscored that week and a loss for every team that outscored you.",
      "Over a full season that's hundreds of results instead of a dozen, so the schedule luck washes out and what's left is how well you actually scored.",
    ],
    readingIt:
      "A 44-33 all-play record means that in a typical week you outscored a little more than half the league. Compare it to your real record: 9-2 with a 44-33 all-play means the schedule has been kind, and 4-7 with a 50-27 all-play means it hasn't.",
    counts: "Completed regular-season weeks only.",
  },

  luck: {
    title: "Luck",
    subtitle: "Wins you've picked up beyond what your scoring earned.",
    howItWorks: [
      "Your all-play win percentage says what share of the league you beat in a typical week — call that the wins your scores deserved.",
      "Multiply it by the number of games you've actually played to get your expected wins.",
      "Luck is your real wins minus that number.",
    ],
    readingIt:
      "+1.5 means you've won about one and a half more games than your scoring deserved — you happened to draw the league's weakest opponents on the weeks you scored badly. -1.5 is the opposite: good scores that kept running into better ones. Across the whole league luck always adds up to about zero, so somebody's good fortune is somebody else's bad week.",
    counts: "Completed regular-season weeks only. A tie counts as half a win on both sides.",
  },

  playoffOdds: {
    title: "Playoff Odds",
    subtitle: "Chance of making the bracket, from 10,000 simulated seasons.",
    howItWorks: [
      "The rest of the schedule is played out 10,000 times.",
      "In each simulated game, a team's score is drawn at random from the scores it has actually posted this season — so a boom-or-bust team keeps its wide range and a steady one keeps its narrow one.",
      "At the end of each run the standings are sorted by wins, then by total points, and the top seeds make the bracket. The percentage is how often that team got in.",
    ],
    readingIt:
      "72% means the team made the playoffs in about 7,200 of the 10,000 runs. This card disappears once the regular season is over and there's nothing left to simulate.",
    counts: "Uses this season's scores to project the remaining regular-season weeks.",
  },

  scheduleSwap: {
    title: "Schedule Swap",
    subtitle: "Your record if you'd played somebody else's schedule instead.",
    howItWorks: [
      "Your weekly scores stay exactly as they were — only the opponents change.",
      "For every other team in the league, we replay your season against the opponents they faced each week.",
      "The best and worst records that come out of that are shown here.",
    ],
    readingIt:
      "\"9-2 easiest · 5-6 hardest\" means the same scores you posted would have gone 9-2 against the friendliest schedule in the league and 5-6 against the roughest. A wide gap means your record says as much about the schedule as it does about your team.",
    counts: "Completed regular-season weeks only.",
  },

  coachingEfficiency: {
    title: "Coaching Efficiency",
    subtitle: "Points your bench scored that your starters didn't — lower is better.",
    howItWorks: [
      "Every week we work out the highest-scoring legal lineup you could have set from the players you already had, respecting every roster slot including flex.",
      "The gap between that perfect lineup and what you actually started is the points you left on the bench.",
      "Those weekly gaps are added up across the season.",
    ],
    readingIt:
      "The top of this list is the sharpest lineup-setter in the league. 12.4 points left on the bench across a whole season is close to perfect; 180 means a starter-vs-bench call went wrong most weeks. This measures decisions, not talent — a great roster can still land at the bottom.",
    counts:
      "Completed regular-season weeks only. It's judged with hindsight, so nobody realistically scores zero.",
  },

  weeklyHighlights: {
    title: "Week Highlights",
    subtitle: "The most and least competitive games of the most recent week.",
    howItWorks: [
      "Biggest blowout is the game with the largest gap between the two scores; closest game is the smallest.",
      "Highest-scoring loser is the best score in the league that still lost.",
    ],
    readingIt: "Only the most recently completed week is shown.",
    counts: "The latest completed regular-season week.",
  },

  seasonAwards: {
    title: "Season Awards",
    subtitle: "The standout manager in a handful of categories this season.",
    howItWorks: [
      "Sleeps at the Wheel goes to the most points left on the bench, Luckiest Manager and Snake Bit to the highest and lowest luck.",
      "Sharpest GM is the best draft hit rate, among managers with at least three picks.",
      "Waiver Wire Wizard is the most points per FAAB dollar, and only appears in leagues that use FAAB.",
    ],
    readingIt:
      "These are a fixed set of named awards, so this card isn't ranked — the order is always the same and doesn't mean one award beats another.",
    counts: "The most recent season only.",
  },

  careerPoints: {
    title: "Career Points",
    subtitle: "Every fantasy point scored across every season in this league.",
    howItWorks: ["Each manager's weekly scores are added up across every season we can reach through the league's history."],
    readingIt:
      "Managers who've been in the league longer will naturally sit higher — this is a raw total, not a per-season average.",
    counts: "Regular season and playoffs, every season in the record book.",
  },

  championships: {
    title: "Championships",
    subtitle: "Titles won, with the seasons they came in.",
    howItWorks: ["The winner of each season's championship game, read straight from the league's playoff bracket."],
    readingIt: "Managers with no title don't appear at all.",
    counts: "Every season in the record book that finished its bracket.",
  },

  winStreak: {
    title: "Longest Win Streak",
    subtitle: "The most consecutive wins a manager has ever strung together here.",
    howItWorks: [
      "Games are walked in order across season boundaries, so a run that ends one December and continues the next September counts as one streak.",
      "A tie ends a streak.",
    ],
    readingIt: "8 games means eight straight wins without a loss in between.",
    counts: "Regular season and playoffs, every season in the record book.",
  },

  rivalries: {
    title: "Rivalries",
    subtitle: "The opponent each manager owns most decisively.",
    howItWorks: [
      "Every head-to-head pairing in league history is tallied, and each manager's biggest win-loss gap is shown.",
      "Only managers with a winning record against somebody appear.",
    ],
    readingIt:
      "\"vs CovertOp: 7-1\" means these two have met eight times and this manager has won seven. Open a manager's page for the full head-to-head list against everyone.",
    counts: "Regular season and playoffs, every season in the record book.",
  },

  draftGrades: {
    title: "Draft Grades",
    subtitle: "How many picks paid off — a pick hits if the player finished at or above where he was taken.",
    howItWorks: [
      "Players are only ever compared to others at their own position taken in that same draft. The 3rd running back off the board hits if he finished as one of the top 3 scoring running backs drafted that year.",
      "There's no outside ranking or projection involved — the draft is graded against itself, using each player's full-season points whether or not he was ever started.",
      "The number below covers every draft this manager has taken part in, across all the seasons in this record book.",
    ],
    readingIt:
      "Because every pick is ranked against its own draft class, 50% is average by construction — roughly half of all picks hit no matter who's drafting. So 66% is genuinely strong and 38% genuinely poor, and a number near 50% just means an ordinary draft. Expand a row to see the picks that actually moved the number.",
    counts: "Every draft in the record book. Seasons without draft data are skipped.",
  },

  faabEfficiency: {
    title: "FAAB Efficiency",
    subtitle: "Fantasy points returned for every waiver dollar spent.",
    howItWorks: [
      "Only winning waiver claims that actually cost FAAB budget are counted.",
      "A player's points only count from the week after he was claimed, and only while he was on that roster — points he scored before the pickup aren't the buyer's doing.",
    ],
    readingIt:
      "3.20 pts/$ means every dollar bid came back as a little over three fantasy points. Someone who spent $4 all year can top this list on a single good claim, so read it next to the dollars spent.",
    counts: "FAAB leagues only. This card is hidden in leagues that use waiver priority instead.",
  },

  record: {
    title: "Record",
    subtitle: "Head-to-head wins and losses.",
    howItWorks: ["Actual results against the scheduled opponent each week."],
    readingIt: "Compare it to the all-play record to see how much of it the schedule handed over.",
    counts: "Completed regular-season weeks only.",
  },

  pointsFor: {
    title: "Points For",
    subtitle: "Total fantasy points this team has scored.",
    howItWorks: ["Every starter's points, added up across the season."],
    readingIt: "The purest measure of roster strength — it owes nothing to the schedule.",
    counts: "Completed regular-season weeks only.",
  },

  pointsAgainst: {
    title: "Points Against",
    subtitle: "Total fantasy points this team's opponents have scored.",
    howItWorks: ["The scores put up against this team each week, added together."],
    readingIt:
      "High points against with a poor record is the clearest sign of a brutal schedule — check the luck number next to it.",
    counts: "Completed regular-season weeks only.",
  },

  bestWorstWeek: {
    title: "Best & Worst Week",
    subtitle: "The season's high and low score.",
    howItWorks: ["The single highest and lowest weekly total this team has posted."],
    readingIt: "A wide gap means a boom-or-bust roster, which shows up as a wider range in the playoff simulation.",
    counts: "Completed regular-season weeks only.",
  },

  headToHead: {
    title: "Head-to-Head",
    subtitle: "This manager's all-time record against every other manager.",
    howItWorks: ["Every game these two have played in this league, in any season, regular season or playoffs."],
    readingIt: "Managers who joined at different times will have played each other fewer times — check the game count.",
    counts: "Every season in the record book.",
  },

  weekLog: {
    title: "Week by Week",
    subtitle: "Every game this season, with what the box score doesn't show.",
    howItWorks: [
      "The result line is the real matchup: this team's score, the opponent's, and who won.",
      "The bullets underneath add how many of the league's other teams this score would have beaten that week, how many points were left sitting on the bench, and the top starter.",
      "Bullet colors grade the week: green is good, yellow and orange are middling, red is bad. The top starter is blue because it's context, not a verdict.",
    ],
    readingIt:
      "A loss where you beat 6 of 7 other teams is the schedule's fault. A win where you beat 1 of 7 is a gift. Bench points on top of a narrow loss are the ones that sting.",
    counts: "Completed regular-season weeks only.",
  },
};
