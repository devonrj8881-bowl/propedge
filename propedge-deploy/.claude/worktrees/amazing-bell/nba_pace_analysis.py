"""
NBA Pace-of-Play and Scoring Analysis Framework
Analyzes relationships between team pace and game totals across multiple seasons
"""

import pandas as pd
import numpy as np
from datetime import datetime
import requests
import json

class NBAAnalyzer:
    """Fetch and analyze NBA data for pace and scoring relationships"""

    def __init__(self):
        # NBA stats API endpoints
        self.base_url = "https://stats.nba.com/stats"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }

    def fetch_team_stats(self, season):
        """
        Fetch team stats for a given season
        season: str format "2024-25" for 2024-25 season
        """
        endpoint = f"{self.base_url}/leaguedashteamstats"
        params = {
            'Season': season,
            'SeasonType': 'Regular Season',
            'PerMode': 'Per100Possessions'
        }

        try:
            response = requests.get(endpoint, headers=self.headers, params=params)
            response.raise_for_status()
            data = response.json()

            # Extract relevant columns
            headers = data['result']['headers']
            rows = data['result']['rowSet']

            df = pd.DataFrame(rows, columns=headers)
            return df
        except Exception as e:
            print(f"Error fetching season {season}: {e}")
            return None

    def fetch_game_logs(self, season):
        """
        Fetch detailed game logs for analysis
        Returns game-by-game data with pace and scoring
        """
        endpoint = f"{self.base_url}/leaguegamefinder"
        params = {
            'Season': season,
            'SeasonType': 'Regular Season',
            'Direction': 'desc',
            'Sorter': 'GAME_DATE'
        }

        try:
            response = requests.get(endpoint, headers=self.headers, params=params)
            response.raise_for_status()
            data = response.json()

            headers = data['result']['headers']
            rows = data['result']['rowSet']

            df = pd.DataFrame(rows, columns=headers)
            return df
        except Exception as e:
            print(f"Error fetching game logs for {season}: {e}")
            return None

    def calculate_pace(self, team_stats):
        """
        Calculate pace metrics from team stats
        Pace = (FGA + 0.44 * FTA - OREB) / MP * 48
        """
        if 'PACE' in team_stats.columns:
            return team_stats['PACE']
        return None

    def analyze_pace_vs_scoring(self, game_logs):
        """
        Analyze correlation between pace and total points in games
        """
        analysis = {
            'pace_vs_pts': {},
            'summary_stats': {}
        }

        if game_logs is None or len(game_logs) == 0:
            return analysis

        # Group games by pace quartiles
        if 'PACE' in game_logs.columns and 'PTS' in game_logs.columns:
            game_logs['PACE'] = pd.to_numeric(game_logs['PACE'], errors='coerce')
            game_logs['PTS'] = pd.to_numeric(game_logs['PTS'], errors='coerce')

            # Remove NaN values
            clean_data = game_logs[['PACE', 'PTS']].dropna()

            if len(clean_data) > 0:
                # Calculate correlation
                correlation = clean_data['PACE'].corr(clean_data['PTS'])

                # Create pace quartiles
                clean_data['pace_quartile'] = pd.qcut(clean_data['PACE'], q=4, duplicates='drop')

                # Analyze by quartile
                quartile_analysis = clean_data.groupby('pace_quartile')['PTS'].agg([
                    'count', 'mean', 'std', 'min', 'max'
                ]).round(2)

                analysis['pace_vs_pts'] = {
                    'correlation': round(correlation, 3),
                    'quartile_analysis': quartile_analysis.to_dict(),
                    'avg_pts': round(clean_data['PTS'].mean(), 2),
                    'std_pts': round(clean_data['PTS'].std(), 2)
                }

        return analysis

    def matchup_analysis(self, game_logs):
        """
        Analyze specific team matchups - how fast/slow teams play each other
        """
        matchup_data = {}

        if game_logs is None or len(game_logs) == 0:
            return matchup_data

        # Group by teams
        for team in game_logs['TEAM_ABBREVIATION'].unique():
            team_games = game_logs[game_logs['TEAM_ABBREVIATION'] == team]

            matchup_data[team] = {
                'games_played': len(team_games),
                'avg_pace': round(pd.to_numeric(team_games['PACE'], errors='coerce').mean(), 2),
                'avg_pts_for': round(pd.to_numeric(team_games['PTS'], errors='coerce').mean(), 2),
                'avg_pts_against': round(pd.to_numeric(team_games['PTS_AGAINST'], errors='coerce').mean(), 2) if 'PTS_AGAINST' in team_games.columns else None,
            }

        return matchup_data

    def export_analysis_summary(self, all_data, filename='nba_analysis_summary.json'):
        """
        Export analysis results to JSON for review
        """
        summary = {
            'generated': datetime.now().isoformat(),
            'seasons_analyzed': list(all_data.keys()),
            'data': all_data
        }

        with open(filename, 'w') as f:
            json.dump(summary, f, indent=2, default=str)

        print(f"Analysis exported to {filename}")
        return summary

# Example usage
if __name__ == "__main__":
    analyzer = NBAAnalyzer()

    seasons = ['2023-24', '2024-25', '2025-26']
    all_analysis = {}

    print("🏀 NBA Pace & Scoring Analysis\n" + "="*50)

    for season in seasons:
        print(f"\nFetching data for {season}...")

        # Fetch data
        team_stats = analyzer.fetch_team_stats(season)
        game_logs = analyzer.fetch_game_logs(season)

        if game_logs is not None:
            # Run analysis
            pace_analysis = analyzer.analyze_pace_vs_scoring(game_logs)
            matchup_data = analyzer.matchup_analysis(game_logs)

            all_analysis[season] = {
                'pace_scoring_analysis': pace_analysis,
                'team_matchups': matchup_data
            }

            print(f"✓ Processed {len(game_logs)} games")
        else:
            print(f"✗ Could not fetch data for {season}")

    # Export results
    analyzer.export_analysis_summary(all_analysis)
    print("\n✓ Analysis complete!")
