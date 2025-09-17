import React, { useState, useEffect, useCallback } from 'react';
import { Search, Hash, Users, Clock, ExternalLink, Image, Play, Copy, CheckCircle, AlertCircle, Loader2, Settings, TrendingUp, BarChart3, Activity, Download, Trash2, Database, Calendar, Zap, Pause } from 'lucide-react';

// Reusable Components
const TabButton = ({ id, label, icon: Icon, count, activeTab, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`flex items-center px-6 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
      activeTab === id
        ? 'bg-slate-900 text-white shadow-lg'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
    }`}
  >
    <Icon className="w-4 h-4 mr-2" />
    {label}
    {count !== undefined && (
      <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
        activeTab === id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
      }`}>
        {count}
      </span>
    )}
  </button>
);

const LoadingSpinner = ({ size = 'default', text = 'Loading...' }) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    default: 'w-5 h-5',
    large: 'w-8 h-8'
  };
  return (
    <div className="flex items-center justify-center">
      <Loader2 className={`${sizeClasses[size]} animate-spin mr-2`} />
      <span className="text-sm">{text}</span>
    </div>
  );
};

const ErrorAlert = ({ error, onRetry, onBack }) => (
  <div className="bg-red-50 border border-red-200 rounded-xl p-6">
    <div className="flex items-start">
      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-red-900 mb-1">Request Failed</h3>
        <p className="text-sm text-red-700 mb-3">{error}</p>
        <div className="flex space-x-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-xs text-red-600 hover:text-red-800 font-medium underline"
            >
              Try Again
            </button>
          )}
          {onBack && (
            <button
              onClick={onBack}
              className="text-xs text-red-600 hover:text-red-800 font-medium underline"
            >
              ← Back to Configuration
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
);

const StatCard = ({ title, value, bgColor, textColor, icon: Icon }) => (
  <div className={`text-center p-4 ${bgColor} rounded-lg`}>
    <div className="flex items-center justify-center mb-2">
      {Icon && <Icon className={`w-5 h-5 ${textColor}`} />}
    </div>
    <div className={`text-2xl font-bold ${textColor}`}>{value}</div>
    <div className="text-sm text-slate-600 mt-1">{title}</div>
  </div>
);

// Real-time Progress Component
const StreamingProgress = ({ progress, isStreaming, onStop }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <Zap className={`w-5 h-5 ${isStreaming ? 'text-green-500 animate-pulse' : 'text-gray-500'}`} />
          <h3 className="text-lg font-semibold text-slate-900">
            {isStreaming ? 'Live Data Extraction' : 'Extraction Complete'}
          </h3>
        </div>
        {progress?.stage && (
          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
            {progress.stage.replace('_', ' ').toUpperCase()}
          </span>
        )}
      </div>
      
      {isStreaming && (
        <button
          onClick={onStop}
          className="flex items-center px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
        >
          <Pause className="w-4 h-4 mr-1" />
          Stop Stream
        </button>
      )}
    </div>
    
    {progress && (
      <>
        <div className="mb-4">
          <div className="flex justify-between text-sm text-slate-600 mb-2">
            <span>{progress.message || 'Processing...'}</span>
            <span>{progress.percentage || 0}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ease-out ${
                isStreaming ? 'bg-gradient-to-r from-blue-500 to-green-500' : 'bg-green-500'
              }`}
              style={{ width: `${progress.percentage || 0}%` }}
            />
          </div>
        </div>
        
        {progress.current && progress.total && (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Progress:</span>
              <span className="ml-2 font-medium text-slate-900">
                {progress.current}/{progress.total}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Current:</span>
              <span className="ml-2 font-medium text-slate-900">
                {progress.processing_post ? `Post ${progress.processing_post.slice(0, 8)}...` : 'Initializing'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">ETA:</span>
              <span className="ml-2 font-medium text-slate-900">
                {progress.total && progress.current ? 
                  `~${Math.ceil((progress.total - progress.current) * 3 / 60)} min` : 
                  'Calculating...'
                }
              </span>
            </div>
          </div>
        )}
      </>
    )}
  </div>
);

