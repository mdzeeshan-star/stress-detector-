import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StressLevel, AnalysisResult, StressKeyword } from './types';
import { analyzeStress } from './services/geminiService';

// Fix: Add type declarations for browser-specific SpeechRecognition API and jsPDF
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
        jspdf: any;
    }
}

type Theme = 'light' | 'dark';

// --- Helper & UI Components (Defined outside the main App component) ---

const ThemeToggle: React.FC<{ theme: Theme; toggleTheme: () => void }> = ({ theme, toggleTheme }) => {
    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            aria-label="Toggle theme"
        >
            {theme === 'light' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            )}
        </button>
    );
};

const HighlightKeywords: React.FC<{ text: string; keywords: StressKeyword[] }> = ({ text, keywords }) => {
    if (!keywords || keywords.length === 0) {
        return <>{text}</>;
    }

    const getIntensityStyles = (intensity: number): string => {
        const baseStyles = 'px-1 rounded';
        if (intensity >= 9) return `${baseStyles} bg-red-500 text-white dark:bg-red-600`;
        if (intensity >= 7) return `${baseStyles} bg-red-400 text-white dark:bg-red-500`;
        if (intensity >= 5) return `${baseStyles} bg-red-300 text-red-900 dark:bg-red-400 dark:text-red-950`;
        if (intensity >= 3) return `${baseStyles} bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-100`;
        return `${baseStyles} bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200`;
    };
    
    // Escape special regex characters from keywords
    const escapedWords = keywords.map(k => k.word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    if (escapedWords.length === 0) {
        return <>{text}</>;
    }

    const regex = new RegExp(`(${escapedWords.join('|')})`, 'gi');
    const parts = text.split(regex);

    return (
        <span>
            {parts.map((part, i) => {
                const matchedKeyword = keywords.find(k => k.word.toLowerCase() === part.toLowerCase());
                if (matchedKeyword) {
                    return (
                        <span key={i} className={getIntensityStyles(matchedKeyword.intensity)}>
                            {part}
                        </span>
                    );
                }
                return part;
            })}
        </span>
    );
};

const LoadingSpinner: React.FC = () => (
    <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
);

const ResultCard: React.FC<{ result: AnalysisResult; onDownloadPdf: () => void }> = ({ result, onDownloadPdf }) => {
    const getStressStyles = (level: StressLevel) => {
        switch (level) {
            case StressLevel.LOW: return { label: "Low Stress", bgColor: "bg-green-100 dark:bg-green-900", textColor: "text-green-800 dark:text-green-200", borderColor: "border-green-500", emoji: "😊", emojiAnimation: "animate-glow" };
            case StressLevel.MEDIUM: return { label: "Medium Stress", bgColor: "bg-yellow-100 dark:bg-yellow-900", textColor: "text-yellow-800 dark:text-yellow-200", borderColor: "border-yellow-500", emoji: "😟", emojiAnimation: "animate-pulse" };
            case StressLevel.HIGH: return { label: "High Stress", bgColor: "bg-red-100 dark:bg-red-900", textColor: "text-red-800 dark:text-red-200", borderColor: "border-red-500", emoji: "😫", emojiAnimation: "animate-shake" };
            default: return { label: "Unknown", bgColor: "bg-gray-100 dark:bg-gray-700", textColor: "text-gray-800 dark:text-gray-200", borderColor: "border-gray-500", emoji: "🤔", emojiAnimation: "" };
        }
    };

    const styles = getStressStyles(result.stressLevel);

    return (
        <div className={`mt-8 w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 ${styles.borderColor} transition-all duration-300 animate-fade-in`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                <div className={`inline-block px-4 py-2 rounded-full text-lg font-semibold ${styles.bgColor} ${styles.textColor}`}>{styles.label}</div>
                <div className={`text-5xl mt-4 sm:mt-0 ${styles.emojiAnimation}`}>{styles.emoji}</div>
            </div>
            <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Confidence Score</h3>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                    <div className={`h-4 rounded-full ${styles.bgColor.split(' ')[0].replace('100', '500').replace('900', '600')}`} style={{ width: `${result.confidenceScore}%` }}></div>
                </div>
                <p className="text-right text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">{result.confidenceScore}%</p>
            </div>
            
            {result.reasoningScores && (
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Detailed Reasoning</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                        <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            <div className="text-sm text-gray-500 dark:text-gray-400">Negative Word Score</div>
                            <div className="text-2xl font-bold text-red-500">{result.reasoningScores.negativeWordScore}</div>
                        </div>
                        <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            <div className="text-sm text-gray-500 dark:text-gray-400">Emotional Tone</div>
                            <div className={`text-2xl font-bold ${result.reasoningScores.emotionalTone >= 0 ? 'text-green-500' : 'text-yellow-500'}`}>{result.reasoningScores.emotionalTone}</div>
                        </div>
                        <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            <div className="text-sm text-gray-500 dark:text-gray-400">Cognitive Overload</div>
                            <div className="text-2xl font-bold text-blue-500">{result.reasoningScores.cognitiveOverloadIndex}</div>
                        </div>
                    </div>
                </div>
            )}

            <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Why this stress level was predicted?</h3>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    <HighlightKeywords text={result.explanation} keywords={result.stressfulKeywords} />
                </p>
            </div>
            {result.stressLevel === StressLevel.HIGH && result.suggestions.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Suggestions for Reducing Stress</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                        {result.suggestions.map((suggestion, index) => (<li key={index}>{suggestion}</li>))}
                    </ul>
                </div>
            )}
             <div className="mt-8 text-center">
                <button
                    onClick={onDownloadPdf}
                    className="bg-primary-600 text-white font-bold py-2 px-6 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800 transition-colors"
                    aria-label="Download analysis as PDF"
                >
                    Download PDF Report
                </button>
            </div>
        </div>
    );
};

const StressTrendChart: React.FC<{ history: StressLevel[] }> = ({ history }) => {
    const getColor = (level: StressLevel) => {
        switch (level) {
            case StressLevel.LOW: return 'bg-green-500';
            case StressLevel.MEDIUM: return 'bg-yellow-500';
            case StressLevel.HIGH: return 'bg-red-500';
            default: return 'bg-gray-300 dark:bg-gray-600';
        }
    };
    const filledHistory = [...Array(5 - history.length).fill(null), ...history];

    return (
        <div className="mt-8 w-full max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 text-center">Recent Stress Trend (Oldest to Newest)</h3>
            <div className="flex justify-center items-end gap-3 h-24 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-inner">
                {filledHistory.map((level, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center justify-end h-full">
                         <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 h-4">{level ? level.split(' ')[0] : ''}</span>
                        <div
                            title={level || 'No data'}
                            className={`w-full rounded-t-md transition-all duration-300 ${level ? getColor(level) : 'bg-gray-200 dark:bg-gray-700'}`}
                            style={{ height: level === StressLevel.HIGH ? '100%' : level === StressLevel.MEDIUM ? '60%' : level === StressLevel.LOW ? '30%' : '5%' }}
                         />
                    </div>
                ))}
            </div>
        </div>
    );
};


// --- Main App Component ---

function App() {
    const [text, setText] = useState('');
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [theme, setTheme] = useState<Theme>('light');
    const [history, setHistory] = useState<StressLevel[]>([]);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        // Theme initialization
        const savedTheme = localStorage.getItem('theme') as Theme | null;
        if (savedTheme) {
            setTheme(savedTheme);
            document.documentElement.classList.toggle('dark', savedTheme === 'dark');
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setTheme('dark');
            document.documentElement.classList.add('dark');
        }

        // Speech Recognition initialization
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false; // Stop after a pause
            recognitionRef.current.interimResults = true;

            recognitionRef.current.onresult = (event: any) => {
                let transcript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                     transcript += event.results[i][0].transcript;
                }
                setText(transcript);
            };
            
            recognitionRef.current.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current.onerror = (event: any) => {
                setError(`Voice recognition error: ${event.error}`);
                setIsListening(false);
            };

        } else {
             console.warn("Speech Recognition not supported by this browser.");
        }
    }, []);

    const toggleTheme = () => {
        setTheme(prevTheme => {
            const newTheme = prevTheme === 'light' ? 'dark' : 'light';
            localStorage.setItem('theme', newTheme);
            document.documentElement.classList.toggle('dark', newTheme === 'dark');
            return newTheme;
        });
    };

    const handleAnalyze = useCallback(async () => {
        if (!text.trim()) {
            setError("Please enter some text to analyze.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const analysisResult = await analyzeStress(text);
            setResult(analysisResult);
            setHistory(prev => [...prev, analysisResult.stressLevel].slice(-5));
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    }, [text]);

    const handleListen = () => {
        if (!recognitionRef.current) {
            setError("Voice input is not supported on your browser.");
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            setText('');
            setError(null);
            recognitionRef.current.start();
            setIsListening(true);
        }
    };
    
    const handleDownloadPdf = useCallback(() => {
        if (!result) return;
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
    
        doc.setFontSize(22);
        doc.text("Stress Analysis Report", 105, 20, { align: 'center' });
    
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 28, { align: 'center' });
    
        let yPos = 40;
    
        const addSection = (title: string, content: string | string[], isList: boolean = false) => {
            if (yPos > 260) { doc.addPage(); yPos = 20; }
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text(title, 14, yPos);
            doc.setLineWidth(0.5);
            doc.line(14, yPos + 1.5, 196, yPos + 1.5);
            yPos += 8;
            doc.setFontSize(11);
            doc.setTextColor(50);
            if (isList && Array.isArray(content)) {
                 content.forEach((item: string) => {
                    const splitItem = doc.splitTextToSize(item, 182);
                    doc.text(splitItem, 14, yPos);
                    yPos += splitItem.length * 5;
                 });
                 yPos += 5;
            } else {
                const splitContent = doc.splitTextToSize(content as string, 182);
                doc.text(splitContent, 14, yPos);
                yPos += (Array.isArray(splitContent) ? splitContent.length : 1) * 5 + 10;
            }
        };
    
        addSection("Your Input Text", text);
    
        yPos += 5; 
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Analysis Summary", 14, yPos);
        doc.setLineWidth(0.5);
        doc.line(14, yPos + 1.5, 196, yPos + 1.5);
        yPos += 8;
    
        doc.setFontSize(12);
        doc.text(`Stress Level: ${result.stressLevel}`, 20, yPos);
        doc.text(`Confidence: ${result.confidenceScore}%`, 120, yPos);
        yPos += 10;
    
        if(result.reasoningScores) {
            addSection("Detailed Reasoning", [
                `- Negative Word Score: ${result.reasoningScores.negativeWordScore}/100`,
                `- Emotional Tone: ${result.reasoningScores.emotionalTone}/100`,
                `- Cognitive Overload Index: ${result.reasoningScores.cognitiveOverloadIndex}/100`
            ], true);
        }
    
        addSection("Explanation", result.explanation);
    
        if (result.suggestions && result.suggestions.length > 0) {
            addSection("AI-Powered Suggestions", result.suggestions.map(s => `• ${s}`), true);
        }
    
        doc.save("stress-analysis-report.pdf");
    }, [result, text]);

    return (
        <div className="min-h-screen font-sans text-gray-900 dark:text-gray-100 flex flex-col items-center p-4 sm:p-6 lg:p-8">
            <header className="w-full max-w-4xl flex justify-between items-center mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-primary-700 dark:text-primary-400">Stress Level Detector</h1>
                <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
            </header>

            <main className="w-full max-w-4xl flex flex-col items-center text-center">
                <p className="max-w-2xl mb-8 text-gray-600 dark:text-gray-400">
                    This AI tool analyzes the emotional tone of text (English, Hindi, Tamil) to estimate stress levels. Try typing or using your voice.
                </p>

                <div className="w-full max-w-2xl bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md relative">
                     <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Type or speak any sentence or paragraph here..."
                        className="w-full h-40 p-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                        disabled={isLoading || isListening}
                        aria-label="Text input for stress analysis"
                    />
                    <button onClick={handleListen} title="Use Voice Input" className={`absolute right-8 top-8 p-2 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    </button>
                    <button
                        onClick={handleAnalyze}
                        disabled={isLoading || !text.trim()}
                        className="mt-4 w-full bg-primary-600 text-white font-bold py-3 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800 disabled:bg-primary-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? 'Analyzing...' : 'Check Stress Level'}
                    </button>
                </div>

                {error && <div className="mt-6 text-red-500 bg-red-100 dark:bg-red-900 dark:text-red-300 p-3 rounded-md w-full max-w-2xl">{error}</div>}
                
                {isLoading && <LoadingSpinner />}
                
                {result && <ResultCard result={result} onDownloadPdf={handleDownloadPdf} />}
                
                {history.length > 0 && <StressTrendChart history={history} />}
            </main>
            
            <footer className="mt-auto pt-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                <p>Mini Project – Machine Learning</p>
            </footer>
        </div>
    );
}

export default App;