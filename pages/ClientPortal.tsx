import React, { useState } from 'react';
import { DocumentRequest, Client, Document, DocumentStatus, Comment } from '../types';
import DocumentIcon from '../components/icons/DocumentIcon';
import CheckCircleIcon from '../components/icons/CheckCircleIcon';
import ClockIcon from '../components/icons/ClockIcon';

interface ClientPortalProps {
    request: DocumentRequest;
    client: Client;
    documents: Document[];
    allRequests: DocumentRequest[];
    setRequests: React.Dispatch<React.SetStateAction<DocumentRequest[]>>;
}

const ClientPortal: React.FC<ClientPortalProps> = ({ request, client, documents, allRequests, setRequests }) => {
    const [newComment, setNewComment] = useState("");

    const handleAddComment = () => {
        if (!newComment.trim()) return;

        const comment: Comment = {
            id: `cmt-${Date.now()}`,
            author: client.name,
            text: newComment,
            timestamp: new Date().toLocaleString(),
        };

        const updatedRequests = allRequests.map(r => 
            r.id === request.id 
                ? { ...r, clarificationThread: [...r.clarificationThread, comment], status: DocumentStatus.Clarification_Needed } 
                : r
        );
        setRequests(updatedRequests);
        setNewComment("");
    }

    return (
        <div className="max-w-4xl mx-auto">
            <header className="bg-card p-6 rounded-xl shadow-sm border-l-4 border-primary mb-8">
                <h1 className="text-2xl font-bold text-text-main">Document Request for {client.company}</h1>
                <p className="text-text-light mt-1">Please upload the following documents by the due date: <span className="font-semibold text-red-600">{request.dueDate}</span></p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left side: Checklist */}
                <div className="bg-card p-6 rounded-xl shadow-sm">
                    <h2 className="text-xl font-semibold mb-4">Required Documents</h2>
                    <div className="space-y-4">
                        {request.documents.map(doc => {
                            const submittedDoc = documents.find(d => d.name === doc.name);
                            const isSubmitted = !!submittedDoc;

                            return (
                                <div key={doc.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
                                    <div className="flex items-center space-x-3">
                                        {isSubmitted ? <CheckCircleIcon className="w-6 h-6 text-green-500" /> : <DocumentIcon className="w-6 h-6 text-gray-400" />}
                                        <div>
                                            <p className={`font-medium ${isSubmitted ? 'line-through text-gray-500' : ''}`}>{doc.name}</p>
                                            {submittedDoc && <p className="text-xs text-text-light">Status: {submittedDoc.status.replace('_', ' ')}</p>}
                                        </div>
                                    </div>
                                    {!isSubmitted && (
                                        <button className="text-sm bg-primary text-white px-3 py-1 rounded-md hover:bg-primary-dark">Upload</button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right side: Communication */}
                <div className="bg-card p-6 rounded-xl shadow-sm">
                    <h2 className="text-xl font-semibold mb-4">Need Help?</h2>
                     <div className="space-y-4 max-h-64 overflow-y-auto bg-gray-50 p-3 rounded-md mb-4">
                        {request.clarificationThread.map(comment => (
                            <div key={comment.id}>
                                <div className={`p-3 rounded-lg ${comment.author === client.name ? 'bg-blue-100' : 'bg-gray-200'}`}>
                                    <p className="text-sm">{comment.text}</p>
                                    <p className="text-xs text-text-light text-right mt-1"> - {comment.author}, {comment.timestamp}</p>
                                </div>
                            </div>
                        ))}
                         {request.clarificationThread.length === 0 && <p className="text-center text-sm text-gray-500">No comments yet.</p>}
                    </div>
                    <div>
                        <textarea 
                            value={newComment}
                            onChange={e => setNewComment(e.target.value)}
                            rows={3}
                            placeholder="Type your message here..."
                            className="w-full p-2 border rounded-md"
                        />
                        <button onClick={handleAddComment} className="mt-2 w-full bg-secondary text-white py-2 rounded-md hover:bg-green-600">Send Message</button>
                    </div>
                </div>
            </div>
        </div>
    )
};

export default ClientPortal;
