import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Client, ComplianceTemplate, Document, DocumentRequest, DocumentStatus } from '../types';
import DashboardCard from '../components/DashboardCard';
import DocumentIcon from '../components/icons/DocumentIcon';
import RequestIcon from '../components/icons/RequestIcon';
import ClientIcon from '../components/icons/ClientIcon';
import ComplianceIcon from '../components/icons/ComplianceIcon';
import ClockIcon from '../components/icons/ClockIcon';

const Dashboard: React.FC<{
  documents: Document[];
  requests: DocumentRequest[];
  clients: Client[];
  compliances: ComplianceTemplate[];
}> = ({ documents, requests, clients, compliances }) => {
  const pendingRequests = requests.filter(r => r.status !== DocumentStatus.Approved).length;

  const docStatusData = [
    { name: 'Pending', value: documents.filter(d => d.status === DocumentStatus.Pending).length },
    { name: 'Received', value: documents.filter(d => d.status === DocumentStatus.Received).length },
    { name: 'Approved', value: documents.filter(d => d.status === DocumentStatus.Approved).length },
    { name: 'Rejected', value: documents.filter(d => d.status === DocumentStatus.Rejected).length },
  ];

  const COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444'];
  
  const getClientName = (clientId: string) => clients.find(c => c.id === clientId)?.name || 'Unknown Client';
  const getComplianceName = (complianceId: string) => compliances.find(c => c.id === complianceId)?.name || 'Unknown Compliance';

  const expiringDocuments = documents.filter(doc => {
    if (!doc.expiryDate) return false;
    const expiry = new Date(doc.expiryDate);
    const today = new Date();
    const daysUntilExpiry = (expiry.getTime() - today.getTime()) / (1000 * 3600 * 24);
    return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
  });

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard title="Total Templates" value={compliances.length} icon={<ComplianceIcon className="w-6 h-6 text-white"/>} color="bg-blue-400" />
        <DashboardCard title="Pending Requests" value={pendingRequests} icon={<RequestIcon className="w-6 h-6 text-white"/>} color="bg-yellow-400" />
        <DashboardCard title="Documents Reviewed" value={documents.filter(d => [DocumentStatus.Approved, DocumentStatus.Rejected].includes(d.status)).length} icon={<DocumentIcon className="w-6 h-6 text-white"/>} color="bg-green-400" />
        <DashboardCard title="Active Clients" value={clients.length} icon={<ClientIcon className="w-6 h-6 text-white"/>} color="bg-purple-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-card p-6 rounded-xl shadow-sm">
          <h2 className="text-xl font-semibold mb-4 text-text-main">Recent Document Updates</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-sm text-text-light">
                  <th className="py-2">Document</th>
                  <th className="py-2">Client</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {documents.slice(0, 5).map(doc => (
                  <tr key={doc.id} className="border-b border-border last:border-b-0">
                    <td className="py-3 font-medium">{doc.name}</td>
                    <td className="py-3 text-text-light">{getClientName(doc.clientId)}</td>
                    <td className="py-3">
                       <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          doc.status === DocumentStatus.Approved ? 'bg-green-100 text-green-700' :
                          doc.status === DocumentStatus.Received ? 'bg-blue-100 text-blue-700' :
                          doc.status === DocumentStatus.Rejected ? 'bg-red-100 text-red-700' : 
                          doc.status === DocumentStatus.Under_Review ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'
                       }`}>{doc.status.replace('_', ' ')}</span>
                    </td>
                    <td className="py-3 text-text-light">{doc.submittedDate || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-card p-6 rounded-xl shadow-sm">
          <h2 className="text-xl font-semibold mb-4 text-text-main">Document Status Overview</h2>
          <div className="w-full h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={docStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8">
                  {docStatusData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-card p-6 rounded-xl shadow-sm">
              <h2 className="text-xl font-semibold mb-4 text-text-main">Pending Requests</h2>
               <div className="space-y-4">
                  {requests.filter(r => r.status !== DocumentStatus.Approved).slice(0, 4).map(req => (
                      <div key={req.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
                          <div>
                              <p className="font-semibold">{getComplianceName(req.complianceId)}</p>
                              <p className="text-sm text-text-light">For: {getClientName(req.clientId)}</p>
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-yellow-600">
                              <ClockIcon />
                              <span>Due: {req.dueDate}</span>
                          </div>
                      </div>
                  ))}
               </div>
            </div>
             <div className="bg-card p-6 rounded-xl shadow-sm">
              <h2 className="text-xl font-semibold mb-4 text-text-main">Expiring Documents</h2>
               <div className="space-y-4">
                  {expiringDocuments.length > 0 ? expiringDocuments.slice(0, 4).map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                          <div>
                              <p className="font-semibold">{doc.name}</p>
                              <p className="text-sm text-text-light">Client: {getClientName(doc.clientId)}</p>
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-red-600">
                              <ClockIcon />
                              <span>Expires: {doc.expiryDate}</span>
                          </div>
                      </div>
                  )) : (
                    <p className="text-text-light text-center py-4">No documents expiring in the next 30 days.</p>
                  )}
               </div>
            </div>
       </div>
    </div>
  );
};

export default Dashboard;
