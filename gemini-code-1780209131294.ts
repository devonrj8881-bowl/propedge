// app/page.tsx
'use client';

import { useState } from 'react';
import { generateBetAnalysis } from './actions/betting-analyst';

export default function AnalystDashboard() {
  const [analysisComponent, setAnalysisComponent] = useState<React.ReactNode | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleRunAnalysis = async () => {
    setLoading(true);
    // Call server action and store returning component payload stream
    const uiComponent = await generateBetAnalysis("Jesús Luzardo", "Strikeouts");
    setAnalysisComponent(uiComponent);
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      <button 
        onClick={handleRunAnalysis}
        disabled={loading}
        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-lg transition disabled:opacity-50"
      >
        {loading ? 'Processing Slate Math...' : 'Generate +EV Analysis'}
      </button>

      <div className="mt-8 prose prose-invert max-w-none">
        {analysisComponent}
      </div>
    </div>
  );
}