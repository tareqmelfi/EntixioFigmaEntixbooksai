/** Local test harness, not a product route or a source of financial data. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HistoricalStatements } from '../../src/app/components/historical-statements';
import { LanguageProvider } from '../../src/app/components/LanguageContext';
import '../../src/styles/index.css';
const params = new URLSearchParams(location.search);
localStorage.setItem('entix-language', params.get('language') || 'ar');
function Preview() {
  const [org, setOrg] = useState({ id:'preview-org', crNumber: params.get('cr') || 'SYNTHETIC-001', country:params.get('country') || 'US', baseCurrency:params.get('currency') || 'USD' });
  return <main className="mx-auto max-w-[1400px] p-5"><p className="mb-4 text-sm text-warning">LOCAL PREVIEW · Company identity is supplied for this preview, not authenticated.</p><button className="mb-4 text-sm underline" onClick={() => setOrg({...org, id:'another-org', crNumber:'OTHER'})}>Switch preview company</button><HistoricalStatements org={org} onClose={() => location.reload()} /></main>;
}
createRoot(document.getElementById('root')!).render(<LanguageProvider><Preview /></LanguageProvider>);
