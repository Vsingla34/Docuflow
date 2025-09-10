
import React, { useState, useEffect } from 'react';
import { Page, User, Client, DocumentRequest, Document, ComplianceTemplate, SavedView } from './types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import TemplateLibrary from './pages/TemplateLibrary';
import Documents from './pages/Documents';
import Clients from './pages/Clients';
import Requests from './pages/Requests';
import ClientDashboard from './pages/ClientDashboard';
import ClientPortal from './pages/ClientPortal';
import Users from './pages/Users';
import { MOCK_CLIENTS, MOCK_COMPLIANCE_TEMPLATES, MOCK_DOCUMENTS, MOCK_REQUESTS, MOCK_USERS } from './data/mockData';

function usePersistentState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const storedValue = localStorage.getItem(key);
      return storedValue ? JSON.parse(storedValue) : defaultValue;
    } catch (error) {
      console.error(`Error reading from localStorage key “${key}”:`, error);
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error(`Error writing to localStorage key “${key}”:`, error);
    }
  }, [key, state]);

  return [state, setState];
}

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.Dashboard);
  const [users, setUsers] = usePersistentState('users', MOCK_USERS);
  const [currentUser, setCurrentUser] = usePersistentState<User>('currentUser', users[0]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [activePortalRequest, setActivePortalRequest] = useState<DocumentRequest | null>(null);

  const [clients, setClients] = usePersistentState('clients', MOCK_CLIENTS);
  const [templates, setTemplates] = usePersistentState('templates', MOCK_COMPLIANCE_TEMPLATES);
  const [documents, setDocuments] = usePersistentState('documents', MOCK_DOCUMENTS);
  const [requests, setRequests] = usePersistentState('requests', MOCK_REQUESTS);
  const [savedViews, setSavedViews] = usePersistentState<SavedView[]>('savedViews', []);

  // --- Data Filtering based on User Role ---
  const visibleClients = currentUser.role === 'Client' ? clients.filter(c => c.id === currentUser.clientId) : clients;
  const visibleRequests = currentUser.role === 'Client' ? requests.filter(r => r.clientId === currentUser.clientId) : requests;
  const visibleDocuments = currentUser.role === 'Client' ? documents.filter(d => d.clientId === currentUser.clientId) : documents;


  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setCurrentPage(Page.ClientDashboard);
  };

  const handleBackToClients = () => {
    setSelectedClient(null);
    setCurrentPage(Page.Clients);
  };
  
  const openClientPortal = (token: string) => {
      const request = requests.find(r => r.portalToken === token);
      if (request) {
          setActivePortalRequest(request);
          setCurrentPage(Page.ClientPortal);
      } else {
          alert("Invalid or expired portal link.");
      }
  }

  const renderPage = () => {
    switch (currentPage) {
      case Page.Dashboard:
        return <Dashboard documents={visibleDocuments} requests={visibleRequests} clients={visibleClients} compliances={templates} />;
      case Page.Templates:
        return <TemplateLibrary templates={templates} setTemplates={setTemplates} currentUser={currentUser} />;
      case Page.Documents:
        return <Documents documents={visibleDocuments} setDocuments={setDocuments} clients={visibleClients} />;
      case Page.Clients:
        return <Clients clients={visibleClients} setClients={setClients} currentUser={currentUser} onViewDashboard={handleSelectClient} />;
      case Page.Requests:
        return <Requests requests={visibleRequests} setRequests={setRequests} clients={visibleClients} templates={templates} onOpenPortal={openClientPortal} currentUser={currentUser}/>;
      case Page.UserManagement:
        return <Users users={users} setUsers={setUsers} clients={clients} />;
      case Page.ClientDashboard:
        if (!selectedClient) {
          setCurrentPage(Page.Clients);
          return null;
        }
        return (
          <ClientDashboard 
            client={selectedClient} 
            onBack={handleBackToClients} 
            allDocuments={documents}
            setAllDocuments={setDocuments}
            allRequests={requests}
            compliances={templates}
          />
        );
      case Page.ClientPortal:
        if (!activePortalRequest) {
            setCurrentPage(Page.Dashboard);
            return null;
        }
        return <ClientPortal request={activePortalRequest} client={clients.find(c => c.id === activePortalRequest.clientId)!} documents={documents.filter(d => d.requestId === activePortalRequest.id)} setRequests={setRequests} allRequests={requests}/>
      default:
        return <Dashboard documents={documents} requests={requests} clients={clients} compliances={templates}/>;
    }
  };
  
  // Fix: Explicitly declare pageTitle as a string to allow assigning dynamic titles.
  // This resolves the error where a string was assigned to a variable inferred as type Page.
  let pageTitle: string = currentPage;
  if (currentPage === Page.ClientDashboard) pageTitle = `${selectedClient?.name}'s Dashboard`;
  if (currentPage === Page.ClientPortal) pageTitle = `Client Portal: ${clients.find(c => c.id === activePortalRequest?.clientId)?.company}`;


  return (
    <div className="flex h-screen bg-background font-sans text-text-main">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} currentUser={currentUser} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
            title={pageTitle} 
            currentUser={currentUser} 
            users={users} 
            setCurrentUser={setCurrentUser} 
            documents={documents}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6 lg:p-8">
          {renderPage()}
        </main>
      </div>
    </div>
  );
};

export default App;