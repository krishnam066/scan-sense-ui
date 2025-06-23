import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Zap, Globe, Server, Download, Copy, AlertTriangle, CheckCircle, Clock, Eye, FileText } from "lucide-react";
import jsPDF from 'jspdf';
import { useToast } from "@/hooks/use-toast";

// Backend API constant - Updated to be more flexible
const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? "https://your-backend-domain.com" // Replace with your actual backend URL
  : "http://localhost:5000";

interface ScanResult {
  port?: string;
  state?: string;
  service?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  url?: string;
  description?: string;
  endpoint?: string;
  title?: string;
}

const Index = () => {
  const [target, setTarget] = useState("");
  const [scanType, setScanType] = useState("nmap");
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [lastScanInfo, setLastScanInfo] = useState<{type: string, target: string, timestamp: Date} | null>(null);
  const [backendConnected, setBackendConnected] = useState(false);
  const { toast } = useToast();

  const handleScan = async () => {
    if (!target.trim()) return;
    
    setIsScanning(true);
    setScanResults([]);
    
    try {
      // Try to connect to backend with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`${BACKEND_URL}/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: target.trim(),
          type: scanType
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setScanResults(data.result || []);
      setBackendConnected(true);
      setLastScanInfo({
        type: scanType,
        target: target.trim(),
        timestamp: new Date()
      });
      
      toast({
        title: "Scan completed",
        description: `Found ${data.result?.length || 0} results`,
      });
      
    } catch (error) {
      console.error('Scan failed:', error);
      
      // Show warning about demo mode
      toast({
        title: "Backend unavailable",
        description: "Using demo data. Connect your backend for real scans.",
        variant: "destructive"
      });
      
      // Use demo data as fallback
      const demoResults = generateDemoResults(scanType);
      setScanResults(demoResults);
      setBackendConnected(false);
      setLastScanInfo({
        type: scanType,
        target: target.trim(),
        timestamp: new Date()
      });
    } finally {
      setIsScanning(false);
    }
  };

  const generateDemoResults = (type: string): ScanResult[] => {
    switch (type) {
      case 'nmap':
        return [
          { port: '22', state: 'open', service: 'ssh' },
          { port: '80', state: 'open', service: 'http' },
          { port: '443', state: 'open', service: 'https' },
          { port: '3306', state: 'filtered', service: 'mysql' }
        ];
      case 'nuclei':
        return [
          { 
            title: 'SSL Certificate Expiry Warning',
            severity: 'medium', 
            url: 'https://example.com',
            description: 'SSL certificate expires within 30 days'
          },
          { 
            title: 'Directory Listing Enabled',
            severity: 'low', 
            url: 'https://example.com/assets/',
            description: 'Directory listing is enabled and may expose sensitive files'
          },
          { 
            title: 'Missing Security Headers',
            severity: 'medium', 
            url: 'https://example.com',
            description: 'Missing X-Frame-Options header'
          }
        ];
      case 'nikto':
        return [
          { 
            description: 'Server leaks inodes via ETags, header found with file /, inode: 12345, size: 4096, mtime: Mon Dec 25 10:23:45 2023',
            endpoint: '/'
          },
          { 
            description: 'The anti-clickjacking X-Frame-Options header is not present.',
            endpoint: '/'
          },
          { 
            description: 'Web server returns a valid response with junk HTTP methods, this may cause false positives.',
            endpoint: '/'
          }
        ];
      default:
        return [];
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Scan results copied successfully",
    });
  };

  const downloadResults = () => {
    const dataStr = JSON.stringify(scanResults, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scan-results-${scanType}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Download started",
      description: "JSON file has been downloaded",
    });
  };

  const downloadPDF = () => {
    if (!lastScanInfo || scanResults.length === 0) {
      toast({
        title: "No data to export",
        description: "Please run a scan first",
        variant: "destructive"
      });
      return;
    }

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;
    let yPosition = margin;

    // Add title
    pdf.setFontSize(20);
    pdf.text('SecureScan Report', margin, yPosition);
    yPosition += 15;

    // Add scan info
    pdf.setFontSize(12);
    pdf.text(`Target: ${lastScanInfo.target}`, margin, yPosition);
    yPosition += 10;
    pdf.text(`Scan Type: ${lastScanInfo.type.toUpperCase()}`, margin, yPosition);
    yPosition += 10;
    pdf.text(`Timestamp: ${lastScanInfo.timestamp.toLocaleString()}`, margin, yPosition);
    yPosition += 10;
    pdf.text(`Backend Status: ${backendConnected ? 'Connected' : 'Demo Mode'}`, margin, yPosition);
    yPosition += 20;

    // Add results
    pdf.setFontSize(16);
    pdf.text('Scan Results:', margin, yPosition);
    yPosition += 15;

    pdf.setFontSize(10);
    scanResults.forEach((result, index) => {
      // Check if we need a new page
      if (yPosition > 250) {
        pdf.addPage();
        yPosition = margin;
      }

      pdf.text(`${index + 1}.`, margin, yPosition);
      
      if (scanType === 'nmap') {
        pdf.text(`Port: ${result.port || 'N/A'}`, margin + 10, yPosition);
        yPosition += 8;
        pdf.text(`State: ${result.state || 'N/A'}`, margin + 10, yPosition);
        yPosition += 8;
        pdf.text(`Service: ${result.service || 'N/A'}`, margin + 10, yPosition);
      } else if (scanType === 'nuclei') {
        pdf.text(`Title: ${result.title || 'N/A'}`, margin + 10, yPosition);
        yPosition += 8;
        pdf.text(`Severity: ${result.severity || 'N/A'}`, margin + 10, yPosition);
        yPosition += 8;
        pdf.text(`URL: ${result.url || 'N/A'}`, margin + 10, yPosition);
        yPosition += 8;
        // Handle long descriptions
        const description = result.description || 'N/A';
        const splitDescription = pdf.splitTextToSize(description, pageWidth - margin * 2 - 10);
        pdf.text(splitDescription, margin + 10, yPosition);
        yPosition += splitDescription.length * 5;
      } else if (scanType === 'nikto') {
        pdf.text(`Endpoint: ${result.endpoint || 'N/A'}`, margin + 10, yPosition);
        yPosition += 8;
        // Handle long descriptions
        const description = result.description || 'N/A';
        const splitDescription = pdf.splitTextToSize(description, pageWidth - margin * 2 - 10);
        pdf.text(splitDescription, margin + 10, yPosition);
        yPosition += splitDescription.length * 5;
      }
      
      yPosition += 10;
    });

    // Save the PDF
    const fileName = `securescan-report-${scanType}-${lastScanInfo.target}-${Date.now()}.pdf`;
    pdf.save(fileName);
    
    toast({
      title: "PDF downloaded",
      description: "Scan report has been exported as PDF",
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'low': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getPortStateColor = (state: string) => {
    switch (state) {
      case 'open': return 'text-green-400';
      case 'closed': return 'text-red-400';
      case 'filtered': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full mix-blend-normal filter blur-[128px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full mix-blend-normal filter blur-[128px] animate-pulse delay-700" />
        <div className="absolute top-1/4 right-1/3 w-64 h-64 bg-fuchsia-500/10 rounded-full mix-blend-normal filter blur-[96px] animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 container mx-auto px-6 py-8">
        {/* Header */}
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
              <Shield className="w-8 h-8 text-violet-400" />
            </div>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-violet-400">
              SecureScan
            </h1>
          </div>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Advanced security scanning platform powered by Nmap, Nuclei, and Nikto
          </p>
          {/* Backend status indicator */}
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-green-400' : 'bg-yellow-400'}`} />
            <span className="text-sm text-white/60">
              {backendConnected ? 'Backend Connected' : 'Demo Mode'}
            </span>
          </div>
        </motion.div>

        {/* Scan Input Form */}
        <motion.div 
          className="max-w-4xl mx-auto mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="backdrop-blur-xl bg-white/[0.02] rounded-2xl border border-white/[0.05] p-8 shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Target Input */}
              <div className="lg:col-span-2">
                <label htmlFor="targetInput" className="block text-sm font-medium text-white/80 mb-3">
                  Target Domain or IP Address
                </label>
                <input
                  id="targetInput"
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="e.g. example.com or 192.168.0.1"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all"
                  disabled={isScanning}
                />
              </div>

              {/* Scan Type Selection */}
              <div>
                <label htmlFor="scanType" className="block text-sm font-medium text-white/80 mb-3">
                  Scan Type
                </label>
                <select
                  id="scanType"
                  value={scanType}
                  onChange={(e) => setScanType(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all"
                  disabled={isScanning}
                >
                  <option value="nmap">Port Scan (Nmap)</option>
                  <option value="nuclei">Web Vulnerability (Nuclei)</option>
                  <option value="nikto">Server Misconfig (Nikto)</option>
                </select>
              </div>
            </div>

            {/* Scan Button */}
            <div className="mt-6 flex justify-center">
              <motion.button
                id="scanButton"
                onClick={handleScan}
                disabled={!target.trim() || isScanning}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`
                  px-8 py-3 rounded-xl font-medium text-sm transition-all flex items-center gap-2
                  ${target.trim() && !isScanning
                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-500/25'
                    : 'bg-white/5 text-white/40 cursor-not-allowed'
                  }
                `}
              >
                {isScanning ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Zap className="w-4 h-4" />
                    </motion.div>
                    Scanning...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    Start Scan
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Scan Results Section */}
        <AnimatePresence>
          {(scanResults.length > 0 || isScanning) && (
            <motion.div
              className="max-w-6xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6 }}
            >
              <div className="backdrop-blur-xl bg-white/[0.02] rounded-2xl border border-white/[0.05] p-8 shadow-2xl">
                {/* Results Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-lg">
                      <Eye className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">Scan Results</h2>
                      {lastScanInfo && (
                        <p className="text-sm text-white/60">
                          {lastScanInfo.type.toUpperCase()} scan of {lastScanInfo.target} at {lastScanInfo.timestamp.toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {scanResults.length > 0 && (
                    <div className="flex gap-2">
                      <motion.button
                        onClick={() => copyToClipboard(JSON.stringify(scanResults, null, 2))}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-all"
                        title="Copy to clipboard"
                      >
                        <Copy className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        onClick={downloadResults}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-all"
                        title="Download JSON"
                      >
                        <Download className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        onClick={downloadPDF}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="p-2 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 rounded-lg text-white transition-all shadow-lg shadow-red-500/25"
                        title="Download PDF Report"
                      >
                        <FileText className="w-4 h-4" />
                      </motion.button>
                    </div>
                  )}
                </div>

                {/* Loading State */}
                {isScanning && (
                  <div className="text-center py-12">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="inline-block mb-4"
                    >
                      <Zap className="w-8 h-8 text-violet-400" />
                    </motion.div>
                    <p className="text-white/60">Scanning target for security vulnerabilities...</p>
                  </div>
                )}

                {/* Results Display */}
                <div id="resultOutput">
                  {scanResults.length > 0 && (
                    <div className="space-y-4">
                      {/* Nmap Results */}
                      {scanType === 'nmap' && (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="border-b border-white/10">
                                <th className="text-left py-3 px-4 text-white/80 font-medium">Port</th>
                                <th className="text-left py-3 px-4 text-white/80 font-medium">State</th>
                                <th className="text-left py-3 px-4 text-white/80 font-medium">Service</th>
                              </tr>
                            </thead>
                            <tbody>
                              {scanResults.map((result, index) => (
                                <motion.tr
                                  key={index}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: index * 0.1 }}
                                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                                >
                                  <td className="py-3 px-4 text-white font-mono">{result.port}</td>
                                  <td className={`py-3 px-4 font-medium ${getPortStateColor(result.state || '')}`}>
                                    {result.state}
                                  </td>
                                  <td className="py-3 px-4 text-white/70">{result.service}</td>
                                </motion.tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Nuclei Results */}
                      {scanType === 'nuclei' && (
                        <div className="space-y-3">
                          {scanResults.map((result, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="p-4 bg-white/5 rounded-xl border border-white/10"
                            >
                              <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h3 className="font-medium text-white">{result.title}</h3>
                                    <span className={`px-2 py-1 rounded-md text-xs font-medium border ${getSeverityColor(result.severity || '')}`}>
                                      {result.severity?.toUpperCase()}
                                    </span>
                                  </div>
                                  <p className="text-white/70 text-sm mb-2">{result.description}</p>
                                  <p className="text-violet-400 text-sm font-mono">{result.url}</p>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {/* Nikto Results */}
                      {scanType === 'nikto' && (
                        <div className="space-y-3">
                          {scanResults.map((result, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="p-4 bg-white/5 rounded-xl border border-white/10"
                            >
                              <div className="flex items-start gap-3">
                                <Server className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="text-white/80 text-sm mb-2">{result.description}</p>
                                  <p className="text-violet-400 text-sm font-mono">{result.endpoint}</p>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Index;
