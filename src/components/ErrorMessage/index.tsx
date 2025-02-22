import React from 'react';

interface ErrorMessageProps {
  message: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
  if (!message) return null;
  
  return (
    <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
      {message}
    </div>
  );
};

export default ErrorMessage; 