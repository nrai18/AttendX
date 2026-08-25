import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowLeft, Home, FileQuestion } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-6 text-center px-4">
      <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-4">
        <FileQuestion className="w-10 h-10 text-primary" />
      </div>
      <h1 className="text-7xl font-extrabold tracking-tight text-foreground">404</h1>
      <h2 className="text-2xl font-bold tracking-tight">Page Not Found</h2>
      <p className="text-muted-foreground max-w-md pb-4">
        We couldn't find the page you were looking for. It might have been moved, deleted, or perhaps it never existed.
      </p>
      <div className="flex items-center gap-4">
        <Button onClick={() => navigate(-1)} variant="outline" className="rounded-xl h-11 px-6 border-border bg-transparent hover:bg-white/5">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
        <Button onClick={() => navigate('/today')} className="rounded-xl h-11 px-6 bg-primary hover:bg-primary/90">
          <Home className="w-4 h-4 mr-2" />
          Dashboard
        </Button>
      </div>
    </div>
  );
};