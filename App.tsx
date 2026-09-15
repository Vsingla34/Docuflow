import React, { useState } from 'react';
import { AssetStoreProvider, useAssetStore } from './store/AssetStore';
import { ToastProvider } from './components/ui/Toast';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import { PAGE_TITLES, PageKey } from './components/layout/nav';

import Dashboard from './pages/Dashboard';
import AssetRegister from './pages/AssetRegister';
import Categories from './pages/Categories';
import Requisitions from './pages/Requisitions';
import PurchaseOrders from './pages/PurchaseOrders';
import Grns from './pages/Grns';
import Transfers from './pages/Transfers';
import GatePasses from './pages/GatePasses';
import Amc from './pages/Amc';
import ServiceTickets from './pages/ServiceTickets';
import Replacements from './pages/Replacements';
import Disposals from './pages/Disposals';
import Audits from './pages/Audits';
import Doa from './pages/Doa';
import Masters from './pages/Masters';
import Employees from './pages/Employees';
import ActivityLog from './pages/ActivityLog';

const PAGES: Record<PageKey, React.ComponentType<{ onNavigate: (page: PageKey) => void }>> = {
  dashboard: Dashboard,
  assets: AssetRegister,
  categories: Categories,
  requisitions: Requisitions,
  purchaseOrders: PurchaseOrders,
  grns: Grns,
  transfers: Transfers,
  gatePasses: GatePasses,
  amc: Amc,
  serviceTickets: ServiceTickets,
  replacements: Replacements,
  disposals: Disposals,
  audits: Audits,
  doa: Doa,
  masters: Masters,
  employees: Employees,
  activity: ActivityLog,
};

const Shell: React.FC = () => {
  const { currentUser } = useAssetStore();
  const [currentPage, setCurrentPage] = useState<PageKey>('dashboard');

  const PageComponent = PAGES[currentPage];

  return (
    <div className="flex h-screen bg-background font-sans text-text-main">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} currentUser={currentUser} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={PAGE_TITLES[currentPage]} onNavigate={setCurrentPage} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-5 lg:p-8">
          <PageComponent onNavigate={setCurrentPage} />
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => (
  <AssetStoreProvider>
    <ToastProvider>
      <Shell />
    </ToastProvider>
  </AssetStoreProvider>
);

export default App;
