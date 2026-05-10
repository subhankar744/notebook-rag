import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Upload, Send, FileText, Loader2, Bot, User } from 'lucide-react';
import './App.css';

interface Message {
  role: 'user' | 'bot';
  content: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setStatus('Uploading and indexing document...');
    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(`${API_URL}/upload`, formData);
      setStatus('Document indexed! You can now ask questions.');
      setIsIndexing(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload document');
      setStatus('');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isChatting) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsChatting(true);

    try {
      const response = await axios.post(`${API_URL}/chat`, { message: userMessage });
      setMessages(prev => [...prev, { role: 'bot', content: response.data.answer }]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to get answer');
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Notebook RAG</h1>
        <p>Upload a document and start a conversation</p>
      </header>

      <main className="app-main">
        <section className="upload-section">
          <div className={`dropzone ${file ? 'has-file' : ''}`}>
            <input type="file" accept=".pdf" onChange={handleFileChange} id="file-upload" />
            <label htmlFor="file-upload">
              {file ? (
                <div className="file-info">
                  <FileText size={40} color="#3b82f6" />
                  <span>{file.name}</span>
                </div>
              ) : (
                <div className="upload-placeholder">
                  <Upload size={40} color="#94a3b8" />
                  <span>Click to select a PDF</span>
                </div>
              )}
            </label>
          </div>
          
          <button 
            onClick={handleUpload} 
            disabled={!file || isUploading}
            className="upload-button"
          >
            {isUploading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Indexing...
              </>
            ) : (
              'Process Document'
            )}
          </button>

          {status && <p className="status-text">{status}</p>}
          {error && <p className="error-text">{error}</p>}
        </section>

        <section className="chat-section">
          <div className="chat-window">
            {messages.length === 0 ? (
              <div className="empty-chat">
                <Bot size={48} color="#cbd5e1" />
                <p>No messages yet. Process a document to start chatting!</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`message-wrapper ${msg.role}`}>
                  <div className="avatar">
                    {msg.role === 'bot' ? <Bot size={20} /> : <User size={20} />}
                  </div>
                  <div className="message-content">
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="chat-input-area">
            <input
              type="text"
              placeholder="Ask a question about the document..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={!isIndexing || isChatting}
            />
            <button 
              onClick={handleSendMessage} 
              disabled={!isIndexing || !input.trim() || isChatting}
            >
              {isChatting ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
