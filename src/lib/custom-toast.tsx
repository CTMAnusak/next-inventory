import React from 'react';
import { toast } from 'react-hot-toast';

interface CustomToastOptions {
  duration?: number;
  style?: React.CSSProperties;
  dismissible?: boolean;
}

export const customToast = {
  error: (message: string, options: CustomToastOptions = {}) => {
    return toast.custom(
      (t) => (
        <div
          className={`${
            t.visible ? 'animate-enter' : 'animate-leave'
          } bg-red-50 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 relative toast-responsive-width`}
          style={{
            background: '#f8d7da',
            color: '#721c24',
            border: '1px solid #f1b0b7',
            fontSize: '14px',
            lineHeight: '1.5',
            padding: '16px',
            paddingRight: '40px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            whiteSpace: options.style?.whiteSpace || 'normal',
            textAlign: options.style?.textAlign || 'left',
            ...(options.style?.maxWidth ? {} : {}), // ไม่ใส่ maxWidth ใน inline style ถ้ามี CSS class
            ...Object.fromEntries(
              Object.entries(options.style || {}).filter(([key]) => key !== 'maxWidth')
            ),
          }}
        >
          <div className="flex-1">
            <div style={{ whiteSpace: options.style?.whiteSpace || 'pre-line' }}>
              {message}
            </div>
          </div>
          {options.dismissible !== false && (
            <button
              onClick={() => toast.dismiss(t.id)}
              className="absolute top-2 right-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold transition-all duration-200 hover:scale-110"
              style={{
                background: 'rgba(114, 28, 36, 0.1)',
                color: '#721c24',
                border: 'none',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(114, 28, 36, 0.2)';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(114, 28, 36, 0.1)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              ×
            </button>
          )}
        </div>
      ),
      {
        duration: options.duration || 10000,
      }
    );
  },

  success: (message: string, options: CustomToastOptions = {}) => {
    return toast.custom(
      (t) => (
        <div
          className={`${
            t.visible ? 'animate-enter' : 'animate-leave'
          } max-w-md w-full bg-green-50 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 relative`}
          style={{
            background: '#d4edda',
            color: '#155724',
            border: '1px solid #c3e6cb',
            fontSize: '14px',
            lineHeight: '1.5',
            padding: '16px',
            paddingRight: '40px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            maxWidth: options.style?.maxWidth || '500px',
            ...options.style,
          }}
        >
          <div className="flex-1">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 w-0 flex-1">
                <div>{message}</div>
              </div>
            </div>
          </div>
          {options.dismissible !== false && (
            <button
              onClick={() => toast.dismiss(t.id)}
              className="absolute top-2 right-2 bg-green-100 hover:bg-green-200 text-green-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold transition-all duration-200 hover:scale-110"
              style={{
                background: 'rgba(21, 87, 36, 0.1)',
                color: '#155724',
                border: 'none',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(21, 87, 36, 0.2)';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(21, 87, 36, 0.1)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              ×
            </button>
          )}
        </div>
      ),
      {
        duration: options.duration || 5000,
      }
    );
  },
};
