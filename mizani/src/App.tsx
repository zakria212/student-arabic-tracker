import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DetailsProvider } from './components/TransactionDetails';
import { PeriodProvider } from './state/period';
import { SettingsProvider } from './state/settings';
import { ToastProvider } from './state/toast';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import TransactionForm from './pages/TransactionForm';
import Reports from './pages/Reports';
import PrintReport from './pages/PrintReport';
import SettingsPage from './pages/Settings';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <PeriodProvider>
          <DetailsProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="transactions/new" element={<TransactionForm />} />
                <Route path="transactions/:id/edit" element={<TransactionForm />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFound />} />
              </Route>
              <Route path="reports/print" element={<PrintReport />} />
            </Routes>
          </DetailsProvider>
        </PeriodProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}
