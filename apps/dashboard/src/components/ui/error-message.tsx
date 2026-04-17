import { AlertCircle } from 'lucide-react'
import { Button } from './button'

interface ErrorMessageProps {
  title?: string
  message: string
  onRetry?: () => void
}

export function ErrorMessage({
  title = 'Something went wrong',
  message,
  onRetry,
}: ErrorMessageProps) {
  return (
    <div className="rounded-lg border border-red-900/50 bg-red-900/10 p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-red-900/50 p-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-100 mb-1">{title}</h3>
          <p className="text-sm text-slate-300 mb-4">{message}</p>
          {onRetry && (
            <Button onClick={onRetry} variant="secondary" size="sm">
              Try Again
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