export default function App() {
  // State Management
  const [formData, setFormData] = useState({
    hashtag: '',
    sessionid: '',
    headless: true,
    timeoutMs: 120000,
    limit: 5
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [storedResults, setStoredResults] = useState([]);
  const [selectedStoredResult, setSelectedStoredResult] = useState(null);
  
  // Streaming States
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamProgress, setStreamProgress] = useState(null);
  const [streamedPosts, setStreamedPosts] = useState([]);
  const [streamMetadata, setStreamMetadata] = useState(null);
  const [streamController, setStreamController] = useState(null);

  // Constants
  const STORAGE_KEYS = {
    FORM_DATA: 'instagram_analytics_form_data',
    RESULTS: 'instagram_analytics_results'
  };

  // Utility Functions
  const formatNumber = useCallback((num) => {
    if (num === null || num === undefined || isNaN(num)) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }, []);

  const formatDate = useCallback((dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  }, []);

  const copyToClipboard = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  }, []);

  const getMediaIcon = useCallback((mediaType) => {
    switch (mediaType?.toUpperCase()) {
      case 'IMAGE': return <Image className="w-4 h-4" />;
      case 'VIDEO': return <Play className="w-4 h-4" />;
      case 'CAROUSEL_ALBUM': return <BarChart3 className="w-4 h-4" />;
      default: return <Image className="w-4 h-4" />;
    }
  }, []);

  // Data Management Functions
  const loadSavedData = useCallback(() => {
    try {
      const savedFormData = localStorage.getItem(STORAGE_KEYS.FORM_DATA);
      if (savedFormData) {
        const parsedFormData = JSON.parse(savedFormData);
        setFormData(prev => ({
          ...prev,
          ...parsedFormData
        }));
      }

      const savedResults = localStorage.getItem(STORAGE_KEYS.RESULTS);
      if (savedResults) {
        const parsedResults = JSON.parse(savedResults);
        setStoredResults(parsedResults);
      }
    } catch (error) {
      console.error('Error loading saved data:', error);
      setError('Failed to load saved data from browser storage');
    }
  }, [STORAGE_KEYS.FORM_DATA, STORAGE_KEYS.RESULTS]);

  const saveFormData = useCallback((data) => {
    try {
      localStorage.setItem(STORAGE_KEYS.FORM_DATA, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving form data:', error);
    }
  }, [STORAGE_KEYS.FORM_DATA]);

  const saveResultToStorage = useCallback((result) => {
    try {
      const savedResults = localStorage.getItem(STORAGE_KEYS.RESULTS);
      let resultsArray = savedResults ? JSON.parse(savedResults) : [];
      
      const resultWithMetadata = {
        ...result,
        id: Date.now(),
        savedAt: new Date().toISOString(),
        searchParams: {
          hashtag: formData.hashtag,
          limit: formData.limit,
          timeoutMs: formData.timeoutMs,
          headless: formData.headless
        }
      };
      
      resultsArray.unshift(resultWithMetadata);
      
      if (resultsArray.length > 20) {
        resultsArray = resultsArray.slice(0, 20);
      }
      
      localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(resultsArray));
      setStoredResults(resultsArray);
    } catch (error) {
      console.error('Error saving result to storage:', error);
      setError('Failed to save results to browser storage');
    }
  }, [STORAGE_KEYS.RESULTS, formData]);

  const deleteStoredResult = useCallback((resultId) => {
    try {
      const updatedResults = storedResults.filter(result => result.id !== resultId);
      localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(updatedResults));
      setStoredResults(updatedResults);
      
      if (selectedStoredResult && selectedStoredResult.id === resultId) {
        setSelectedStoredResult(null);
        setResults(null);
      }
    } catch (error) {
      console.error('Error deleting stored result:', error);
      setError('Failed to delete stored result');
    }
  }, [storedResults, selectedStoredResult, STORAGE_KEYS.RESULTS]);

  const clearAllStoredData = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.RESULTS);
      localStorage.removeItem(STORAGE_KEYS.FORM_DATA);
      setStoredResults([]);
      setSelectedStoredResult(null);
      setResults(null);
      setFormData({
        hashtag: '',
        sessionid: '',
        headless: true,
        timeoutMs: 120000,
        limit: 5
      });
    } catch (error) {
      console.error('Error clearing stored data:', error);
      setError('Failed to clear stored data');
    }
  }, [STORAGE_KEYS.RESULTS, STORAGE_KEYS.FORM_DATA]);

  const loadStoredResult = useCallback((storedResult) => {
    setResults(storedResult);
    setSelectedStoredResult(storedResult);
    setActiveTab('results');
    setError(null);
    setStreamedPosts([]);
    setStreamProgress(null);
    setStreamMetadata(null);
  }, []);

  // Form Validation
  const validateForm = useCallback(() => {
    if (!formData.hashtag.trim()) {
      setError('Please enter a hashtag');
      return false;
    }
    if (!formData.sessionid.trim()) {
      setError('Please enter your Instagram session ID');
      return false;
    }
    return true;
  }, [formData.hashtag, formData.sessionid]);

  // Streaming Functions
  const stopStreaming = useCallback(() => {
    if (streamController) {
      streamController.abort();
      setStreamController(null);
    }
    setIsStreaming(false);
    setLoading(false);
  }, [streamController]);

  const handleStreamSubmit = useCallback(async () => {
    setError(null);
    
    if (!validateForm()) {
      return;
    }

    // Clear previous results
    setResults(null);
    setSelectedStoredResult(null);
    setStreamedPosts([]);
    setStreamProgress(null);
    setStreamMetadata(null);

    setLoading(true);
    setIsStreaming(true);

    try {
      const payload = {
        hashtag: formData.hashtag.trim().replace('#', ''),
        cookies: [
          { 
            name: "sessionid", 
            value: formData.sessionid.trim(), 
            domain: ".instagram.com" 
          }
        ],
        headless: formData.headless,
        timeoutMs: parseInt(formData.timeoutMs),
        limit: parseInt(formData.limit)
      };

      // Create AbortController for stream cancellation
      const controller = new AbortController();
      setStreamController(controller);

      // Use fetch with streaming response - ONLY ONE API CALL
      const response = await fetch('https://instagram-post-finder-backend-lemon.vercel.app/api/hashtag-stream/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      setLoading(false);
      setActiveTab('results');

      const processStream = async () => {
        let buffer = '';
        let currentEvent = null;
        let completedPosts = []; // Track posts locally to avoid state race conditions
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.trim() === '') continue;

              if (line.startsWith('event: ')) {
                currentEvent = line.slice(7).trim();
                continue;
              }

              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  switch (currentEvent) {
                    case 'status':
                      setStreamProgress(data);
                      break;
                      
                    case 'metadata':
                      setStreamMetadata(data);
                      break;
                      
                    case 'progress':
                      setStreamProgress(data);
                      break;
                      
                    case 'post_processed':
                      completedPosts.push(data); // Add to local array
                      setStreamedPosts(prev => [...prev, data]); // Update UI
                      break;
                      
                    case 'complete':
                      setIsStreaming(false);
                      setStreamProgress({ ...data, percentage: 100 });
                      
                      // **FIXED: Create final result object and save ONLY ONCE**
                      const finalResult = {
                        success: true,
                        hashtag: data.hashtag,
                        total_posts: data.total_posts_processed,
                        posts_with_profiles: completedPosts, // Use local array instead of state
                        metadata: {
                          processed_at: data.completed_at,
                          headless_mode: formData.headless,
                          timeout_ms: formData.timeoutMs
                        }
                      };
                      
                      // Set results and save to storage - SINGLE SAVE
                      setResults(finalResult);
                      saveResultToStorage(finalResult);
                      break;
                      
                    case 'error':
                      setError(data.error || data.details || 'Unknown error occurred');
                      setIsStreaming(false);
                      setLoading(false);
                      break;
                  }
                } catch (parseError) {
                  console.error('Error parsing SSE data:', parseError);
                }
              }
            }
          }
        } catch (streamError) {
          if (streamError.name !== 'AbortError') {
            console.error('Stream processing error:', streamError);
            setError('Stream connection lost. Please try again.');
          }
          setIsStreaming(false);
          setLoading(false);
        }
      };

      processStream();

    } catch (err) {
      setLoading(false);
      setIsStreaming(false);
      
      if (err.name === 'AbortError') {
        setError('Stream was cancelled.');
      } else if (err.message.includes('fetch')) {
        setError('Unable to connect to the server. Please ensure the API is running on https://instagram-post-finder-omega.vercel.app/');
      } else {
        setError(err.message || 'An unexpected error occurred. Please try again.');
      }
    }
  }, [formData, validateForm, saveResultToStorage]);

  // Form Change Handler
  const handleFormChange = useCallback((newFormData) => {
    setFormData(newFormData);
    saveFormData(newFormData);
    if (error) setError(null);
  }, [saveFormData, error]);

  // Download Functions
  const downloadResults = useCallback(() => {
    const dataToDownload = results || {
      hashtag: streamMetadata?.hashtag || formData.hashtag,
      posts_with_profiles: streamedPosts,
      metadata: streamMetadata,
      streaming_completed_at: new Date().toISOString()
    };

    if (!dataToDownload) return;
    
    try {
      const dataStr = JSON.stringify(dataToDownload, null, 2);
      const dataBlob = new Blob([dataStr], {type: 'application/json'});
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `instagram-${dataToDownload.hashtag}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading results:', error);
      setError('Failed to download results');
    }
  }, [results, streamedPosts, streamMetadata, formData.hashtag]);

  const exportAllStoredResults = useCallback(() => {
    if (storedResults.length === 0) return;
    try {
      const dataStr = JSON.stringify(storedResults, null, 2);
      const dataBlob = new Blob([dataStr], {type: 'application/json'});
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `instagram-analytics-export-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting results:', error);
      setError('Failed to export stored results');
    }
  }, [storedResults]);

  // Load data on component mount
  useEffect(() => {
    loadSavedData();
  }, [loadSavedData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamController) {
        streamController.abort();
      }
    };
  }, [streamController]);

  // Check if form is valid for button state
  const isFormValid = formData.hashtag.trim() && formData.sessionid.trim();

  // Combine regular results and streamed posts for display
  const displayPosts = results?.posts_with_profiles || streamedPosts || [];
  const displayMetadata = results || streamMetadata;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-slate-900 rounded-lg">
                  <Hash className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-slate-900">
                    Instagram Analytics Platform
                  </h1>
                  <p className="text-sm text-slate-500">Real-time hashtag analysis with live streaming</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-slate-600">
                <Activity className="w-4 h-4" />
                <span>Status: {isStreaming ? 'Streaming Live' : 'Ready'}</span>
              </div>
              {(results || streamedPosts.length > 0) && (
                <button
                  onClick={downloadResults}
                  className="flex items-center px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Data
                </button>
              )}
              {storedResults.length > 0 && (
                <button
                  onClick={exportAllStoredResults}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Database className="w-4 h-4 mr-2" />
                  Export All
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="flex space-x-1 mb-8 p-1 bg-white rounded-xl shadow-sm border border-slate-200">
          <TabButton 
            id="overview" 
            label="Configuration" 
            icon={Settings}
            activeTab={activeTab}
            onClick={setActiveTab}
          />
          <TabButton 
            id="results" 
            label="Live Results" 
            icon={TrendingUp} 
            count={displayPosts.length}
            activeTab={activeTab}
            onClick={setActiveTab}
          />
          <TabButton 
            id="storage" 
            label="Stored Data" 
            icon={Database} 
            count={storedResults.length}
            activeTab={activeTab}
            onClick={setActiveTab}
          />
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Configuration Panel */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Real-time Extraction Configuration
                </h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Target Hashtag
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={formData.hashtag}
                        onChange={(e) => handleFormChange({...formData, hashtag: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all text-sm"
                        placeholder="Enter hashtag (e.g., nike, travel, fashion)"
                        required
                        disabled={isStreaming}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Instagram Session ID
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      type="password"
                      value={formData.sessionid}
                      onChange={(e) => handleFormChange({...formData, sessionid: e.target.value})}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all text-sm"
                      placeholder="Your Instagram authentication token"
                      required
                      disabled={isStreaming}
                    />
                    <p className="text-xs text-slate-500 mt-2 bg-slate-50 p-3 rounded-lg">
                      <strong>Security Note:</strong> This session ID is stored locally in your browser for convenience. 
                      It will be transmitted securely to authenticate your requests.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Post Limit
                      </label>
                      <select
                        value={formData.limit}
                        onChange={(e) => handleFormChange({...formData, limit: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all text-sm"
                        disabled={isStreaming}
                      >
                        <option value="5">5 posts</option>
                        <option value="10">10 posts</option>
                        <option value="25">25 posts</option>
                        <option value="50">50 posts</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Timeout (seconds)
                      </label>
                      <select
                        value={formData.timeoutMs}
                        onChange={(e) => handleFormChange({...formData, timeoutMs: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all text-sm"
                        disabled={isStreaming}
                      >
                        <option value="30000">30 seconds</option>
                        <option value="60000">60 seconds</option>
                        <option value="120000">120 seconds</option>
                        <option value="180000">180 seconds</option>
                        <option value="300000">300 seconds</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-slate-700">
                          Headless Browser Mode
                        </label>
                        <p className="text-xs text-slate-500">
                          Run browser without UI for faster processing
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.headless}
                          onChange={(e) => handleFormChange({...formData, headless: e.target.checked})}
                          className="sr-only peer"
                          disabled={isStreaming}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-slate-900 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900 peer-disabled:opacity-50"></div>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <button
                    onClick={isStreaming ? stopStreaming : handleStreamSubmit}
                    disabled={loading || (!isFormValid && !isStreaming)}
                    className={`w-full py-3.5 px-6 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm ${
                      isStreaming 
                        ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white' 
                        : 'bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 focus:ring-green-500 text-white'
                    }`}
                  >
                    {loading && !isStreaming ? (
                      <LoadingSpinner size="small" text="Initializing Stream..." />
                    ) : isStreaming ? (
                      <>
                        <Pause className="w-4 h-4 mr-2" />
                        Stop Extraction
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Start Real-time Extraction
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Information Panel */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">
                  Real-time Platform Features
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-start space-x-3 p-4 bg-green-50 rounded-lg">
                    <Zap className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-green-900 text-sm">Live Streaming</h4>
                      <p className="text-green-700 text-xs mt-1">
                        Watch profiles get extracted in real-time with live progress updates and instant results display.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900 text-sm">Progressive Updates</h4>
                      <p className="text-blue-700 text-xs mt-1">
                        See each profile appear instantly as it's processed, no waiting for batch completion.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3 p-4 bg-purple-50 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-purple-900 text-sm">Extended Timeouts</h4>
                      <p className="text-purple-700 text-xs mt-1">
                        Process larger datasets with timeout limits up to 5 minutes for reliable extraction.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3 p-4 bg-orange-50 rounded-lg">
                    <Database className="w-5 h-5 text-orange-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-orange-900 text-sm">Auto-Save Results</h4>
                      <p className="text-orange-700 text-xs mt-1">
                        All extracted data is automatically saved locally for future reference and analysis.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">
                  Technical Specifications
                </h3>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">API Version</span>
                    <span className="font-medium text-slate-900">v3.0.0</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">Streaming Protocol</span>
                    <span className="font-medium text-green-700">✓ Server-Sent Events</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">Max Timeout</span>
                    <span className="font-medium text-slate-900">300 seconds</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">Max Posts</span>
                    <span className="font-medium text-slate-900">50 per request</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-600">Real-time Updates</span>
                    <span className="font-medium text-green-700">✓ Live Progress</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <div className="space-y-6">
            {error && (
              <ErrorAlert 
                error={error}
                onRetry={handleStreamSubmit}
                onBack={() => setActiveTab('overview')}
              />
            )}

            {/* Streaming Progress */}
            {(isStreaming || streamProgress) && (
              <StreamingProgress
                progress={streamProgress}
                isStreaming={isStreaming}
                onStop={stopStreaming}
              />
            )}

            {(results || streamedPosts.length > 0 || displayMetadata) && (
              <>
                {/* Analytics Summary */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {selectedStoredResult ? 'Stored Result' : isStreaming ? 'Live Extraction Results' : 'Extraction Results'}
                    </h3>
                    <div className="flex items-center space-x-4">
                      {selectedStoredResult && (
                        <div className="flex items-center space-x-2 text-sm text-blue-600">
                          <Calendar className="w-4 h-4" />
                          <span>Saved: {formatDate(selectedStoredResult.savedAt)}</span>
                        </div>
                      )}
                      {isStreaming && (
                        <div className="flex items-center space-x-2 text-sm text-green-600">
                          <Zap className="w-4 h-4 animate-pulse" />
                          <span>Live streaming...</span>
                        </div>
                      )}
                      {!isStreaming && displayPosts.length > 0 && !selectedStoredResult && (
                        <div className="flex items-center space-x-2 text-sm text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span>Successfully processed</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-6">
                    <StatCard 
                      title="Target Hashtag"
                      value={`#${displayMetadata?.hashtag || formData.hashtag}`}
                      bgColor="bg-slate-50"
                      textColor="text-slate-900"
                    />
                    <StatCard 
                      title="Available Posts"
                      value={displayMetadata?.total_posts || streamMetadata?.total_posts || 0}
                      bgColor="bg-blue-50"
                      textColor="text-blue-700"
                    />
                    <StatCard 
                      title="Extracted"
                      value={displayPosts.length}
                      bgColor={isStreaming ? "bg-green-50" : "bg-green-50"}
                      textColor={isStreaming ? "text-green-700" : "text-green-700"}
                    />
                    <StatCard 
                      title="Total Reach"
                      value={formatNumber(displayPosts.reduce((acc, post) => acc + (post.author_data?.profile?.followers || 0), 0))}
                      bgColor="bg-purple-50"
                      textColor="text-purple-700"
                    />
                  </div>
                </div>

                {/* Posts Grid */}
                <div className="grid grid-cols-1 gap-6">
                  {displayPosts.map((post, index) => (
                    <div key={post.post_data?.media_id || index} className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300 ${
                      isStreaming && index === displayPosts.length - 1 ? 'ring-2 ring-green-500 ring-opacity-50 shadow-lg' : 'hover:shadow-lg'
                    }`}>
                      {/* Profile Header */}
                      <div className="p-6 border-b border-slate-100">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-900 rounded-full flex items-center justify-center">
                              <span className="text-white font-semibold">
                                {post.author_data?.username?.charAt(0)?.toUpperCase() || 'U'}
                              </span>
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-900">@{post.author_data?.username || 'Unknown'}</h4>
                              <div className="flex items-center space-x-4 text-sm text-slate-600 mt-1">
                                <span className="flex items-center">
                                  <Users className="w-4 h-4 mr-1" />
                                  {formatNumber(post.author_data?.profile?.followers || 0)} followers
                                </span>
                                <span>{formatNumber(post.author_data?.profile?.following || 0)} following</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {isStreaming && index === displayPosts.length - 1 && (
                              <div className="flex items-center space-x-2 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                                <Zap className="w-3 h-3" />
                                <span>Just processed</span>
                              </div>
                            )}
                            <button
                              onClick={() => copyToClipboard(post.author_data?.profile?.profileUrl || '')}
                              className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                              title="Copy profile URL"
                            >
                              {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                            <a
                              href={post.author_data?.profile?.profileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                              title="View profile"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                        
                        {post.author_data?.profile?.bio && (
                          <p className="text-slate-700 text-sm mt-3 leading-relaxed bg-slate-50 p-3 rounded-lg">
                            {post.author_data.profile.bio}
                          </p>
                        )}
                      </div>

                      {/* Post Content */}
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2 px-3 py-1 bg-slate-100 rounded-full">
                              {getMediaIcon(post.post_data?.media_type)}
                              <span className="text-xs font-medium text-slate-700 capitalize">
                                {post.post_data?.media_type?.toLowerCase()?.replace('_', ' ') || 'Unknown'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-slate-500">
                            <Clock className="w-4 h-4" />
                            <span>{formatDate(post.post_data?.timestamp)}</span>
                          </div>
                        </div>

                        {post.post_data?.media_url && (
                          <div className="mb-6">
                            <img
                              src={post.post_data.media_url}
                              alt="Post content"
                              className="w-full h-80 object-cover rounded-lg border border-slate-200"
                              loading="lazy"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          </div>
                        )}

                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
                              Post Caption
                            </label>
                            <div className="text-slate-800 text-sm leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-200 max-h-32 overflow-y-auto">
                              {post.post_data?.caption || 'No caption available'}
                            </div>
                          </div>

                          {/* Engagement Metrics */}
                          {(post.post_data?.likes || post.post_data?.comments) && (
                            <div className="flex items-center space-x-6 pt-4 border-t border-slate-100">
                              {post.post_data?.likes !== undefined && (
                                <div className="flex items-center space-x-2 text-sm text-slate-600">
                                  <span className="text-red-500">❤</span>
                                  <span>{formatNumber(post.post_data.likes)} likes</span>
                                </div>
                              )}
                              {post.post_data?.comments !== undefined && (
                                <div className="flex items-center space-x-2 text-sm text-slate-600">
                                  <span className="text-blue-500">💬</span>
                                  <span>{formatNumber(post.post_data.comments)} comments</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'storage' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                  <Database className="w-5 h-5 mr-2" />
                  Stored Data Management
                </h3>
                {storedResults.length > 0 && (
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={exportAllStoredResults}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export All
                    </button>
                    <button
                      onClick={clearAllStoredData}
                      className="flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear All
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-4 gap-4">
                <StatCard 
                  title="Stored Results"
                  value={storedResults.length}
                  bgColor="bg-slate-50"
                  textColor="text-slate-900"
                />
                <StatCard 
                  title="Total Posts"
                  value={storedResults.reduce((acc, result) => acc + (result.posts_with_profiles?.length || 0), 0)}
                  bgColor="bg-blue-50"
                  textColor="text-blue-700"
                />
                <StatCard 
                  title="Storage Used"
                  value={`${Math.round(JSON.stringify(storedResults).length / 1024)}KB`}
                  bgColor="bg-green-50"
                  textColor="text-green-700"
                />
                <StatCard 
                  title="Unique Hashtags"
                  value={new Set(storedResults.map(r => r.hashtag)).size}
                  bgColor="bg-purple-50"
                  textColor="text-purple-700"
                />
              </div>
            </div>

            {storedResults.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {storedResults.map((storedResult) => (
                  <div key={storedResult.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-lg transition-shadow duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-900 rounded-full flex items-center justify-center">
                          <Hash className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-900">#{storedResult.hashtag}</h4>
                          <div className="flex items-center space-x-4 text-sm text-slate-600 mt-1">
                            <span className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {formatDate(storedResult.savedAt)}
                            </span>
                            <span className="flex items-center">
                              <Users className="w-4 h-4 mr-1" />
                              {storedResult.posts_with_profiles?.length || 0} posts
                            </span>
                            <span className="flex items-center">
                              <Clock className="w-4 h-4 mr-1" />
                              {storedResult.searchParams.timeoutMs / 1000}s timeout
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => loadStoredResult(storedResult)}
                          className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
                        >
                          View Results
                        </button>
                        <button
                          onClick={() => deleteStoredResult(storedResult.id)}
                          className="p-2 text-red-400 hover:text-red-600 transition-colors"
                          title="Delete this result"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500">Total Reach:</span>
                          <span className="ml-2 font-medium text-slate-900">
                            {formatNumber(storedResult.posts_with_profiles?.reduce((acc, post) => acc + (post.author_data?.profile?.followers || 0), 0) || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Mode:</span>
                          <span className="ml-2 font-medium text-slate-900">
                            {storedResult.searchParams.headless ? 'Headless' : 'GUI'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Limit:</span>
                          <span className="ml-2 font-medium text-slate-900">
                            {storedResult.searchParams.limit} posts
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Database className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Stored Data</h3>
              <p className="text-slate-600 mb-4">Run some extractions to see your stored results here</p>
              <button
                onClick={() => setActiveTab('overview')}
                className="px-6 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
              >
                Start Extracting
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  </div>
);
}

