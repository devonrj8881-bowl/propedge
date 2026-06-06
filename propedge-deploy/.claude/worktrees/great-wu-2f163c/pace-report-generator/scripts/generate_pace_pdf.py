#!/usr/bin/env python3
"""
Pace vs Opponent PDF Report Generator

Generates professional weekly PDF reports showing game-by-game pace analysis
with expected total points per game projections for NBA, NHL, and MLB.
"""

import json
import requests
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
import os

class PaceReportGenerator:
    """Generate pace vs opponent PDF reports"""

    def __init__(self):
        self.nba_api = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard"
        self.nhl_api = "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard"
        self.mlb_api = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard"

    def fetch_espn_data(self, sport: str) -> Dict:
        """Fetch current week data from ESPN API"""
        api_url = {
            'NBA': self.nba_api,
            'NHL': self.nhl_api,
            'MLB': self.mlb_api
        }.get(sport.upper())

        if not api_url:
            return self._mock_data(sport)

        try:
            response = requests.get(api_url, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error fetching {sport} data: {e}. Using mock data.")
            return self._mock_data(sport)

    def _mock_data(self, sport: str) -> Dict:
        """Return mock pace data for demo/fallback"""
        mock_data = {
            'NBA': [
                {
                    'player': 'LeBron James',
                    'team': 'LAL',
                    'opponent': 'BOS',
                    'date': 'Tue, Apr 1',
                    'player_pace': 102.1,
                    'team_pace': 103.5,
                    'opponent_pace': 98.2,
                    'favorability': 'favorable',
                    'delta': -5.3,
                    'proj_low': 22,
                    'proj_high': 24,
                    'stat': 'Points'
                },
                {
                    'player': 'Luka Doncic',
                    'team': 'DAL',
                    'opponent': 'DEN',
                    'date': 'Wed, Apr 2',
                    'player_pace': 101.8,
                    'team_pace': 104.2,
                    'opponent_pace': 106.1,
                    'favorability': 'unfavorable',
                    'delta': 1.9,
                    'proj_low': 30,
                    'proj_high': 35,
                    'stat': 'Points'
                }
            ],
            'NHL': [
                {
                    'player': 'Connor McDavid',
                    'team': 'EDM',
                    'opponent': 'LAK',
                    'date': 'Wed, Apr 2',
                    'player_pace': 18.2,
                    'team_pace': 85.3,
                    'opponent_pace': 88.5,
                    'favorability': 'favorable',
                    'delta': 3.2,
                    'proj_low': 1.8,
                    'proj_high': 2.4,
                    'stat': 'Points'
                }
            ],
            'MLB': [
                {
                    'player': 'Mike Trout',
                    'team': 'LAA',
                    'opponent': 'HOU',
                    'date': 'Thu, Apr 3',
                    'player_pace': 3.8,
                    'team_pace': 3.9,
                    'opponent_pace': 3.6,
                    'favorability': 'favorable',
                    'delta': -0.2,
                    'proj_low': 0.28,
                    'proj_high': 0.32,
                    'stat': 'Batting Average'
                }
            ]
        }
        return mock_data.get(sport.upper(), [])

    def calculate_pace_edge(self, player_pace: float, opponent_pace: float, sport: str) -> Tuple[str, str, float]:
        """Calculate matchup edge and return (favorability, message, delta)"""
        delta = opponent_pace - player_pace

        if sport.upper() == 'MLB':
            # For MLB, slower pitcher is favorable (fewer pitches)
            if delta < -0.3:
                return ('favorable', '✅ Slower-paced pitcher — more at-bats expected', delta)
            elif delta > 0.3:
                return ('unfavorable', '❌ Faster-paced pitcher — fewer at-bats expected', delta)
            else:
                return ('neutral', '⚠️ Neutral pace matchup', delta)
        else:
            # For NBA/NHL, faster opponent pace is generally favorable
            if delta > 2:
                return ('favorable', '✅ Faster-paced opponent — more opportunities', delta)
            elif delta < -2:
                return ('unfavorable', '❌ Slower-paced opponent — fewer opportunities', delta)
            else:
                return ('neutral', '⚠️ Neutral pace matchup', delta)

    def create_pace_card(self, game_data: Dict, sport: str) -> Table:
        """Create a formatted pace analysis card"""
        styles = getSampleStyleSheet()

        # Color based on favorability
        color_map = {
            'favorable': colors.Color(0, 0.9, 0.45),  # Green
            'neutral': colors.Color(0.96, 0.62, 0.07),  # Yellow/Orange
            'unfavorable': colors.Color(1, 0.32, 0.32)  # Red
        }
        edge_color = color_map.get(game_data['favorability'], colors.grey)

        # Emoji by sport
        sport_emoji = {'NBA': '🏀', 'NHL': '🏒', 'MLB': '⚾'}.get(sport.upper(), '⚡')

        # Header
        header_text = f"<b>{game_data['player']}</b> <font color='#4a8fff'>{sport_emoji} {sport.upper()}</font>"
        matchup_text = f"{game_data['team']} @ {game_data['opponent']} • {game_data['date']}"

        # Metrics
        metrics_text = f"""
        <font size=10><b>Your Pace:</b> {game_data['player_pace']:.1f}</font><br/>
        <font size=10><b>Team Pace:</b> {game_data['team_pace']:.1f}</font><br/>
        <font size=10><b>Opponent Pace:</b> {game_data['opponent_pace']:.1f}</font>
        """

        # Matchup edge
        edge_text = f"""
        <font color='{edge_color}'>
        {game_data.get('edge_message', '⚠️ Analyzing matchup...')}<br/>
        <font size=9>Delta: {game_data['delta']:.1f}</font>
        </font>
        """

        # Projection
        proj_text = f"<b>{game_data['stat']}:</b> {game_data['proj_low']:.0f}-{game_data['proj_high']:.0f}"

        # Build table
        data = [
            [Paragraph(header_text, styles['Normal'])],
            [Paragraph(matchup_text, styles['Normal'])],
            [Paragraph(metrics_text, styles['Normal'])],
            [Paragraph(edge_text, styles['Normal'])],
            [Paragraph(proj_text, styles['Normal'])]
        ]

        table = Table(data, colWidths=[6*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2e3452')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#f0f2f8')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#3a4260')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#1c2033'), colors.HexColor('#22263a')]),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))

        return table

    def generate_report(self, players: List[Dict], week_start: str = None, output_path: str = None) -> str:
        """Generate full PDF report"""
        if not week_start:
            today = datetime.now()
            week_start = (today - timedelta(days=today.weekday())).strftime('%Y-%m-%d')

        if not output_path:
            week_num = datetime.now().isocalendar()[1]
            year = datetime.now().year
            output_path = f"/tmp/pace-report_week{week_num}_{year}.pdf"

        # Create PDF
        pdf = SimpleDocTemplate(output_path, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        elements = []
        styles = getSampleStyleSheet()

        # Title page
        title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=24, textColor=colors.HexColor('#00e676'), spaceAfter=20)
        subtitle_style = ParagraphStyle('CustomSubtitle', parent=styles['Normal'], fontSize=12, textColor=colors.HexColor('#b8c2d8'), spaceAfter=30)

        elements.append(Spacer(1, 0.5*inch))
        elements.append(Paragraph("⚡ Pace vs Opponent Report", title_style))
        elements.append(Paragraph(f"Weekly Game-by-Game Analysis", subtitle_style))
        elements.append(Paragraph(f"Week of {week_start}", styles['Normal']))
        elements.append(Spacer(1, 0.5*inch))

        # Fetch data by sport
        sports_data = {}
        for sport in ['NBA', 'NHL', 'MLB']:
            sports_data[sport] = self.fetch_espn_data(sport)

        # Filter players and create cards
        games_by_sport = {}
        for player_info in players:
            sport = player_info.get('sport', 'NBA').upper()
            player_name = player_info.get('name', '')

            # Find matching game
            mock_games = sports_data.get(sport, self._mock_data(sport))
            for game in mock_games:
                if player_name.lower() in game.get('player', '').lower():
                    if sport not in games_by_sport:
                        games_by_sport[sport] = []

                    # Calculate edge
                    favorability, message, delta = self.calculate_pace_edge(
                        game['player_pace'],
                        game['opponent_pace'],
                        sport
                    )
                    game['favorability'] = favorability
                    game['edge_message'] = message
                    game['delta'] = delta

                    games_by_sport[sport].append(game)

        # Create cards by sport
        for sport in ['NBA', 'NHL', 'MLB']:
            if sport in games_by_sport:
                elements.append(Paragraph(f"🏆 {sport} Matchups", styles['Heading2']))
                elements.append(Spacer(1, 0.2*inch))

                for game in games_by_sport[sport]:
                    elements.append(self.create_pace_card(game, sport))
                    elements.append(Spacer(1, 0.3*inch))

                elements.append(PageBreak())

        # Build PDF
        pdf.build(elements)
        print(f"✅ Report generated: {output_path}")
        return output_path


def main():
    """Example usage"""
    generator = PaceReportGenerator()

    # Example players
    players = [
        {'name': 'LeBron James', 'sport': 'NBA'},
        {'name': 'Luka Doncic', 'sport': 'NBA'},
        {'name': 'Connor McDavid', 'sport': 'NHL'},
        {'name': 'Mike Trout', 'sport': 'MLB'}
    ]

    # Generate report
    output = generator.generate_report(players)
    print(f"Report saved to: {output}")


if __name__ == '__main__':
    main()
