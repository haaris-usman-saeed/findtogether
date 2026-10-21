import { BrowserRouter, Route, Routes } from 'react-router';
import { AppShell } from './components/layout/AppShell';
import { DemoProvider, useDemo } from './demo/DemoContext';
import { DemoPanel } from './demo/DemoPanel';
import { CaseReviewPage } from './screens/CaseReviewPage';
import { CasesPage } from './screens/CasesPage';
import { DashboardPage } from './screens/DashboardPage';
import { NotFoundPage } from './screens/NotFoundPage';
import { RegisterPage } from './screens/RegisterPage';
import { SearchPage } from './screens/SearchPage';
import { StatusPage } from './screens/StatusPage';
import { apiMode } from './services';
import { DraftProvider } from './state/drafts';
import { SessionProvider } from './state/session';
import { SheltersProvider } from './state/shelters';

function AppRoutes() {
  // Demo resets bump the epoch so every page remounts against the fresh data.
  const { epoch } = useDemo();
  return (
    <Routes key={epoch}>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/status" element={<StatusPage />} />
      <Route path="/cases" element={<CasesPage />} />
      <Route path="/cases/:reference" element={<CaseReviewPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <DraftProvider>
          <SheltersProvider>
            <DemoProvider>
              <AppShell>
                <AppRoutes />
              </AppShell>
              {apiMode === 'mock' && <DemoPanel />}
            </DemoProvider>
          </SheltersProvider>
        </DraftProvider>
      </SessionProvider>
    </BrowserRouter>
  );
}
