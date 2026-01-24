import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useTheme } from '../contexts/ThemeContext';
import { GlobalBackground } from '../components/GlobalBackground';
import { cn } from '@/lib/utils';

export default function DiagnosticPage() {
  const { isDarkMode } = useTheme();

  const currentUrl = window.location.href;
  const origin = window.location.origin;
  const expectedRedirect = `${origin}/setup-password`;

  return (
    <>
      <GlobalBackground />
      <div className="relative min-h-screen flex items-center justify-center p-4 z-10">
        <Card className={cn(
          "w-full max-w-2xl rounded-3xl shadow-2xl border backdrop-blur-xl",
          isDarkMode 
            ? "bg-white/5 border-white/10" 
            : "bg-white/20 border-white/30"
        )}>
          <CardContent className="p-8">
            <h1 className={cn("text-2xl font-bold mb-6", isDarkMode ? "text-white" : "text-gray-900")}>
              URL Diagnostic Information
            </h1>
            
            <div className="space-y-4">
              <div className={cn("p-4 rounded-xl border", isDarkMode ? "bg-white/5 border-white/10" : "bg-white/30 border-white/30")}>
                <h3 className={cn("font-semibold mb-2", isDarkMode ? "text-white" : "text-gray-900")}>
                  Current URL:
                </h3>
                <code className={cn("text-sm break-all", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  {currentUrl}
                </code>
              </div>

              <div className={cn("p-4 rounded-xl border", isDarkMode ? "bg-white/5 border-white/10" : "bg-white/30 border-white/30")}>
                <h3 className={cn("font-semibold mb-2", isDarkMode ? "text-white" : "text-gray-900")}>
                  Origin (for Supabase Site URL):
                </h3>
                <code className={cn("text-sm", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  {origin}
                </code>
              </div>

              <div className={cn("p-4 rounded-xl border", isDarkMode ? "bg-white/5 border-white/10" : "bg-white/30 border-white/30")}>
                <h3 className={cn("font-semibold mb-2", isDarkMode ? "text-white" : "text-gray-900")}>
                  Expected Redirect URL:
                </h3>
                <code className={cn("text-sm", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  {expectedRedirect}
                </code>
              </div>

              <div className={cn("p-4 rounded-xl border bg-green-500/20 border-green-500/30")}>
                <h3 className="font-semibold mb-2 text-green-600">
                  🚀 DUAL ENVIRONMENT CONFIGURATION:
                </h3>
                <div className="text-sm text-green-600 space-y-3">
                  <div>
                    <strong>1. Go to Supabase Dashboard → Authentication → URL Configuration</strong>
                  </div>
                  <div>
                    <strong>2. Set Site URL to your PRODUCTION domain:</strong>
                    <div className="mt-1">
                      <code className="bg-green-100 px-2 py-1 rounded text-green-800">
                        {origin.includes('localhost') ? 'https://your-production-domain.com' : origin}
                      </code>
                    </div>
                  </div>
                  <div>
                    <strong>3. Add ALL these Redirect URLs:</strong>
                    <ul className="list-disc list-inside mt-1 ml-4 space-y-1">
                      <li><code className="bg-green-100 px-1 rounded text-green-800">{expectedRedirect}</code></li>
                      <li><code className="bg-green-100 px-1 rounded text-green-800">{origin}/**</code></li>
                      <li><code className="bg-green-100 px-1 rounded text-green-800">{origin}/</code></li>
                      {origin.includes('localhost') && (
                        <>
                          <li><code className="bg-blue-100 px-1 rounded text-blue-800">https://your-production-domain.com/setup-password</code></li>
                          <li><code className="bg-blue-100 px-1 rounded text-blue-800">https://your-production-domain.com/**</code></li>
                          <li><code className="bg-blue-100 px-1 rounded text-blue-800">https://your-production-domain.com/</code></li>
                        </>
                      )}
                      {!origin.includes('localhost') && (
                        <>
                          <li><code className="bg-blue-100 px-1 rounded text-blue-800">http://localhost:5173/setup-password</code></li>
                          <li><code className="bg-blue-100 px-1 rounded text-blue-800">http://localhost:5173/**</code></li>
                          <li><code className="bg-blue-100 px-1 rounded text-blue-800">http://localhost:5173/</code></li>
                        </>
                      )}
                    </ul>
                  </div>
                  <div className="mt-3 p-2 bg-green-100 rounded text-green-800 text-xs">
                    <strong>💡 This setup allows both localhost development AND production to work!</strong>
                  </div>
                </div>
              </div>

              <div className={cn("p-4 rounded-xl border", isDarkMode ? "bg-white/5 border-white/10" : "bg-white/30 border-white/30")}>
                <h3 className={cn("font-semibold mb-2", isDarkMode ? "text-white" : "text-gray-900")}>
                  URL Parameters (if any):
                </h3>
                <div className="text-sm space-y-1">
                  <div>Search: <code>{window.location.search || 'None'}</code></div>
                  <div>Hash: <code>{window.location.hash || 'None'}</code></div>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <a 
                href="/"
                className="inline-block px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-colors"
              >
                Back to Login
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}