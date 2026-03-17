import { CheckCircle2, Clock, AlertCircle, XCircle } from 'lucide-react';

export function StatusBadge({ status, variant = 'default' }) {
  const statusConfig = {
    submitted: {
      color: 'text-blue-700',
      bgColor: 'bg-blue-50 border-blue-200',
      icon: <Clock className="w-4 h-4" />,
      label: 'Submitted',
    },
    assigned: {
      color: 'text-purple-700',
      bgColor: 'bg-purple-50 border-purple-200',
      icon: <AlertCircle className="w-4 h-4" />,
      label: 'Assigned',
    },
    collected: {
      color: 'text-green-700',
      bgColor: 'bg-green-50 border-green-200',
      icon: <CheckCircle2 className="w-4 h-4" />,
      label: 'Collected',
    },
    at_hub: {
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-50 border-yellow-200',
      icon: <Clock className="w-4 h-4" />,
      label: 'At Hub',
    },
    verified: {
      color: 'text-cyan-700',
      bgColor: 'bg-cyan-50 border-cyan-200',
      icon: <CheckCircle2 className="w-4 h-4" />,
      label: 'Verified',
    },
    matched: {
      color: 'text-indigo-700',
      bgColor: 'bg-indigo-50 border-indigo-200',
      icon: <CheckCircle2 className="w-4 h-4" />,
      label: 'Matched',
    },
    in_transit: {
      color: 'text-orange-700',
      bgColor: 'bg-orange-50 border-orange-200',
      icon: <AlertCircle className="w-4 h-4" />,
      label: 'In Transit',
    },
    delivered: {
      color: 'text-emerald-700',
      bgColor: 'bg-emerald-50 border-emerald-200',
      icon: <CheckCircle2 className="w-4 h-4" />,
      label: 'Delivered',
    },
    processed: {
      color: 'text-teal-700',
      bgColor: 'bg-teal-50 border-teal-200',
      icon: <CheckCircle2 className="w-4 h-4" />,
      label: 'Processed',
    },
    cancelled: {
      color: 'text-red-700',
      bgColor: 'bg-red-50 border-red-200',
      icon: <XCircle className="w-4 h-4" />,
      label: 'Cancelled',
    },
    open: {
      color: 'text-blue-700',
      bgColor: 'bg-blue-50 border-blue-200',
      icon: <Clock className="w-4 h-4" />,
      label: 'Open',
    },
    partially_matched: {
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-50 border-yellow-200',
      icon: <AlertCircle className="w-4 h-4" />,
      label: 'Partially Matched',
    },
    fully_matched: {
      color: 'text-green-700',
      bgColor: 'bg-green-50 border-green-200',
      icon: <CheckCircle2 className="w-4 h-4" />,
      label: 'Fully Matched',
    },
    fulfilled: {
      color: 'text-teal-700',
      bgColor: 'bg-teal-50 border-teal-200',
      icon: <CheckCircle2 className="w-4 h-4" />,
      label: 'Fulfilled',
    },
  };

  const config = statusConfig[status] || {
    color: 'text-gray-700',
    bgColor: 'bg-gray-50 border-gray-200',
    icon: <AlertCircle className="w-4 h-4" />,
    label: status,
  };

  if (variant === 'outline') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${config.bgColor} ${config.color}`}>
        {config.icon}
        {config.label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${config.bgColor} ${config.color} border`}>
      {config.icon}
      {config.label}
    </span>
  );
}
